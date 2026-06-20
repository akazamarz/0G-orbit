import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import {
  type HealthResponse,
  type SubscriptionInput,
  type SubscriptionUpdate,
  type FeedbackRequest,
  type SignAttestationRequest,
  type UpdateWalletTelegramRequest,
} from "@orbit/shared";
import {
  verifyInternalSecret,
  handleCreateSubscription,
  handleUpdateSubscription,
  handleDeleteSubscription,
  handleListSubscriptions,
  listAlertFeed,
  parseAlertCursor,
  recordFeedback,
  handleCreateTelegramLink,
  handleGetWalletTelegram,
  handleUpdateWalletTelegram,
  handleUnlinkWalletTelegram,
  handleListPendingAttestations,
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
    subscriptions: 0,
    version: "0.1.0",
  };
  return c.json(res);
});

app.post("/internal/subscriptions", secretMiddleware, async (c) => {
  const body = (await c.req.json()) as SubscriptionInput;
  const sub = await handleCreateSubscription(body);
  return c.json(sub, 201);
});

app.get("/internal/subscriptions", secretMiddleware, (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet required" }, 400);
  return c.json(handleListSubscriptions(wallet));
});

app.patch("/internal/subscriptions/:id", secretMiddleware, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "invalid id" }, 400);
  const body = (await c.req.json()) as SubscriptionUpdate;
  const sub = await handleUpdateSubscription(id, body);
  if (!sub) return c.json({ error: "not found" }, 404);
  return c.json(sub);
});

app.delete("/internal/subscriptions/:id", secretMiddleware, (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "invalid id" }, 400);
  const ok = handleDeleteSubscription(id);
  if (!ok) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

app.get("/internal/alerts", secretMiddleware, (c) => {
  const wallet = c.req.query("wallet");
  if (!wallet) return c.json({ error: "wallet required" }, 400);
  const subscriptionId = c.req.query("subscriptionId") || undefined;
  const limit = Number(c.req.query("limit") ?? 20);
  const before = parseAlertCursor(c.req.query("before"));
  const after = parseAlertCursor(c.req.query("after"));
  return c.json(
    listAlertFeed({
      wallet,
      subscriptionId,
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
