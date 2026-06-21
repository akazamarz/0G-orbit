import { InlineKeyboard } from "grammy";

/** Telegram inline button label limit (display truncation). */
export const BUTTON_LABEL_MAX = 48;

/** Telegram callback_data byte limit. */
export const CALLBACK_DATA_MAX = 64;

export interface InlineButton {
  label: string;
  callbackData: string;
}

export function truncateButtonLabel(label: string, fallback = "Untitled"): string {
  const text = label.trim() || fallback;
  return text.length > BUTTON_LABEL_MAX ? `${text.slice(0, BUTTON_LABEL_MAX - 1)}…` : text;
}

/** One button per row - reusable for any picker-style keyboard. */
export function inlineKeyboardColumn(buttons: InlineButton[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const button of buttons) {
    keyboard.text(button.label, button.callbackData).row();
  }
  return keyboard;
}

export interface DecodedCallback {
  namespace: string;
  action: string;
  payload: string;
}

/** Namespaced callback payload: `namespace:action:payload` */
export function encodeCallbackData(namespace: string, action: string, payload: string): string {
  if (namespace.includes(":") || action.includes(":")) {
    throw new Error("callback namespace and action must not contain ':'");
  }
  const data = `${namespace}:${action}:${payload}`;
  if (data.length > CALLBACK_DATA_MAX) {
    throw new Error(`callback_data exceeds Telegram ${CALLBACK_DATA_MAX}-byte limit`);
  }
  return data;
}

export function decodeCallbackData(data: string): DecodedCallback | null {
  const first = data.indexOf(":");
  const second = data.indexOf(":", first + 1);
  if (first <= 0 || second <= first + 1 || second >= data.length - 1) return null;
  return {
    namespace: data.slice(0, first),
    action: data.slice(first + 1, second),
    payload: data.slice(second + 1),
  };
}
