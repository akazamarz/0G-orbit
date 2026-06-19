import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

let loaded = false;

/** Load the nearest `.env` walking up from cwd (monorepo root when run from agent/ or webapp/). */
export function loadEnvFile(): void {
  if (loaded) return;
  loaded = true;

  const envPath = findEnvFile();
  if (envPath) {
    config({ path: envPath });
  }
}

function findEnvFile(): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}
