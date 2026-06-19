import { OrbitError } from "./errors.js";
import { logger } from "./logger.js";

export async function retry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const { retries = 3, baseDelayMs = 500, label = "operation" } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = baseDelayMs * 2 ** attempt;
        logger.warn({ err, attempt, delay, label }, "retry scheduled");
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new OrbitError(`${label} failed after ${retries + 1} attempts`, "RETRY", lastError);
}
