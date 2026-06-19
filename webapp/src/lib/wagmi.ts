import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { zgGalileo } from "./chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Orbit",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "00000000000000000000000000000000",
  chains: [zgGalileo],
  ssr: true,
});
