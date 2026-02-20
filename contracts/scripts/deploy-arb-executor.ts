import hre from "hardhat";

const { ethers } = hre;

// Known addresses on Sepolia
const ELOQURA_ROUTER = "0x3f42823d998EE4759a95a42a6e3bB7736B76A7AE";
const UNISWAP_ROUTER = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E";
const ELOQURA_WETH = "0x34b11F6b8f78fa010bBCA71bC7FE79dAa811b89f";
const UNISWAP_WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const AAVE_V3_POOL = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying TriangularArbExecutor with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  console.log("\nConstructor args:");
  console.log("  Eloqura Router:", ELOQURA_ROUTER);
  console.log("  Uniswap Router:", UNISWAP_ROUTER);
  console.log("  Eloqura WETH:  ", ELOQURA_WETH);
  console.log("  Uniswap WETH:  ", UNISWAP_WETH);
  console.log("  Aave V3 Pool:  ", AAVE_V3_POOL);

  const Executor = await ethers.getContractFactory("TriangularArbExecutor");
  const executor = await Executor.deploy(
    ELOQURA_ROUTER,
    UNISWAP_ROUTER,
    ELOQURA_WETH,
    UNISWAP_WETH,
    AAVE_V3_POOL
  );
  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();

  console.log("\n========== DEPLOYMENT COMPLETE ==========");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("");
  console.log("TriangularArbExecutor:", executorAddress);
  console.log("Owner:", deployer.address);
  console.log("Aave V3 Pool:", AAVE_V3_POOL);
  console.log("");
  console.log("Add this address to admin-control-panel/client/src/lib/contracts.ts");
  console.log("==========================================");

  return { executor: executorAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
