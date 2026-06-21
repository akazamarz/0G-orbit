import {
  RainbowKitAuthenticationProvider,
  type AuthenticationStatus,
} from "@rainbow-me/rainbowkit";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useDisconnect } from "wagmi";
import { createOrbitAuthAdapter } from "@/lib/orbit-auth-adapter";

interface SessionContextValue {
  wallet: string | null;
  loading: boolean;
  authStatus: AuthenticationStatus;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  isAuthed: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { disconnect } = useDisconnect();
  const [wallet, setWallet] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthenticationStatus>("loading");

  const refresh = useCallback(async () => {
    setAuthStatus("loading");
    try {
      const res = await fetch("/api/auth/session", { credentials: "same-origin" });
      if (res.ok) {
        const data = (await res.json()) as { wallet: string };
        setWallet(data.wallet);
        setAuthStatus("authenticated");
      } else {
        setWallet(null);
        setAuthStatus("unauthenticated");
      }
    } catch {
      setWallet(null);
      setAuthStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    setWallet(null);
    setAuthStatus("unauthenticated");
  }, []);

  const authenticationAdapter = useMemo(
    () =>
      createOrbitAuthAdapter({
        setAuthStatus,
        setWallet,
        onAuthFailed: () => disconnect(),
      }),
    [disconnect],
  );

  return (
    <SessionContext.Provider
      value={{
        wallet,
        loading: authStatus === "loading",
        authStatus,
        refresh,
        signOut,
        isAuthed: authStatus === "authenticated",
      }}
    >
      <RainbowKitAuthenticationProvider adapter={authenticationAdapter} status={authStatus}>
        {children}
      </RainbowKitAuthenticationProvider>
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
