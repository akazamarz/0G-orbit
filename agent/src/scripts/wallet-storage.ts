#!/usr/bin/env node
import { closeDb, getDb } from "../db/client.js";
import { backfillWalletStorage } from "../0g/backfill.js";
import { hydrateWallet } from "../0g/hydrate.js";
import { uploadWalletManifest } from "../0g/manifest.js";
import { getWalletCache, listWalletsWithManifest } from "../0g/wallet-cache.js";
import { logger } from "../utils/logger.js";

const [, , command, walletArg, manifestArg] = process.argv;

function usage(): never {
  console.error(`Usage:
  wallet-storage hydrate <wallet> [manifestRoot]
  wallet-storage backfill <wallet>
  wallet-storage manifest <wallet>
  wallet-storage status [wallet]`);
  process.exit(1);
}

async function main(): Promise<void> {
  if (!command) usage();

  getDb();

  switch (command) {
    case "hydrate": {
      if (!walletArg) usage();
      const result = await hydrateWallet(walletArg, manifestArg);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "backfill": {
      if (!walletArg) usage();
      const result = await backfillWalletStorage(walletArg);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "manifest": {
      if (!walletArg) usage();
      const result = await uploadWalletManifest(walletArg);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "status": {
      if (walletArg) {
        const cache = getWalletCache(walletArg);
        console.log(JSON.stringify(cache ?? { wallet: walletArg, manifestRoot: null }, null, 2));
      } else {
        const wallets = listWalletsWithManifest();
        console.log(JSON.stringify({ wallets, count: wallets.length }, null, 2));
      }
      break;
    }
    default:
      usage();
  }
}

main()
  .catch((err) => {
    logger.error({ err }, "wallet-storage command failed");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => {
    closeDb();
  });
