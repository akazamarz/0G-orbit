import { ethers } from "ethers";
import { ZG_STORAGE } from "@orbit/shared";
import { getSigner } from "./chain";

export interface BrowserUploadResult {
  storageRoot: string;
  txHash: string;
}

export async function uploadUserConfig(payload: unknown): Promise<BrowserUploadResult> {
  const signer = await getSigner();
  if (!signer) throw new Error("wallet not connected");

  const data = Buffer.from(JSON.stringify(payload), "utf8");
  const { ZgFile, Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
  const indexer = new Indexer(ZG_STORAGE.indexer);
  const zgFile = new ZgFile(Buffer.from(`orbit/configs/${Date.now()}.json`));
  await zgFile.setData(data);
  const [tree, err] = await zgFile.merkleTree();
  if (err || !tree) throw new Error("merkle tree failed");
  const root = tree.rootHash();

  const txHash = await indexer.upload(zgFile, 0, signer, 0, { txGASLimit: 500000 });
  return { storageRoot: root, txHash };
}

export async function downloadUserConfig(storageRoot: string): Promise<unknown> {
  const { Indexer } = await import("@0gfoundation/0g-storage-ts-sdk");
  const indexer = new Indexer(ZG_STORAGE.indexer);
  const data = await indexer.download(storageRoot);
  return JSON.parse(Buffer.from(data).toString("utf8"));
}

export function hashContent(content: unknown): string {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(content)));
}
