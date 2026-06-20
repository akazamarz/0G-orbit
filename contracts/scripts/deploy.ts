import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account. Set SERVER_PRIVATE_KEY in the repo-root .env and fund it on 0G testnet.",
    );
  }

  console.log("Deploying from:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "0G");

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
