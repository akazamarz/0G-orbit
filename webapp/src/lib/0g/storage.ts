import { MemData, Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { ZG_STORAGE, ZG_CHAIN } from "@orbit/shared";
import { ethers } from "ethers";
import { getSigner } from "./chain";

export interface BrowserUploadResult {
  storageRoot: string;
  txHash: string;
}

export async function uploadUserConfig(payload: unknown): Promise<BrowserUploadResult> {
  const signer = await getSigner();
  if (!signer) throw new Error("wallet not connected");

  const data = Buffer.from(JSON.stringify(payload), "utf8");
  const indexer = new Indexer(ZG_STORAGE.indexer);
  const file = new MemData(new Uint8Array(data));

  const [result, err] = await indexer.upload(file, ZG_CHAIN.rpc, signer, undefined, undefined, {
    gasLimit: BigInt(500000),
  });
  if (err) throw new Error(`0g storage upload failed: ${err.message}`);
  if (!result) throw new Error("0g storage upload returned no result");

  const storageRoot = "rootHash" in result ? result.rootHash : result.rootHashes[0]!;
  const txHash = "txHash" in result ? result.txHash : result.txHashes[0]!;
  return { storageRoot, txHash };
}

export async function downloadUserConfig(storageRoot: string): Promise<unknown> {
  const indexer = new Indexer(ZG_STORAGE.indexer);
  const [blob, err] = await indexer.downloadToBlob(storageRoot);
  if (err) throw new Error(`0g storage download failed: ${err.message}`);
  const text = await blob.text();
  return JSON.parse(text);
}

export function hashContent(content: unknown): string {
  return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(content)));
}
