export const ZG_CHAIN = {
  name: "0G Galileo Testnet",
  chainId: 16602,
  chainIdHex: "0x40DA",
  symbol: "0G",
  decimals: 18,
  rpc: "https://evmrpc-testnet.0g.ai",
  explorer: "https://chainscan-galileo.0g.ai",
  storageExplorer: "https://storagescan-galileo.0g.ai",
  faucet: "https://faucet.0g.ai",
  daStartBlock: 940000,
} as const;

export const ZG_STORAGE = {
  indexer: "https://indexer-storage-testnet-turbo.0g.ai",
  flow: "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296",
  mine: "0x00A9E9604b0538e06b268Fb297Df333337f9593b",
  reward: "0xA97B57b4BdFEA2D0a25e535bd849ad4e6C440A69",
} as const;

export const ZG_DA = {
  entrance: "0xE75A073dA5bb7b0eC622170Fd268f35E675a957B",
} as const;

export const ATTESTATION_EIP712 = {
  name: "Orbit",
  version: "1",
} as const;

export const X_API = {
  base: "https://api.twitterapi.io",
  advancedSearch: "https://api.twitterapi.io/twitter/tweet/advanced_search",
  costPerTweetUsd: 0.00015,
} as const;

export const TELEGRAM = {
  apiBase: "https://api.telegram.org",
} as const;

export function zgStorageFileUrl(storageRoot: string): string {
  return `${ZG_CHAIN.storageExplorer}/file/${storageRoot}`;
}

export const metamskAddChainParams = {
  chainId: ZG_CHAIN.chainIdHex,
  chainName: ZG_CHAIN.name,
  nativeCurrency: { name: ZG_CHAIN.symbol, symbol: ZG_CHAIN.symbol, decimals: ZG_CHAIN.decimals },
  rpcUrls: [ZG_CHAIN.rpc],
  blockExplorerUrls: [ZG_CHAIN.explorer],
} as const;
