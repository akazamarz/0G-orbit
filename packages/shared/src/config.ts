import { z } from "zod";

const envSchema = z.object({
  AI_BASE_URL: z.string().url(),
  AI_API_KEY: z.string().min(1),
  AI_MODEL_CHAT: z.string().default("deepseek-chat"),
  AI_MODEL_REASONER: z.string().default("deepseek-reasoner"),

  SERVER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "must be a 0x-prefixed 32-byte hex private key"),

  ZG_CHAIN_RPC: z.string().url(),
  ZG_CHAIN_ID: z.coerce.number().int().positive(),

  ZG_STORAGE_INDEXER: z.string().url(),
  ZG_STORAGE_FLOW: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ZG_STORAGE_MINE: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ZG_STORAGE_REWARD: z.string().regex(/^0x[a-fA-F0-9]{40}$/),

  ZG_DA_ENTRANCE: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ORBIT_ATTESTATION_ADDRESS: z
    .string()
    .optional()
    .refine((v) => !v || /^0x[a-fA-F0-9]{40}$/.test(v)),
  ATTESTATION_SIGN_DEADLINE_MS: z.coerce.number().int().positive().default(604800000),

  X_API_KEY: z.string().min(1),
  X_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(300000),

  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().min(1),

  JWT_SECRET: z.string().min(16),
  NEXT_PUBLIC_AGENT_BASE_URL: z.string().url().default("http://127.0.0.1:4000"),

  INTERNAL_API_SECRET: z.string().min(16),
  AGENT_HOST: z.string().default("127.0.0.1"),
  AGENT_PORT: z.coerce.number().int().positive().default(4000),
  DB_PATH: z.string().default("./data/orbit.db"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadConfig(source: Record<string, string | undefined> = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetConfig(): void {
  cached = null;
}
