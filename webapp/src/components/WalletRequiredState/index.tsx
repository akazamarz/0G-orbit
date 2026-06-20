import { EmptyState } from "@/components/EmptyState";

export function WalletRequiredState() {
  return (
    <EmptyState
      title="Connect your wallet"
      description="Click Connect Wallet in the header — you'll be asked to sign once to verify ownership, then you're in."
    />
  );
}
