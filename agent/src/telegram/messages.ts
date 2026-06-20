import type { Alert } from "@orbit/shared";

export const HTML_REPLY = {
  parse_mode: "HTML" as const,
  link_preview_options: { is_disabled: true },
};

/** Shown in Telegram's / command menu (setMyCommands). */
export const BOT_COMMAND_MENU = [
  { command: "start", description: "Link wallet or get started" },
  { command: "orbits", description: "List your orbits" },
  { command: "pause", description: "Pause an orbit" },
  { command: "resume", description: "Resume a paused orbit" },
  { command: "feedback", description: "How to rate alerts" },
  { command: "help", description: "Show command guide" },
] as const;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function formatAuthor(author: string): string {
  return author.startsWith("@") ? author : `@${author}`;
}

function scoreLabel(score: number): string {
  const rounded = Math.round(score);
  if (rounded >= 85) return `${rounded}/100 · Strong match`;
  if (rounded >= 70) return `${rounded}/100 · Likely match`;
  return `${rounded}/100`;
}

export function welcomeMessage(): string {
  return [
    "<b>Welcome to Orbit</b>",
    "",
    "Orbit watches X for posts that fit your criteria and sends you signals here when something matters.",
    "",
    "<b>To get started</b>",
    "1. Open the Orbit app and connect your wallet",
    "2. Go to <b>Alerts</b> and tap <b>Generate Telegram link</b>",
    "3. Open the link here and tap <b>Start</b>",
    "",
    "<b>Commands</b>",
    "/orbits — list your orbits",
    "/pause — pick an orbit to pause",
    "/resume — pick an orbit to resume",
    "/help — show this guide again",
  ].join("\n");
}

export function linkSuccessMessage(wallet: string, firstName?: string): string {
  const greeting = firstName ? `Hi ${escapeHtml(firstName)}! ` : "";
  return [
    `${greeting}<b>Telegram is linked</b> ✅`,
    "",
    `Wallet: <code>${escapeHtml(formatWallet(wallet))}</code>`,
    "",
    "You'll receive alerts here when a <b>push-enabled orbit</b> finds a post on X that matches your criteria.",
    "",
    "<b>What you can do here</b>",
    "• /orbits — see your orbits by name",
    "• /pause — pick an orbit to stop polling",
    "• /resume — pick a paused orbit to start again",
    "",
    "Mute all Telegram alerts or unlink anytime from <b>Alerts</b> in the Orbit app.",
  ].join("\n");
}

export function linkFailedMessage(): string {
  return [
    "<b>Link could not be completed</b> ❌",
    "",
    "This usually means the link expired (links last 10 minutes), was already used, or was opened in the wrong chat.",
    "",
    "<b>Try again</b>",
    "1. Open the Orbit app → <b>Alerts</b>",
    "2. Tap <b>Generate Telegram link</b>",
    "3. Open the new link and tap <b>Start</b>",
  ].join("\n");
}

export function notLinkedMessage(): string {
  return [
    "<b>Wallet not linked yet</b>",
    "",
    "Connect Telegram from the Orbit app first:",
    "1. Open Orbit → <b>Alerts</b>",
    "2. Generate a link and tap <b>Start</b> in this chat",
    "",
    "After linking, you can use /orbits, /pause, and /resume here.",
  ].join("\n");
}

export interface OrbitRow {
  id: string;
  title: string;
  paused: number;
  notify_telegram: number;
}

export function orbitsListMessage(orbits: OrbitRow[]): string {
  const lines = orbits.map((o) => {
    const status = o.paused ? "⏸ Paused" : "🟢 Active";
    const delivery = o.notify_telegram ? "Telegram + feed" : "Feed only";
    const name = escapeHtml(o.title.trim() || "Untitled orbit");
    return `${status} · <b>${name}</b>\n   ${delivery}`;
  });

  return [
    `<b>Your orbits</b> (${orbits.length})`,
    "",
    lines.join("\n\n"),
    "",
    "<b>Manage from chat</b>",
    "/pause — pick an orbit to stop polling",
    "/resume — pick a paused orbit to start again",
  ].join("\n");
}

export function noOrbitsMessage(): string {
  return [
    "<b>No orbits yet</b>",
    "",
    "Create an orbit in the Orbit app to start watching a list or custom topic on X.",
    "",
    "Enable <b>Push to Telegram</b> when creating an orbit if you want alerts delivered here.",
  ].join("\n");
}

export function pausePickerMessage(): string {
  return [
    "<b>Pause an orbit</b>",
    "",
    "Tap the orbit you want to stop polling:",
  ].join("\n");
}

export function resumePickerMessage(): string {
  return [
    "<b>Resume an orbit</b>",
    "",
    "Tap a paused orbit to start polling again:",
  ].join("\n");
}

export function noActiveOrbitsToPauseMessage(): string {
  return [
    "<b>Nothing to pause</b>",
    "",
    "All your orbits are already paused.",
    "",
    "Use /resume to pick one to start again, or /orbits to see the full list.",
  ].join("\n");
}

export function noPausedOrbitsMessage(): string {
  return [
    "<b>No paused orbits</b>",
    "",
    "Every orbit on your wallet is already active.",
    "",
    "Use /pause to pick one to stop, or /orbits to see the full list.",
  ].join("\n");
}

export function pauseSuccessMessage(title: string): string {
  return [
    "<b>Orbit paused</b> ⏸",
    "",
    `<b>${escapeHtml(title)}</b> will stop polling until you resume it.`,
    "",
    "Alerts already on your dashboard are unchanged. Resume anytime with /resume.",
  ].join("\n");
}

export function resumeSuccessMessage(title: string): string {
  return [
    "<b>Orbit resumed</b> ▶️",
    "",
    `<b>${escapeHtml(title)}</b> is polling again.`,
    "",
    "If push is enabled, new matches will be delivered here and on your dashboard.",
  ].join("\n");
}

export function feedbackMessage(): string {
  return [
    "<b>Alert feedback</b>",
    "",
    "React to any alert message with 👍 or 👎 to help Orbit learn what signals matter to you.",
    "",
    "Feedback applies to the specific alert you react to — not your whole orbit.",
  ].join("\n");
}

export function helpMessage(): string {
  return [
    "<b>Orbit bot commands</b>",
    "",
    "/orbits — list orbits on your linked wallet",
    "/pause — pick an orbit to stop polling",
    "/resume — pick a paused orbit to resume",
    "/feedback — how to rate alerts",
    "/help — show this message",
    "",
    "<b>Alerts &amp; settings</b>",
    "Manage Telegram delivery, mute all alerts, or unlink from <b>Alerts</b> in the Orbit app.",
    "",
    "<b>About alerts</b>",
    "Only orbits with <b>Push to Telegram</b> enabled send messages here. All matches still appear on your dashboard.",
  ].join("\n");
}

export function formatAlertMessage(alert: Alert, orbitTitle?: string): string {
  const title = escapeHtml(orbitTitle?.trim() || "Untitled orbit");
  const summary = escapeHtml(alert.summary);
  const author = escapeHtml(formatAuthor(alert.tweet.author));
  const url = escapeHtml(alert.tweet.url);

  return [
    "🛰 <b>New orbit signal</b>",
    "",
    `<b>Orbit:</b> ${title}`,
    `<b>Match:</b> ${scoreLabel(alert.score)}`,
    "",
    summary,
    "",
    `${author} · <a href="${url}">View on X</a>`,
  ].join("\n");
}
