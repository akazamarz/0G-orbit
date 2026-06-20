import type { AlertCursor } from "@orbit/shared";

export function encodeAlertCursor(cursor: AlertCursor): string {
  return `${cursor.createdAt}:${encodeURIComponent(cursor.id)}`;
}
