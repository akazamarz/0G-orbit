import { InlineKeyboard } from "grammy";

export interface OrbitOption {
  id: string;
  title: string;
}

const BUTTON_LABEL_MAX = 48;

function orbitButtonLabel(title: string): string {
  const name = title.trim() || "Untitled orbit";
  return name.length > BUTTON_LABEL_MAX ? `${name.slice(0, BUTTON_LABEL_MAX - 1)}…` : name;
}

export function buildOrbitPickerKeyboard(
  action: "pause" | "resume",
  orbits: OrbitOption[],
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const orbit of orbits) {
    keyboard.text(orbitButtonLabel(orbit.title), `${action}:${orbit.id}`).row();
  }
  return keyboard;
}
