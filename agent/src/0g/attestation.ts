import { ethers } from "ethers";
import { loadConfig, type AttestationData } from "@orbit/shared";
import { getServerWallet } from "./chain.js";
import { ORBIT_ATTESTATION_ABI } from "./attestation-abi.js";
import { logger } from "../utils/logger.js";
import { StorageError } from "../utils/errors.js";
import { retry } from "../utils/retry.js";

let contract: ethers.Contract | null = null;

export function getAttestationContract(): ethers.Contract | null {
  const config = loadConfig();
  if (!config.ORBIT_ATTESTATION_ADDRESS) {
    logger.warn("ORBIT_ATTESTATION_ADDRESS not set, attestation disabled");
    return null;
  }
  if (contract) return contract;
  const wallet = getServerWallet();
  contract = new ethers.Contract(
    config.ORBIT_ATTESTATION_ADDRESS,
    ORBIT_ATTESTATION_ABI,
    wallet,
  );
  return contract;
}

export async function attest(
  walletAddress: string,
  content: unknown,
  storageRoot: string,
): Promise<AttestationData | null> {
  const c = getAttestationContract();
  if (!c) return null;
  const contentHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(content)),
  );
  logger.info({ walletAddress, contentHash, storageRoot }, "attesting on-chain");

  try {
    const tx = await retry(
      async () => c.attest(contentHash, storageRoot) as Promise<ethers.ContractTransaction>,
      { label: "attestation-tx" },
    );
    const receipt = await tx.wait();
    if (!receipt) throw new StorageError("attestation tx no receipt");
    logger.info({ txHash: receipt.hash }, "attestation confirmed");
    return {
      wallet: walletAddress,
      contentHash,
      storageRoot,
      timestamp: Date.now(),
      txHash: receipt.hash,
    };
  } catch (err) {
    throw new StorageError("attestation failed", err);
  }
}

export async function isAttested(contentHash: string): Promise<boolean> {
  const c = getAttestationContract();
  if (!c) return false;
  return (await c.isAttested(contentHash)) as boolean;
}
