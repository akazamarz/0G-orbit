import { defineChain } from "viem";
import { ZG_CHAIN } from "@orbit/shared";

export const zgGalileo = defineChain({
  id: ZG_CHAIN.chainId,
  name: ZG_CHAIN.name,
  nativeCurrency: {
    name: ZG_CHAIN.symbol,
    symbol: ZG_CHAIN.symbol,
    decimals: ZG_CHAIN.decimals,
  },
  rpcUrls: {
    default: { http: [ZG_CHAIN.rpc] },
  },
  blockExplorers: {
    default: { name: "0G Explorer", url: ZG_CHAIN.explorer },
  },
});
