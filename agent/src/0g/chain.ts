import { ethers } from "ethers";
import { loadConfig, ZG_CHAIN } from "@orbit/shared";
import { logger } from "../utils/logger.js";

let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (provider) return provider;
  provider = new ethers.JsonRpcProvider(ZG_CHAIN.rpc, ZG_CHAIN.chainId);
  return provider;
}

export function getServerWallet(): ethers.Wallet {
  if (wallet) return wallet;
  const config = loadConfig();
  wallet = new ethers.Wallet(config.SERVER_PRIVATE_KEY, getProvider());
  logger.info({ address: wallet.address }, "server wallet initialized");
  return wallet;
}

export async function getServerBalance(): Promise<bigint> {
  const w = getServerWallet();
  return w.provider.getBalance(w.address);
}
