import { useCallback, useEffect, useRef, useState } from "react";
import { encodeAlertCursor } from "@/lib/alert-cursor";
import type { Alert, AlertCursor, AlertFeedResponse } from "@orbit/shared";

const DEFAULT_PAGE_SIZE = 20;

interface Options {
  orbitId?: string;
  pageSize?: number;
  pollIntervalMs?: number;
  enabled?: boolean;
}

function prependAlerts(existing: Alert[], incoming: Alert[]): Alert[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((a) => a.id));
  const fresh = incoming.filter((a) => !seen.has(a.id));
  return fresh.length > 0 ? [...fresh, ...existing] : existing;
}

function appendAlerts(existing: Alert[], incoming: Alert[]): Alert[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((a) => a.id));
  const older = incoming.filter((a) => !seen.has(a.id));
  return older.length > 0 ? [...existing, ...older] : existing;
}

async function fetchAlertFeed(query: Record<string, string>): Promise<AlertFeedResponse> {
  const params = new URLSearchParams(query);
  const res = await fetch(`/api/alerts?${params}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Failed to load alerts");
  }
  return data as AlertFeedResponse;
}

export function useAlertFeed({
  orbitId,
  pageSize = DEFAULT_PAGE_SIZE,
  pollIntervalMs,
  enabled = true,
}: Options) {
  const [items, setItems] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<AlertCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newestRef = useRef<AlertCursor | null>(null);
  const hasItemsRef = useRef(false);

  useEffect(() => {
    if (items.length > 0) {
      newestRef.current = { createdAt: items[0].createdAt, id: items[0].id };
      hasItemsRef.current = true;
    } else {
      newestRef.current = null;
      hasItemsRef.current = false;
    }
  }, [items]);

  const baseQuery = useCallback((): Record<string, string> => {
    const q: Record<string, string> = { limit: String(pageSize) };
    if (orbitId) q.orbitId = orbitId;
    return q;
  }, [pageSize, orbitId]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const feed = await fetchAlertFeed(baseQuery());
      setItems(feed.items);
      setTotal(feed.total);
      setNextCursor(feed.nextCursor);
      setHasMore(feed.hasMore);
    } catch (err) {
      setError((err as Error).message);
      setItems([]);
      setTotal(0);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [baseQuery]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const feed = await fetchAlertFeed({
        ...baseQuery(),
        before: encodeAlertCursor(nextCursor),
      });
      setItems((prev) => appendAlerts(prev, feed.items));
      setNextCursor(feed.nextCursor);
      setHasMore(feed.hasMore);
      setTotal(feed.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [baseQuery, hasMore, nextCursor, loadingMore]);

  const pollNew = useCallback(async () => {
    try {
      if (!hasItemsRef.current || !newestRef.current) {
        await loadInitial();
        return;
      }
      const feed = await fetchAlertFeed({
        ...baseQuery(),
        after: encodeAlertCursor(newestRef.current),
      });
      if (feed.items.length > 0) {
        setItems((prev) => prependAlerts(prev, feed.items));
        setTotal(feed.total);
      }
    } catch {
      // ignore poll errors
    }
  }, [baseQuery, loadInitial]);

  useEffect(() => {
    if (!enabled) return;
    void loadInitial();
  }, [enabled, loadInitial]);

  useEffect(() => {
    if (!enabled || !pollIntervalMs) return;
    const interval = setInterval(() => void pollNew(), pollIntervalMs);
    return () => clearInterval(interval);
  }, [enabled, pollIntervalMs, pollNew]);

  return {
    items,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
    reload: loadInitial,
  };
}
