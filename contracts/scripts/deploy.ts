import hre from "hardhat";

const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy WETH (for testnets that don't have it)
  console.log("\n1. Deploying WETH...");
  const WETH = await ethers.getContractFactory("WETH");
  const weth = await WETH.deploy();
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();
  console.log("WETH deployed to:", wethAddress);

  // 2. Deploy Factory
  console.log("\n2. Deploying EloquraFactory...");
  const Factory = await ethers.getContractFactory("EloquraFactory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("EloquraFactory deployed to:", factoryAddress);

  // 3. Deploy Router
  console.log("\n3. Deploying EloquraRouter...");
  const Router = await ethers.getContractFactory("EloquraRouter");
  const router = await Router.deploy(factoryAddress, wethAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("EloquraRouter deployed to:", routerAddress);

  // 4. Deploy LimitOrders
  console.log("\n4. Deploying EloquraLimitOrders...");
  const LimitOrders = await ethers.getContractFactory("EloquraLimitOrders");
  const limitOrders = await LimitOrders.deploy(routerAddress);
  await limitOrders.waitForDeployment();
  const limitOrdersAddress = await limitOrders.getAddress();
  console.log("EloquraLimitOrders deployed to:", limitOrdersAddress);

  // Summary
  console.log("\n========== DEPLOYMENT COMPLETE ==========");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("");
  console.log("Contract Addresses:");
  console.log("-------------------");
  console.log(`WETH:              ${wethAddress}`);
  console.log(`EloquraFactory:    ${factoryAddress}`);
  console.log(`EloquraRouter:     ${routerAddress}`);
  console.log(`EloquraLimitOrders: ${limitOrdersAddress}`);
  console.log("");
  console.log("Add these addresses to your frontend configuration.");
  console.log("==========================================");

  // Return addresses for programmatic use
  return {
    weth: wethAddress,
    factory: factoryAddress,
    router: routerAddress,
    limitOrders: limitOrdersAddress,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
