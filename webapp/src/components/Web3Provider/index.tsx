import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { zgGalileo } from "@/lib/chains";
import { ToastProvider } from "@/components/Toast";
import { Loading } from "@/components/Loading";
import { SessionProvider } from "@/contexts/SessionContext";

function createWagmiConfig() {
  return getDefaultConfig({
    appName: "Orbit",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "00000000000000000000000000000000",
    chains: [zgGalileo],
    ssr: false,
  });
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [config] = useState(createWagmiConfig);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Loading label="Loading wallet…" variant="full" />;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#4f7cff",
            accentColorForeground: "white",
            borderRadius: "small",
            fontStack: "system",
          })}
        >
          <SessionProvider>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
