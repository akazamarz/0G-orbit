import { ethers } from "ethers";
import { metamskAddChainParams, ZG_CHAIN } from "@orbit/shared";

declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider;
  }
}

export function getBrowserProvider(): ethers.BrowserProvider | null {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return new ethers.BrowserProvider(window.ethereum);
}

export async function ensureChain(): Promise<void> {
  const provider = getBrowserProvider();
  if (!provider) throw new Error("MetaMask not found");
  try {
    await window.ethereum!.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ZG_CHAIN.chainIdHex }],
    });
  } catch (switchError) {
    if ((switchError as { code?: number }).code === 4902) {
      await window.ethereum!.request({
        method: "wallet_addEthereumChain",
        params: [metamskAddChainParams],
      });
    } else {
      throw switchError;
    }
  }
}

export async function getSigner(): Promise<ethers.JsonRpcSigner | null> {
  const provider = getBrowserProvider();
  if (!provider) return null;
  await ensureChain();
  return provider.getSigner();
}

export async function getWalletAddress(): Promise<string | null> {
  const provider = getBrowserProvider();
  if (!provider) return null;
  const accounts = await provider.send("eth_requestAccounts", []);
  return (accounts as string[])[0] ?? null;
}
