import { ethers } from "hardhat";

async function main() {
  const OrbitAttestation = await ethers.getContractFactory("OrbitAttestation");
  const contract = await OrbitAttestation.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("OrbitAttestation deployed to:", address);
  console.log("Set ORBIT_ATTESTATION_ADDRESS in your .env to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
