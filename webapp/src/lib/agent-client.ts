import { loadConfig } from "@orbit/shared";

const config = loadConfig();

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export async function agentFetch<T>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    wallet?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "x-internal-secret": config.INTERNAL_API_SECRET,
  };
  if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (opts.wallet) {
    headers["x-user-wallet"] = opts.wallet;
  }

  const res = await fetch(`${config.NEXT_PUBLIC_AGENT_BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    throw new AgentError(await res.text(), res.status);
  }
  return (await res.json()) as T;
}
