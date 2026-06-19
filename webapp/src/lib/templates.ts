import type { WatchType } from "@orbit/shared";

export interface OrbitTemplate {
  id: string;
  label: string;
  watchType: WatchType;
  intent: string;
}

export const ORBIT_TEMPLATES: OrbitTemplate[] = [
  {
    id: "track-vc",
    label: "Track a VC",
    watchType: "accounts",
    intent: "Funding announcements and investment theses from top VCs",
  },
  {
    id: "follow-topic",
    label: "Follow a topic",
    watchType: "topics",
    intent: "Breaking news and high-signal discussion about AI agents",
  },
  {
    id: "monitor-founder",
    label: "Monitor a founder",
    watchType: "accounts",
    intent: "Product launches, milestones, and notable takes from crypto founders",
  },
];
