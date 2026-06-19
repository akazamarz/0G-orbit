import { useCallback, useEffect, useState } from "react";

export function useSession() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = (await res.json()) as { wallet: string };
        setWallet(data.wallet);
      } else {
        setWallet(null);
      }
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setWallet(null);
  }, []);

  return { wallet, loading, refresh, signOut, isAuthed: Boolean(wallet) };
}
