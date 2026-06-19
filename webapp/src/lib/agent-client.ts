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

  let url = `${config.NEXT_PUBLIC_AGENT_BASE_URL}${path}`;
  if (opts.wallet) {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("wallet")) {
      parsed.searchParams.set("wallet", opts.wallet);
    }
    url = parsed.toString();
  }

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { error?: string };
      throw new AgentError(json.error ?? text, res.status);
    } catch (e) {
      if (e instanceof AgentError) throw e;
      throw new AgentError(text, res.status);
    }
  }
  return (await res.json()) as T;
}
