# Orbit

AI-powered X (Twitter) intelligence agent with 0G Storage attestation, DeepSeek reasoning, and Telegram alerts.

## Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 11 (`npm i -g pnpm`)

## Setup

```bash
# Install dependencies (approve native builds when prompted)
pnpm install

# Copy and fill in environment variables
cp .env.example .env
```

Required env vars (see `.env.example`):
- `AI_API_KEY` — DeepSeek (or any OpenAI-compatible) API key
- `SERVER_PRIVATE_KEY` — 0G testnet wallet private key (funded with gas)
- `X_API_KEY` — [twitterapi.io](https://twitterapi.io) API key
- `TELEGRAM_BOT_TOKEN` — Bot token from [@BotFather](https://t.me/botfather)
- `TELEGRAM_BOT_USERNAME` — Bot username (for Telegram wallet linking)
- `JWT_SECRET` — Random string ≥ 16 chars for webapp session signing
- `INTERNAL_API_SECRET` — Random string ≥ 16 chars for webapp→agent auth

Optional: `ORBIT_ATTESTATION_ADDRESS` after deploying `OrbitAttestation.sol`.

## Run locally

```bash
# Agent + webapp in parallel
pnpm dev

# Or individually:
pnpm dev:agent                  # API server on 127.0.0.1:4000
pnpm dev:webapp                 # Next.js on 127.0.0.1:3000

# Equivalent (filter must come *before* the script name):
pnpm --filter @orbit/agent dev
pnpm --filter @orbit/webapp dev
```

The webapp proxies API calls to the agent. Both must be running together for local development.

## Verify

```bash
pnpm typecheck   # tsc across all workspaces
pnpm lint        # tsc + eslint
pnpm --filter @orbit/contracts compile   # Solidity compilation
```

## Structure

```
orbit/
├── agent/                    # TypeScript agent (Hono, tsx/tsup)
│   ├── src/
│   │   ├── 0g/              # Storage upload/download + chain attestation
│   │   ├── ai/              # DeepSeek client (OpenAI-compatible)
│   │   ├── db/              # SQLite (better-sqlite3)
│   │   ├── internal-api/    # Hono server, handler logic
│   │   ├── orbits/          # Subscription CRUD, polling runner, scheduler
│   │   ├── telegram/        # grammy bot, commands, notifications
│   │   ├── x/               # twitterapi.io client, dedup, templates
│   │   └── utils/           # logger, errors, retry
│   └── data/                # SQLite DB (auto-created)
├── webapp/                   # Next.js 16 (pages router)
│   ├── src/
│   │   ├── components/      # Colocated CSS modules per folder
│   │   ├── lib/0g/          # Browser-side Storage + chain (MetaMask)
│   │   ├── pages/           # Pages + API routes
│   │   └── styles/          # globals.css design tokens
├── contracts/                # Hardhat + OrbitAttestation.sol
├── packages/
│   └── shared/              # Types, constants, zod config schema
└── pnpm-workspace.yaml
```

## Deploy

- **Webapp** → Vercel: set `NEXT_PUBLIC_AGENT_BASE_URL` to the agent's public address.
- **Agent** → VPS: copy `.env`, run `pnpm build --filter @orbit/agent && pnpm --filter @orbit/agent start` (or use `tsx` directly for dev deploys).
- **Contract** → 0G testnet: `pnpm --filter @orbit/contracts deploy:zg` after funding the deployer wallet.
