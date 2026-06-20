import { z } from "zod";

const webappEnvSchema = z.object({
  JWT_SECRET: z.string().min(16),
  INTERNAL_API_SECRET: z.string().min(16),
  NEXT_PUBLIC_AGENT_BASE_URL: z.string().url().default("http://127.0.0.1:4000"),
});

export type WebappEnv = z.infer<typeof webappEnvSchema>;

let cached: WebappEnv | null = null;

/** Env required by the Next.js server (API routes). Agent-only vars are not needed on Vercel. */
export function loadWebappConfig(source?: Record<string, string | undefined>): WebappEnv {
  if (cached) return cached;
  const parsed = webappEnvSchema.safeParse(source ?? process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid webapp environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
