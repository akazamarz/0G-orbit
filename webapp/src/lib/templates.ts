import type { TrackSource } from "@orbit/shared";

export interface OrbitTemplate {
  id: string;
  label: string;
  source: TrackSource;
  title: string;
  criteria: string;
}

export const ORBIT_TEMPLATES: OrbitTemplate[] = [
  {
    id: "ai-releases",
    label: "AI model releases",
    source: "custom",
    title: "New AI model releases",
    criteria: "Announcements of new LLM or multimodal model launches, benchmarks, or API availability from labs and vendors",
  },
  {
    id: "vc-funding",
    label: "VC funding",
    source: "custom",
    title: "Startup funding rounds",
    criteria: "Seed through Series B announcements, notable investors, and round size from credible sources",
  },
  {
    id: "crypto-launches",
    label: "Crypto launches",
    source: "custom",
    title: "Crypto product launches",
    criteria: "Mainnet launches, token listings, protocol upgrades, and milestone announcements from founders and official accounts",
  },
];
