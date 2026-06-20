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

export function welcomeMessage(): string {
  return [
    "<b>Welcome to Orbit</b>",
    "",
    "Set up orbits in the app to watch X lists or topics. Matching posts land on your dashboard. Turn on Telegram alerts to get them here too.",
    "",
    "<b>Link this chat</b>",
    "1. Open Orbit and connect your wallet",
    "2. Alerts → Generate Telegram link",
    "3. Open the link here and tap Start",
    "",
    "<b>Commands</b>",
    "/orbits — your orbits",
    "/pause — stop polling",
    "/resume — start polling",
    "/help — full guide",
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

function orbitStatusLine(paused: number, notifyTelegram: number): string {
  const polling = paused ? "Paused" : "Active";
  const delivery = notifyTelegram ? "Telegram alerts" : "Dashboard only";
  return `${polling} · ${delivery}`;
}

function formatOrbitBlock(index: number, title: string, paused: number, notifyTelegram: number): string {
  const name = escapeHtml(title.trim() || "Untitled orbit");
  return `${index}. <b>${name}</b>\n${orbitStatusLine(paused, notifyTelegram)}`;
}

export function orbitsListMessage(orbits: OrbitRow[]): string {
  const count = orbits.length;
  const header = count === 1 ? "<b>Your orbit</b>" : `<b>Your orbits</b> (${count})`;
  const blocks = orbits.map((o, i) => formatOrbitBlock(i + 1, o.title, o.paused, o.notify_telegram));

  return [
    header,
    "",
    blocks.join("\n\n"),
    "",
    "<b>Manage</b>",
    "/pause — stop polling",
    "/resume — start polling",
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

export function pausePickerMessage(activeCount = 1): string {
  const countLine =
    activeCount === 1
      ? "You have <b>1 active orbit</b> checking X."
      : `You have <b>${activeCount} active orbits</b> checking X.`;
  return [
    "<b>Pause an orbit</b>",
    "",
    countLine,
    "",
    "Pausing stops new checks and alerts. Your dashboard stays as it is.",
    "",
    "Tap an orbit below to pause it.",
  ].join("\n");
}

export function resumePickerMessage(pausedCount = 1): string {
  const countLine =
    pausedCount === 1
      ? "You have <b>1 paused orbit</b>."
      : `You have <b>${pausedCount} paused orbits</b>.`;
  return [
    "<b>Resume an orbit</b>",
    "",
    countLine,
    "",
    "Resuming turns polling back on. New matches go to your dashboard and here if Telegram alerts are on.",
    "",
    "Tap an orbit below to resume it.",
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
  const name = escapeHtml(title);
  return [
    "<b>Paused</b>",
    "",
    name,
    "Polling stopped. Your dashboard is unchanged.",
    "",
    "/resume when you want to start again.",
  ].join("\n");
}

export function resumeSuccessMessage(title: string): string {
  const name = escapeHtml(title);
  return [
    "<b>Resumed</b>",
    "",
    name,
    "Polling again. New matches go to your dashboard and here if Telegram alerts are on.",
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
  const url = escapeHtml(alert.tweet.url);
  const handle = alert.tweet.author.replace(/^@/, "").trim();
  const displayName = escapeHtml(alert.tweet.authorName?.trim() || handle);
  const profileUrl = handle ? escapeHtml(`https://x.com/${handle}`) : null;
  const authorLine =
    handle && profileUrl ? `<a href="${profileUrl}">${displayName}</a>` : null;

  const lines = [`🔔 <b>${title}</b>`, ""];
  if (authorLine) lines.push(authorLine, "");
  lines.push(summary, "", `<a href="${url}">View on X</a>`);
  return lines.join("\n");
}
