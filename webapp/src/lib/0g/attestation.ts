import type { EIP712Domain } from "@orbit/shared";
import type { TypedDataField } from "ethers";
import { getSigner } from "./chain";

export const ATTESTATION_TYPES: Record<string, TypedDataField[]> = {
  AttestationRequest: [
    { name: "contentHash", type: "bytes32" },
    { name: "storageRoot", type: "string" },
    { name: "deadline", type: "uint256" },
  ],
};

export async function signAttestation(
  domain: EIP712Domain,
  contentHash: string,
  storageRoot: string,
  deadline: number,
): Promise<string> {
  const signer = await getSigner();
  if (!signer) throw new Error("wallet not connected");

  return signer.signTypedData(
    domain,
    ATTESTATION_TYPES,
    {
      contentHash,
      storageRoot,
      deadline: BigInt(deadline),
    },
  );
}
