export const ATTESTATION_TYPES = {
  AttestationRequest: [
    { name: "contentHash", type: "bytes32" },
    { name: "storageRoot", type: "string" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
