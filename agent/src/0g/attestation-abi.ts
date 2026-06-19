export const ORBIT_ATTESTATION_ABI = [
  {
    inputs: [
      { name: "contentHash", type: "bytes32" },
      { name: "storageRoot", type: "string" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    name: "attestWithSignature",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "contentHash", type: "bytes32" }],
    name: "isAttested",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "contentHash", type: "bytes32" }],
    name: "getAttestation",
    outputs: [
      { name: "user", type: "address" },
      { name: "timestamp", type: "uint256" },
      { name: "storageRoot", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getDomainSeparator",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "contentHash", type: "bytes32" },
      { indexed: false, name: "timestamp", type: "uint256" },
      { indexed: false, name: "storageRoot", type: "string" },
    ],
    name: "Attestation",
    type: "event",
  },
] as const;
