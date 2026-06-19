import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { type HealthResponse, type SubscriptionInput, type SubscriptionUpdate, type FeedbackRequest, type LinkTelegramRequest } from "@orbit/shared";
import { verifyInternalSecret, handleCreateSubscription, handleUpdateSubscription, handleDeleteSubscription, handleListSubscriptions, listAlerts, recordFeedback, handleCreateTelegramLink, handleLinkTelegram } from "./handlers.js";
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
  const sub = handleUpdateSubscription(id, body);
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
  const since = Number(c.req.query("since") ?? 0);
  const limit = Number(c.req.query("limit") ?? 50);
  return c.json(listAlerts(wallet, since, limit));
});

app.post("/internal/feedback", secretMiddleware, async (c) => {
  const body = (await c.req.json()) as FeedbackRequest;
  const fb = recordFeedback(body.wallet, body.alertId, body.rating);
  return c.json(fb, 201);
});

app.post("/internal/telegram/link", secretMiddleware, async (c) => {
  const body = (await c.req.json()) as { wallet: string };
  return c.json(handleCreateTelegramLink(body.wallet), 201);
});

app.post("/internal/link-telegram", secretMiddleware, async (c) => {
  const body = (await c.req.json()) as LinkTelegramRequest;
  const wallet = handleLinkTelegram(body.nonce, body.chatId);
  if (!wallet) return c.json({ error: "invalid or expired nonce" }, 400);
  return c.json({ ok: true, wallet });
});

export { app };
