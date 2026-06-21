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
│   │   ├── orbits/          # Orbit CRUD, polling runner, scheduler
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

Production splits the **webapp** (Vercel) and **agent** (VPS). The webapp API routes call the agent over HTTP using `NEXT_PUBLIC_AGENT_BASE_URL`.

```
Vercel (Next.js)  →  http://YOUR_SERVER:4000  →  Agent (pm2 on VPS)
```

### Webapp → Vercel

1. **Root Directory:** `webapp`
2. **Include files outside Root Directory:** enabled (needed for `packages/shared`)
3. Install is configured in `webapp/vercel.json` (`cd .. && pnpm install`)

**Vercel environment variables:**

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | ≥ 16 chars — must match agent `.env` |
| `INTERNAL_API_SECRET` | ≥ 16 chars — must match agent `.env` |
| `NEXT_PUBLIC_AGENT_BASE_URL` | Public agent URL, e.g. `http://92.5.113.56:4000` (no trailing slash) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | From [cloud.reown.com](https://cloud.reown.com) |

Add your Vercel domain (e.g. `https://your-app.vercel.app`) to the Reown project **Allowlist**.

Redeploy after changing env vars. Do **not** use `127.0.0.1` for `NEXT_PUBLIC_AGENT_BASE_URL` on Vercel — that points to Vercel itself, not your VPS.

### Agent → Ubuntu / Oracle Cloud VPS

#### Prerequisites on the server

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm 11
sudo corepack enable
corepack prepare pnpm@11.8.0 --activate

# pm2 (process manager)
sudo npm install -g pm2
```

#### Setup

```bash
git clone <your-repo> ~/0G-orbit
cd ~/0G-orbit
pnpm install
cp .env.example .env
nano .env   # fill in all agent vars (see .env.example)
```

**Required in `.env` for production:**

```bash
AGENT_HOST=0.0.0.0    # not 127.0.0.1 — must accept external traffic
AGENT_PORT=4000
```

#### Run with pm2 (keeps agent alive after SSH disconnect)

`pnpm dev` stops when you close SSH. Use pm2 for a 24/7 agent:

```bash
cd ~/0G-orbit
pnpm --filter @orbit/agent build
pm2 start "pnpm --filter @orbit/agent start" --name orbit-agent
pm2 save
pm2 startup    # run the sudo command it prints, then: pm2 save
```

**Verify:**

```bash
pm2 status
pm2 logs orbit-agent
curl http://127.0.0.1:4000/internal/health
```

From your laptop:

```bash
curl http://YOUR_PUBLIC_IP:4000/internal/health
```

Expected: `{"status":"ok",...}`

**After code or `.env` changes:**

```bash
cd ~/0G-orbit
git pull
pnpm install
pnpm --filter @orbit/agent build
pm2 restart orbit-agent
```

**Useful pm2 commands:**

| Command | Purpose |
|---------|---------|
| `pm2 status` | List processes |
| `pm2 logs orbit-agent` | Live logs |
| `pm2 restart orbit-agent` | Restart (e.g. after `.env` edit) |
| `pm2 stop orbit-agent` | Stop the agent |

**Alternative start (direct node):**

```bash
cd ~/0G-orbit
pnpm --filter @orbit/agent build
pm2 start "node --env-file=../.env dist/index.js" --name orbit-agent --cwd ~/0G-orbit/agent
pm2 save
```

#### Oracle Cloud networking

Open **TCP port 4000** in two places:

1. **VCN Security List** — Ingress rule: `0.0.0.0/0`, TCP, destination port `4000`
2. **Instance iptables** — Rules must appear **before** the final `REJECT` rule:

```bash
sudo iptables -L INPUT -n --line-numbers
# Insert BEFORE the REJECT line (example: position 5):
sudo iptables -I INPUT 5 -p tcp -m state --state NEW --dport 4000 -j ACCEPT
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

Confirm the agent listens on all interfaces:

```bash
ss -tlnp | grep 4000
# expect: 0.0.0.0:4000
```

### Contract → 0G testnet

```bash
pnpm --filter @orbit/contracts deploy:testnet
```

Set `ORBIT_ATTESTATION_ADDRESS` in `.env` on the agent server and restart pm2.

