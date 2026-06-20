import type { TrackSource } from "@orbit/shared";

export interface Template {
  id: string;
  label: string;
  source: TrackSource;
  title: string;
  criteria: string;
}

export const TEMPLATES: Template[] = [
  {
    id: "ai-releases",
    label: "AI model releases",
    source: "custom",
    title: "New AI model releases",
    criteria: "Announcements of new LLM or multimodal model launches from labs and vendors",
  },
  {
    id: "vc-funding",
    label: "VC funding",
    source: "custom",
    title: "Startup funding rounds",
    criteria: "Seed through Series B announcements with round size and lead investors",
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
