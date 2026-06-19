import { ethers } from "ethers";
import { getServerWallet } from "./chain.js";
import { ZG_STORAGE } from "@orbit/shared";
import { logger } from "../utils/logger.js";
import { StorageError } from "../utils/errors.js";
import { retry } from "../utils/retry.js";

export interface UploadResult {
  storageRoot: string;
  txHash: string;
}

export async function uploadJson(payload: unknown, filename: string): Promise<UploadResult> {
  const wallet = getServerWallet();
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  logger.info({ filename, bytes: data.length }, "uploading to 0g storage");

  try {
    const { ZgFile, Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
    const indexer = new Indexer(ZG_STORAGE.indexer);
    const zgFile = new ZgFile(Buffer.from(filename));
    const [tree, err] = await zgFile.merkleTree();
    if (err) throw new StorageError("merkle tree failed", err);
    const root = tree?.rootHash();
    if (!root) throw new StorageError("empty merkle root");

    const result = await retry(
      async () => indexer.upload(zgFile, 0, wallet, 0, { txGASLimit: 500000 }),
      { label: "0g-storage-upload" },
    );

    return {
      storageRoot: root,
      txHash: result,
    };
  } catch (err) {
    throw new StorageError("0g storage upload failed", err);
  }
}

export async function downloadJson(storageRoot: string): Promise<unknown> {
  try {
    const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
    const indexer = new Indexer(ZG_STORAGE.indexer);
    const data = await indexer.download(storageRoot);
    return JSON.parse(Buffer.from(data).toString("utf8"));
  } catch (err) {
    throw new StorageError("0g storage download failed", err);
  }
}

export async function uploadDigest(
  digest: unknown,
  walletAddress: string,
): Promise<UploadResult> {
  const filename = `orbit/digests/${walletAddress}/${Date.now()}.json`;
  return uploadJson(digest, filename);
}
