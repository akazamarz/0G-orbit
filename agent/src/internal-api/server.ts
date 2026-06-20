import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import {
  type HealthResponse,
  type OrbitInput,
  type OrbitUpdate,
  type FeedbackRequest,
  type SignAttestationRequest,
  type UpdateWalletTelegramRequest,
} from "@orbit/shared";
import {
  verifyInternalSecret,
  handleCreateOrbit,
  handleUpdateOrbit,
  handleDeleteOrbit,
  handleListOrbits,
  listAlertFeed,
  parseAlertCursor,
  recordFeedback,
  handleCreateTelegramLink,
  handleGetWalletTelegram,
  handleUpdateWalletTelegram,
  handleUnlinkWalletTelegram,
  handleListPendingAttestations,
  handleGetAttestationStatus,
  handleCreateAttestationBatch,
  handleSubmitAttestation,
} from "./handlers.js";
import { logger } from "../utils/logger.js";

const app = new Hono();
const startedAt = Date.now();

const secretMiddleware: MiddlewareHandler = async (c, next) => {
  if (!verifyInternalSecret(c.req.header("x-internal-secret"))) {
    logger.warn({ path: c.req.path }, "unauthorized internal request");
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
};

app.get("/internal/health", (c) => {
  const res: HealthResponse = {
    status: "ok",
    uptime: Date.now() - startedAt,
    orbits: 0,
    version: "0.1.0",
  };
  return c.json(res);
});

app.post("/internal/orbits", secretMiddleware, async (c) => {
  try {
    const body = (await c.req.json()) as OrbitInput;
    const orbit = await handleCreateOrbit(body);
    return c.json(orbit, 201);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return c.json({ error: (err as Error).message }, status as 403 | 500);
  }
});

app.get("/internal/orbits", secretMiddleware, (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet required" }, 400);
  return c.json(handleListOrbits(wallet));
});

app.patch("/internal/orbits/:id", secretMiddleware, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "invalid id" }, 400);
  const body = (await c.req.json()) as OrbitUpdate;
  const orbit = await handleUpdateOrbit(id, body);
  if (!orbit) return c.json({ error: "not found" }, 404);
  return c.json(orbit);
});

app.delete("/internal/orbits/:id", secretMiddleware, (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "invalid id" }, 400);
  const ok = handleDeleteOrbit(id);
  if (!ok) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

app.get("/internal/alerts", secretMiddleware, (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet required" }, 400);
  const orbitId = c.req.query("orbitId") || undefined;
  const limit = Number(c.req.query("limit") ?? 20);
  const before = parseAlertCursor(c.req.query("before"));
  const after = parseAlertCursor(c.req.query("after"));
  return c.json(
    listAlertFeed({
      wallet,
      orbitId,
      limit: Number.isFinite(limit) ? limit : 20,
      before,
      after,
    }),
  );
});

app.post("/internal/feedback", secretMiddleware, async (c) => {
  const body = (await c.req.json()) as FeedbackRequest;
  const fb = recordFeedback(body.wallet, body.alertId, body.rating);
  return c.json(fb, 201);
});

app.get("/internal/telegram", secretMiddleware, (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet required" }, 400);
  return c.json(handleGetWalletTelegram(wallet));
});

app.patch("/internal/telegram", secretMiddleware, async (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet required" }, 400);
  const body = (await c.req.json()) as UpdateWalletTelegramRequest;
  const status = handleUpdateWalletTelegram(wallet, body);
  if (!status) return c.json({ error: "not linked" }, 404);
  return c.json(status);
});

app.post("/internal/telegram/link", secretMiddleware, async (c) => {
  const body = (await c.req.json()) as { wallet: string };
  try {
    return c.json(handleCreateTelegramLink(body.wallet), 201);
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    if (status === 409) return c.json({ error: "already linked" }, 409);
    throw err;
  }
});

app.post("/internal/telegram/unlink", secretMiddleware, async (c) => {
  const body = (await c.req.json()) as { wallet: string };
  const ok = handleUnlinkWalletTelegram(body.wallet);
  if (!ok) return c.json({ error: "not linked" }, 404);
  return c.json({ ok: true });
});

app.get("/internal/attestations/pending", secretMiddleware, (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet required" }, 400);
  return c.json(handleListPendingAttestations(wallet));
});

app.get("/internal/attestations/status", secretMiddleware, (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet required" }, 400);
  return c.json(handleGetAttestationStatus(wallet));
});

app.post("/internal/attestations/batch", secretMiddleware, async (c) => {
  const wallet = c.req.header("x-user-wallet");
  if (!wallet) return c.json({ error: "wallet required" }, 400);
  try {
    const batch = await handleCreateAttestationBatch(wallet);
    return c.json(batch, 201);
  } catch (err) {
    logger.error({ err }, "attestation batch failed");
    return c.json({ error: (err as Error).message }, 500);
  }
});

app.post("/internal/attestations/sign", secretMiddleware, async (c) => {
  const wallet = c.req.header("x-user-wallet");
  if (!wallet) return c.json({ error: "wallet required" }, 400);
  const body = (await c.req.json()) as SignAttestationRequest;
  try {
    const result = await handleSubmitAttestation(wallet, body);
    return c.json(result, 201);
  } catch (err) {
    logger.error({ err }, "attestation sign failed");
    return c.json({ error: (err as Error).message }, 500);
  }
});

export { app };
