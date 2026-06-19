import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFile, unlink } from "node:fs/promises";
import { MemData, Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { getServerWallet } from "./chain.js";
import { ZG_STORAGE, ZG_CHAIN } from "@orbit/shared";
import { logger } from "../utils/logger.js";
import { StorageError } from "../utils/errors.js";
import { retry } from "../utils/retry.js";

export interface UploadResult {
  storageRoot: string;
  txHash: string;
}

export async function uploadJson(payload: unknown, label: string): Promise<UploadResult> {
  const wallet = getServerWallet();
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  logger.info({ label, bytes: data.length }, "uploading to 0g storage");

  try {
    const indexer = new Indexer(ZG_STORAGE.indexer);
    const file = new MemData(new Uint8Array(data));

    const [result, err] = await retry(
      async () => indexer.upload(file, ZG_CHAIN.rpc, wallet, undefined, undefined, { gasLimit: 500000n }),
      { label: "0g-storage-upload" },
    );
    if (err) throw new StorageError("0g storage upload failed", err);
    if (!result) throw new StorageError("0g storage upload returned no result");

    const storageRoot = "rootHash" in result ? result.rootHash : result.rootHashes[0]!;
    const txHash = "txHash" in result ? result.txHash : result.txHashes[0]!;
    logger.info({ storageRoot, txHash }, "0g storage upload confirmed");
    return { storageRoot, txHash };
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError("0g storage upload failed", err);
  }
}

export async function downloadJson(storageRoot: string): Promise<unknown> {
  const tmpPath = join(tmpdir(), `orbit-${storageRoot}.json`);
  try {
    const indexer = new Indexer(ZG_STORAGE.indexer);
    const err = await indexer.download(storageRoot, tmpPath);
    if (err) throw new StorageError("0g storage download failed", err);
    const data = await readFile(tmpPath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError("0g storage download failed", err);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

export async function uploadDigest(digest: unknown, walletAddress: string): Promise<UploadResult> {
  const label = `orbit/digests/${walletAddress}/${Date.now()}.json`;
  return uploadJson(digest, label);
}
