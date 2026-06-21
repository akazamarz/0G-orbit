# Orbit

AI-powered X (Twitter) intelligence agent with **SQLite for fast reads**, **0G Storage for durable user data**, optional on-chain attestation, DeepSeek reasoning, and Telegram alerts.

## Overview

Users sign in with a wallet (SIWE), create **orbits** (keyword or list feeds), and receive **alerts** when AI scores tweets above threshold. The agent polls X on a schedule, deduplicates, scores with DeepSeek, and can notify via Telegram.

**0G role:** orbit and alert JSON snapshots are uploaded to 0G Storage in the background (server wallet pays gas). A per-wallet **manifest** on 0G indexes those roots so data can be **restored** into a fresh SQLite database anytime.

## Architecture

```
User / Webapp / Telegram
        │
        ▼
   Agent API ──► SQLite (working cache — reads, polling, dedup)
        │
        └──► 0G Storage (async archive)
               ├── orbit-{id} snapshots
               ├── alert-{id} snapshots
               └── wallet manifest (index of storage_root pointers)
```

| Layer | Role |
|--------|------|
| **SQLite** | Source of truth for day-to-day API, dashboard, polling, Telegram |
| **0G entity uploads** | Fire-and-forget after SQLite write; updates `storage_root` on each row |
| **Wallet manifest** | Debounced index upload (~5s after entity changes); `wallet_cache` holds latest `manifest_root` |
| **Server wallet** | Signs and pays for all Storage txs (`SERVER_PRIVATE_KEY`) |
| **User wallet** | Owns data logically (SIWE address in payloads + manifest); not required to fund 0G uploads |

**Not on 0G (v1):** feedback, seen-tweets, poll cursor state, Telegram link metadata.

Pause/resume updates SQLite only — no blocking 0G wait.

## Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 11 (`npm i -g pnpm`)

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill `.env` (validated at runtime by zod in `packages/shared`):

| Variable | Purpose |
|----------|---------|
| `AI_API_KEY` | DeepSeek (or any OpenAI-compatible) API key |
| `SERVER_PRIVATE_KEY` | 0G testnet wallet — funded with gas for Storage + attestation relay |
| `X_API_KEY` | [twitterapi.io](https://twitterapi.io) API key |
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/botfather) |
| `TELEGRAM_BOT_USERNAME` | Bot username (Telegram wallet linking) |
| `JWT_SECRET` | ≥ 16 chars — webapp session signing |
| `INTERNAL_API_SECRET` | ≥ 16 chars — webapp → agent auth |

Optional: `ORBIT_ATTESTATION_ADDRESS` after deploying `OrbitAttestation.sol`.

## Run locally

```bash
# Agent + webapp in parallel
pnpm dev

# Or individually:
pnpm dev:agent    # Hono API on 127.0.0.1:4000
pnpm dev:webapp   # Next.js on 127.0.0.1:3000
```

The webapp proxies API calls to the agent. Both must run for local development.

## Verify

```bash
pnpm typecheck                              # tsc across all workspaces
pnpm lint                                   # tsc + eslint per package
pnpm --filter @orbit/agent test             # manifest / hydrate unit tests
pnpm --filter @orbit/contracts compile      # Solidity compilation
```

Agent health:

```bash
curl http://127.0.0.1:4000/internal/health
```

## 0G wallet index & recovery

After entity uploads complete, the agent debounces a **wallet manifest** upload and stores the latest root in `wallet_cache`.

### CLI

```bash
# Latest manifest pointer for a wallet
pnpm --filter @orbit/agent wallet-storage status 0xYourWallet

# Upload missing entity snapshots, then publish manifest
pnpm --filter @orbit/agent wallet-storage backfill 0xYourWallet

# Force a new manifest from current SQLite state
pnpm --filter @orbit/agent wallet-storage manifest 0xYourWallet

# Restore SQLite from 0G (uses wallet_cache manifest_root, or pass root explicitly)
pnpm --filter @orbit/agent wallet-storage hydrate 0xYourWallet
pnpm --filter @orbit/agent wallet-storage hydrate 0xYourWallet 0xManifestRoot...
```

### Recovery demo

1. Note `manifest_root` from `wallet-storage status`.
2. Stop the agent; backup or remove `agent/data/orbit.db`.
3. Start the agent (empty DB).
4. Run `wallet-storage hydrate 0xYourWallet 0xManifestRoot...`.
5. Open the dashboard — orbits and alerts should reappear from 0G.

**Note:** Orbits/alerts uploaded before the async plain-JSON format (e.g. encrypted legacy blobs) may fail hydrate download; re-save those orbits to re-upload.

## Project structure

```
orbit/
├── agent/                         # TypeScript agent (Hono, tsx/tsup)
│   ├── src/
│   │   ├── 0g/                    # Storage, manifest, hydrate, attestation
│   │   │   ├── storage.ts         # uploadJson / downloadJson
│   │   │   ├── persist.ts         # async entity uploads after SQLite write
│   │   │   ├── manifest.ts        # wallet manifest build + debounced upload
│   │   │   ├── hydrate.ts         # restore SQLite from manifest + entities
│   │   │   ├── backfill.ts        # upload missing roots + manifest
│   │   │   ├── wallet-cache.ts    # manifest_root per wallet in SQLite
│   │   │   └── attestation.ts     # optional EIP-712 batch attestation
│   │   ├── scripts/
│   │   │   └── wallet-storage.ts  # hydrate / backfill / status CLI
│   │   ├── ai/                    # DeepSeek client
│   │   ├── db/                    # SQLite schema + migrations
│   │   ├── internal-api/          # Hono server + handlers
│   │   ├── orbits/                # CRUD, polling runner, scheduler
│   │   ├── telegram/              # grammy bot, commands, notifications
│   │   └── x/                     # twitterapi.io client, dedup, query templates
│   └── data/                      # SQLite DB (auto-created)
├── webapp/                        # Next.js (pages router)
│   ├── src/
│   │   ├── components/            # CSS modules per component
│   │   ├── lib/                   # agent client, SIWE auth, attestation types
│   │   └── pages/                 # UI + API routes (proxy to agent)
├── contracts/                     # Hardhat + OrbitAttestation.sol
├── packages/
│   └── shared/                    # Types, 0G constants, zod config
└── pnpm-workspace.yaml
```

## Deploy

Production splits **webapp** (Vercel) and **agent** (VPS). The webapp calls the agent over HTTP via `NEXT_PUBLIC_AGENT_BASE_URL`.

```
Vercel (Next.js)  →  http://YOUR_SERVER:4000  →  Agent (pm2 on VPS)
```

### Webapp → Vercel

1. **Root Directory:** `webapp`
2. **Include files outside Root Directory:** enabled (for `packages/shared`)
3. Install is configured in `webapp/vercel.json` (`cd .. && pnpm install`)

**Vercel environment variables:**

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | ≥ 16 chars — must match agent `.env` |
| `INTERNAL_API_SECRET` | ≥ 16 chars — must match agent `.env` |
| `NEXT_PUBLIC_AGENT_BASE_URL` | Public agent URL, e.g. `http://92.5.113.56:4000` (no trailing slash) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | From [cloud.reown.com](https://cloud.reown.com) |

Add your Vercel domain to the Reown project **Allowlist**. Redeploy after env changes.

Do **not** use `127.0.0.1` for `NEXT_PUBLIC_AGENT_BASE_URL` on Vercel — that points to Vercel itself, not your VPS.

### Agent → Ubuntu / Oracle Cloud VPS

#### Prerequisites on the server

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm 11
sudo corepack enable
corepack prepare pnpm@11.8.0 --activate

# pm2
sudo npm install -g pm2
```

#### Setup

```bash
git clone <your-repo> ~/0G-orbit
cd ~/0G-orbit
pnpm install
cp .env.example .env
nano .env   # fill in all agent vars
```

Production agent bind:

```bash
AGENT_HOST=0.0.0.0    # accept external traffic (not 127.0.0.1)
AGENT_PORT=4000
```

#### Run with pm2

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
curl http://YOUR_PUBLIC_IP:4000/internal/health   # from laptop
```

**After code or `.env` changes:**

```bash
cd ~/0G-orbit
git pull
pnpm install
pnpm --filter @orbit/agent build
pm2 restart orbit-agent
```

| Command | Purpose |
|---------|---------|
| `pm2 status` | List processes |
| `pm2 logs orbit-agent` | Live logs |
| `pm2 restart orbit-agent` | Restart after deploy or `.env` edit |
| `pm2 stop orbit-agent` | Stop the agent |

**Alternative start:**

```bash
cd ~/0G-orbit
pnpm --filter @orbit/agent build
pm2 start "node --env-file=../.env dist/index.js" --name orbit-agent --cwd ~/0G-orbit/agent
pm2 save
```

#### Oracle Cloud networking

Open **TCP port 4000** in:

1. **VCN Security List** — Ingress: `0.0.0.0/0`, TCP, port `4000`
2. **Instance iptables** — rule **before** the final `REJECT`:

```bash
sudo iptables -L INPUT -n --line-numbers
sudo iptables -I INPUT 5 -p tcp -m state --state NEW --dport 4000 -j ACCEPT
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
```

Confirm listen address:

```bash
ss -tlnp | grep 4000
# expect: 0.0.0.0:4000
```

### Contract → 0G testnet

```bash
pnpm --filter @orbit/contracts deploy:testnet
```

Set `ORBIT_ATTESTATION_ADDRESS` in the agent `.env` and `pm2 restart orbit-agent`.

## Optional: on-chain attestation

When `ORBIT_ATTESTATION_ADDRESS` is set, the agent uploads a **batch manifest** of unattested alerts to 0G and exposes EIP-712 signing in the webapp. Users sign once to attest a batch on 0G Chain; the agent relays the transaction (server wallet pays gas).
