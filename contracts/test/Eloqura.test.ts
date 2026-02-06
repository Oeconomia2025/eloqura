import { expect } from "chai";
import hre from "hardhat";
import { WETH, EloquraFactory, EloquraRouter } from "../typechain-types";

const { ethers } = hre;

describe("Eloqura DEX", function () {
  let weth: WETH;
  let factory: EloquraFactory;
  let router: EloquraRouter;
  let owner: any;
  let user1: any;
  let user2: any;

  // Mock tokens for testing
  let tokenA: any;
  let tokenB: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy WETH
    const WETH = await ethers.getContractFactory("WETH");
    weth = await WETH.deploy();

    // Deploy Factory
    const Factory = await ethers.getContractFactory("EloquraFactory");
    factory = await Factory.deploy(owner.address);

    // Deploy Router
    const Router = await ethers.getContractFactory("EloquraRouter");
    router = await Router.deploy(await factory.getAddress(), await weth.getAddress());

    // Deploy mock ERC20 tokens for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20.deploy("Token A", "TKNA", ethers.parseEther("1000000"));
    tokenB = await MockERC20.deploy("Token B", "TKNB", ethers.parseEther("1000000"));
  });

  describe("WETH", function () {
    it("Should allow deposits", async function () {
      await weth.deposit({ value: ethers.parseEther("1") });
      expect(await weth.balanceOf(owner.address)).to.equal(ethers.parseEther("1"));
    });

    it("Should allow withdrawals", async function () {
      await weth.deposit({ value: ethers.parseEther("1") });
      await weth.withdraw(ethers.parseEther("0.5"));
      expect(await weth.balanceOf(owner.address)).to.equal(ethers.parseEther("0.5"));
    });
  });

  describe("Factory", function () {
    it("Should create pairs", async function () {
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
      expect(pairAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should not allow duplicate pairs", async function () {
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      await expect(
        factory.createPair(await tokenA.getAddress(), await tokenB.getAddress())
      ).to.be.revertedWithCustomError(factory, "PairExists");
    });

    it("Should track pair count", async function () {
      expect(await factory.allPairsLength()).to.equal(0);
      await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
      expect(await factory.allPairsLength()).to.equal(1);
    });
  });

  describe("Router - Liquidity", function () {
    it("Should add liquidity to new pair", async function () {
      const amountA = ethers.parseEther("1000");
      const amountB = ethers.parseEther("1000");

      await tokenA.approve(await router.getAddress(), amountA);
      await tokenB.approve(await router.getAddress(), amountB);

      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountA,
        amountB,
        0,
        0,
        owner.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
      const pair = await ethers.getContractAt("EloquraPair", pairAddress);
      expect(await pair.balanceOf(owner.address)).to.be.gt(0);
    });
  });

  describe("Router - Swaps", function () {
    beforeEach(async function () {
      // Add initial liquidity
      const amountA = ethers.parseEther("10000");
      const amountB = ethers.parseEther("10000");

      await tokenA.approve(await router.getAddress(), amountA);
      await tokenB.approve(await router.getAddress(), amountB);

      await router.addLiquidity(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountA,
        amountB,
        0,
        0,
        owner.address,
        Math.floor(Date.now() / 1000) + 3600
      );
    });

    it("Should swap tokens", async function () {
      const amountIn = ethers.parseEther("100");
      await tokenA.approve(await router.getAddress(), amountIn);

      const balanceBefore = await tokenB.balanceOf(owner.address);

      await router.swapExactTokensForTokens(
        amountIn,
        0,
        [await tokenA.getAddress(), await tokenB.getAddress()],
        owner.address,
        Math.floor(Date.now() / 1000) + 3600
      );

      const balanceAfter = await tokenB.balanceOf(owner.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should get swap quote", async function () {
      const amountIn = ethers.parseEther("100");
      const [amountOut, priceImpact, fee] = await router.getSwapQuote(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        amountIn
      );

      expect(amountOut).to.be.gt(0);
      expect(fee).to.be.gt(0);
    });
  });
});
