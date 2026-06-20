import { randomUUID } from "node:crypto";
import { parseListId, loadConfig } from "@orbit/shared";
import { getDb } from "../db/client.js";
import { logger } from "../utils/logger.js";
import type { Orbit, OrbitInput, OrbitUpdate, TrackSource } from "@orbit/shared";
import {
  trackToQuery,
  upgradeOrbitIntent,
  fallbackUpgradedCriteria,
} from "../ai/client.js";
import { toEntityOrQuery, needsQueryRegeneration, buildListFeedQueryBase } from "../x/query.js";
import { orbitColumnNames } from "../db/migrate.js";
import { scheduleOrbitStorage } from "../0g/persist.js";

function rowToOrbit(row: Record<string, unknown>): Orbit {
  return {
    id: String(row.id),
    wallet: String(row.wallet),
    source: String(row.source ?? "custom") as TrackSource,
    title: String(row.title ?? row.intent ?? ""),
    topic: (row.topic as string) ?? undefined,
    criteria: String(row.criteria ?? row.intent ?? ""),
    upgradedCriteria: (row.upgraded_criteria as string) ?? undefined,
    listId: (row.list_id as string) ?? undefined,
    notifyTelegram: Boolean(row.notify_telegram),
    generatedQuery: String(row.generated_query ?? ""),
    queryVersion: Number(row.query_version),
    pollIntervalMs: Number(row.poll_interval_ms),
    lastPolledAt: row.last_polled_at != null ? Number(row.last_polled_at) : undefined,
    paused: Boolean(row.paused),
    storageRoot: (row.storage_root as string) ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

async function buildUpgradedCriteria(input: {
  title: string;
  topic?: string;
  criteria: string;
  source: TrackSource;
}): Promise<string> {
  try {
    return await upgradeOrbitIntent(input.title, input.topic, input.criteria, input.source);
  } catch (err) {
    logger.warn({ err }, "upgrade orbit intent failed, using fallback");
    return fallbackUpgradedCriteria(input.title, input.topic, input.criteria);
  }
}

async function resolveGeneratedQuery(
  source: TrackSource,
  upgradedCriteria: string,
  listId?: string,
): Promise<string> {
  if (source === "list") {
    return listId ? buildListFeedQueryBase(listId) : "";
  }
  const result = await trackToQuery(upgradedCriteria);
  const keywords = Array.isArray(result.keywords) ? result.keywords : [];
  return toEntityOrQuery(keywords.length > 0 ? keywords : (result.query ?? ""));
}

function resolveListId(input: OrbitInput): string | undefined {
  if (input.source !== "list") return undefined;
  const listId = input.listId ? parseListId(input.listId) : null;
  if (!listId) throw new Error("invalid X list URL or ID");
  return listId;
}

interface NewOrbitRow {
  id: string;
  wallet: string;
  source: TrackSource;
  title: string;
  topic: string | null;
  criteria: string;
  upgradedCriteria: string;
  listId: string | null;
  notifyTelegram: boolean;
  generatedQuery: string;
  pollIntervalMs: number;
  storageRoot: string | null;
  createdAt: number;
  updatedAt: number;
}

function insertOrbitRow(row: NewOrbitRow): void {
  const db = getDb();
  const cols = orbitColumnNames(db);

  const data: Record<string, unknown> = {
    id: row.id,
    wallet: row.wallet,
    source: row.source,
    title: row.title,
    topic: row.topic,
    criteria: row.criteria,
    upgraded_criteria: row.upgradedCriteria,
    list_id: row.listId,
    notify_telegram: row.notifyTelegram ? 1 : 0,
    generated_query: row.generatedQuery,
    query_version: 1,
    poll_interval_ms: row.pollIntervalMs,
    last_polled_at: null,
    paused: 0,
    storage_root: row.storageRoot,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };

  if (cols.has("intent")) {
    data.intent = row.topic ?? row.title;
  }
  if (cols.has("watch_type")) {
    data.watch_type = row.source === "list" ? "lists" : "search";
  }
  if (cols.has("mode")) {
    data.mode = row.notifyTelegram ? "live" : "digest";
  }

  const keys = Object.keys(data).filter((key) => cols.has(key));
  const values = keys.map((key) => data[key]);
  const placeholders = keys.map(() => "?").join(", ");

  db.prepare(`INSERT INTO orbits (${keys.join(", ")}) VALUES (${placeholders})`).run(...values);
}

export async function createOrbit(input: OrbitInput): Promise<Orbit> {
  const listId = resolveListId(input);
  const topic = input.source === "custom" ? (input.topic?.trim() || input.title.trim()) : undefined;
  const upgradedCriteria = await buildUpgradedCriteria({
    title: input.title,
    topic,
    criteria: input.criteria,
    source: input.source,
  });
  const generatedQuery = await resolveGeneratedQuery(input.source, upgradedCriteria, listId ?? undefined);
  const config = loadConfig();
  const pollIntervalMs = input.pollIntervalMs ?? config.GLOBAL_POLL_INTERVAL_MS;
  const id = randomUUID();
  const now = Date.now();

  insertOrbitRow({
    id,
    wallet: input.wallet,
    source: input.source,
    title: input.title.trim(),
    topic: topic ?? null,
    criteria: input.criteria.trim(),
    upgradedCriteria,
    listId: listId ?? null,
    notifyTelegram: input.notifyTelegram,
    generatedQuery,
    pollIntervalMs,
    storageRoot: input.storageRoot ?? null,
    createdAt: now,
    updatedAt: now,
  });

  logger.info({ id, wallet: input.wallet, source: input.source, query: generatedQuery, listId }, "orbit created");
  const orbit = getOrbit(id)!;
  scheduleOrbitStorage(orbit);
  return orbit;
}

export function getOrbit(id: string): Orbit | null {
  const row = getDb().prepare("SELECT * FROM orbits WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToOrbit(row) : null;
}

export function listOrbits(wallet: string): Orbit[] {
  const rows = getDb()
    .prepare("SELECT * FROM orbits WHERE wallet = ? ORDER BY created_at DESC")
    .all(wallet) as Record<string, unknown>[];
  return rows.map(rowToOrbit);
}

export async function updateOrbit(id: string, update: OrbitUpdate): Promise<Orbit | null> {
  const current = getOrbit(id);
  if (!current) return null;

  const title = update.title?.trim() ?? current.title;
  const topic =
    update.topic !== undefined ? update.topic.trim() || undefined : current.topic;
  const criteria = update.criteria?.trim() ?? current.criteria;
  const listId = update.listId !== undefined ? parseListId(update.listId) ?? update.listId : current.listId;
  const notifyTelegram = update.notifyTelegram ?? current.notifyTelegram;
  const paused = update.paused ?? current.paused;
  const pollIntervalMs = update.pollIntervalMs ?? current.pollIntervalMs;

  const configChanged =
    update.title !== undefined ||
    update.topic !== undefined ||
    update.criteria !== undefined ||
    update.listId !== undefined;

  let upgradedCriteria = current.upgradedCriteria;
  let generatedQuery = current.generatedQuery;
  let queryVersion = current.queryVersion;

  if (configChanged) {
    upgradedCriteria = await buildUpgradedCriteria({
      title,
      topic,
      criteria,
      source: current.source,
    });
    if (current.source === "custom") {
      generatedQuery = await resolveGeneratedQuery("custom", upgradedCriteria);
      queryVersion += 1;
    } else if (current.source === "list" && listId) {
      generatedQuery = buildListFeedQueryBase(listId);
      queryVersion += 1;
    }
  }

  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE orbits SET
        title = ?, topic = ?, criteria = ?, upgraded_criteria = ?, list_id = ?, notify_telegram = ?,
        generated_query = ?, query_version = ?, paused = ?, poll_interval_ms = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      title,
      topic ?? null,
      criteria,
      upgradedCriteria ?? null,
      listId ?? null,
      notifyTelegram ? 1 : 0,
      generatedQuery,
      queryVersion,
      paused ? 1 : 0,
      pollIntervalMs,
      now,
      id,
    );
  const updated = getOrbit(id);
  if (updated) scheduleOrbitStorage(updated);
  return updated;
}

export function deleteOrbit(id: string): boolean {
  const info = getDb().prepare("DELETE FROM orbits WHERE id = ?").run(id);
  return info.changes > 0;
}

/** Active orbits queued oldest-poll-first (never-polled first). */
export function getActiveOrbits(): Orbit[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM orbits WHERE paused = 0
       ORDER BY last_polled_at IS NULL DESC, last_polled_at ASC, created_at ASC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map(rowToOrbit);
}

export function markOrbitPolled(id: string, polledAt: number): void {
  getDb()
    .prepare("UPDATE orbits SET last_polled_at = ?, updated_at = ? WHERE id = ?")
    .run(polledAt, polledAt, id);
}

export function getUpgradedCriteria(orbit: Orbit): string {
  if (orbit.upgradedCriteria?.trim()) return orbit.upgradedCriteria.trim();
  return fallbackUpgradedCriteria(orbit.title, orbit.topic, orbit.criteria);
}

/** Regenerate stored query when stale (custom keywords or list feed template). */
export async function refreshOrbitQueryIfStale(orbit: Orbit): Promise<Orbit> {
  if (orbit.source === "list" && orbit.listId) {
    const expected = buildListFeedQueryBase(orbit.listId);
    if (orbit.generatedQuery === expected) return orbit;

    const now = Date.now();
    getDb()
      .prepare(
        `UPDATE orbits SET generated_query = ?, query_version = query_version + 1, updated_at = ? WHERE id = ?`,
      )
      .run(expected, now, orbit.id);

    logger.info(
      { id: orbit.id, oldQuery: orbit.generatedQuery, newQuery: expected },
      "regenerated list feed query",
    );
    return getOrbit(orbit.id) ?? orbit;
  }

  if (orbit.source !== "custom" || !needsQueryRegeneration(orbit.generatedQuery)) {
    return orbit;
  }

  const upgradedCriteria = getUpgradedCriteria(orbit);
  const generatedQuery = await resolveGeneratedQuery("custom", upgradedCriteria);
  if (!generatedQuery || generatedQuery === orbit.generatedQuery) return orbit;

  const now = Date.now();
  getDb()
    .prepare(
      `UPDATE orbits SET generated_query = ?, query_version = query_version + 1, updated_at = ? WHERE id = ?`,
    )
    .run(generatedQuery, now, orbit.id);

  logger.info(
    { id: orbit.id, oldQuery: orbit.generatedQuery, newQuery: generatedQuery },
    "regenerated legacy search query",
  );
  return getOrbit(orbit.id) ?? orbit;
}
