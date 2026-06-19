import type { WatchType } from "@orbit/shared";

export interface Template {
  id: string;
  label: string;
  watchType: WatchType;
  intent: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "track-vc",
    label: "Track a VC",
    watchType: "accounts",
    intent: "Funding announcements and investment theses from this account",
  },
  {
    id: "follow-topic",
    label: "Follow a topic",
    watchType: "topics",
    intent: "Breaking news and high-signal discussion about this topic",
  },
  {
    id: "monitor-founder",
    label: "Monitor a founder",
    watchType: "accounts",
    intent: "Product launches, milestones, and notable takes from this founder",
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
