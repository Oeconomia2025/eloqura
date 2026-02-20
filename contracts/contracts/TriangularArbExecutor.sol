// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IEloquraRouter {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IUniswapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

contract TriangularArbExecutor {
    address public owner;
    IEloquraRouter public eloquraRouter;
    IUniswapRouter public uniswapRouter;
    IWETH public eloquraWeth;
    IWETH public uniswapWeth;
    IPool public aavePool;

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(
        address _eloquraRouter,
        address _uniswapRouter,
        address _eloquraWeth,
        address _uniswapWeth,
        address _aavePool
    ) {
        owner = msg.sender;
        eloquraRouter = IEloquraRouter(_eloquraRouter);
        uniswapRouter = IUniswapRouter(_uniswapRouter);
        eloquraWeth = IWETH(_eloquraWeth);
        uniswapWeth = IWETH(_uniswapWeth);
        aavePool = IPool(_aavePool);
    }

    receive() external payable {}

    // ─── Self-funded execution (pull tokens from caller) ─────────────────

    /// @notice Execute a triangular arb with your own capital. Reverts if unprofitable.
    function execute(
        uint8 direction,
        address inputToken,
        uint256 amountIn,
        address[] calldata eloquraPath1,
        address[] calldata eloquraPath2,
        address uniswapTokenIn,
        address uniswapTokenOut,
        uint24 uniswapFeeTier,
        uint256 minProfit
    ) external onlyOwner {
        uint256 balanceBefore = IERC20(inputToken).balanceOf(address(this));

        // Pull input tokens from caller
        IERC20(inputToken).transferFrom(msg.sender, address(this), amountIn);

        uint256 deadline = block.timestamp + 300;

        if (direction == 0) {
            _executeDirectionA(
                amountIn, eloquraPath1, eloquraPath2,
                uniswapTokenIn, uniswapTokenOut, uniswapFeeTier, deadline
            );
        } else {
            _executeDirectionB(
                amountIn, eloquraPath1, eloquraPath2,
                uniswapTokenIn, uniswapTokenOut, uniswapFeeTier, deadline
            );
        }

        // Check profit & return to caller
        uint256 balanceAfter = IERC20(inputToken).balanceOf(address(this));
        uint256 totalOut = balanceAfter - balanceBefore;
        require(totalOut >= amountIn + minProfit, "unprofitable");
        IERC20(inputToken).transfer(msg.sender, totalOut);
    }

    // ─── Flash loan execution (borrow from Aave, zero capital needed) ───

    /// @notice Execute a triangular arb using an Aave V3 flash loan. No capital needed.
    ///         Profit is sent to the owner. Reverts if unprofitable (can't repay loan).
    function executeWithFlashloan(
        uint8 direction,
        address inputToken,
        uint256 amountIn,
        address[] calldata eloquraPath1,
        address[] calldata eloquraPath2,
        address uniswapTokenIn,
        address uniswapTokenOut,
        uint24 uniswapFeeTier
    ) external onlyOwner {
        // Encode arb params for the callback
        bytes memory params = abi.encode(
            direction,
            eloquraPath1,
            eloquraPath2,
            uniswapTokenIn,
            uniswapTokenOut,
            uniswapFeeTier
        );

        // Initiate flash loan — Aave sends tokens here, then calls executeOperation()
        aavePool.flashLoanSimple(
            address(this),  // receiver
            inputToken,     // asset to borrow
            amountIn,       // amount to borrow
            params,         // forwarded to callback
            0               // referral code
        );
    }

    /// @notice Aave V3 flash loan callback. Called by the Pool after sending borrowed tokens.
    ///         Executes the arb, then approves repayment of principal + premium.
    ///         Any remaining profit is sent to the owner.
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(msg.sender == address(aavePool), "caller not pool");
        require(initiator == address(this), "initiator not self");

        // Decode arb params
        (
            uint8 direction,
            address[] memory eloquraPath1,
            address[] memory eloquraPath2,
            address uniswapTokenIn,
            address uniswapTokenOut,
            uint24 uniswapFeeTier
        ) = abi.decode(params, (uint8, address[], address[], address, address, uint24));

        uint256 deadline = block.timestamp + 300;

        // Execute the arb with borrowed funds
        if (direction == 0) {
            _executeDirectionA_mem(
                amount, eloquraPath1, eloquraPath2,
                uniswapTokenIn, uniswapTokenOut, uniswapFeeTier, deadline
            );
        } else {
            _executeDirectionB_mem(
                amount, eloquraPath1, eloquraPath2,
                uniswapTokenIn, uniswapTokenOut, uniswapFeeTier, deadline
            );
        }

        // Repay Aave: principal + premium
        uint256 amountOwed = amount + premium;
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance >= amountOwed, "flash loan unprofitable");

        IERC20(asset).approve(address(aavePool), amountOwed);

        // Send profit to owner
        uint256 profit = balance - amountOwed;
        if (profit > 0) {
            IERC20(asset).transfer(owner, profit);
        }

        return true;
    }

    // ─── Internal: Direction A (calldata paths — for self-funded execute) ─

    function _executeDirectionA(
        uint256 amountIn,
        address[] calldata eloquraPath1,
        address[] calldata eloquraPath2,
        address uniswapTokenIn,
        address uniswapTokenOut,
        uint24 uniswapFeeTier,
        uint256 deadline
    ) internal {
        IERC20(eloquraPath1[0]).approve(address(eloquraRouter), amountIn);
        uint256[] memory amounts1 = eloquraRouter.swapExactTokensForTokens(
            amountIn, 0, eloquraPath1, address(this), deadline
        );
        uint256 leg1Out = amounts1[amounts1.length - 1];

        IERC20(eloquraPath2[0]).approve(address(eloquraRouter), leg1Out);
        uint256[] memory amounts2 = eloquraRouter.swapExactTokensForTokens(
            leg1Out, 0, eloquraPath2, address(this), deadline
        );
        uint256 leg2Out = amounts2[amounts2.length - 1];

        eloquraWeth.withdraw(leg2Out);
        uniswapWeth.deposit{value: leg2Out}();

        uniswapWeth.approve(address(uniswapRouter), leg2Out);
        uniswapRouter.exactInputSingle(
            IUniswapRouter.ExactInputSingleParams({
                tokenIn: uniswapTokenIn,
                tokenOut: uniswapTokenOut,
                fee: uniswapFeeTier,
                recipient: address(this),
                amountIn: leg2Out,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function _executeDirectionB(
        uint256 amountIn,
        address[] calldata eloquraPath1,
        address[] calldata eloquraPath2,
        address uniswapTokenIn,
        address uniswapTokenOut,
        uint24 uniswapFeeTier,
        uint256 deadline
    ) internal {
        IERC20(uniswapTokenIn).approve(address(uniswapRouter), amountIn);
        uint256 leg1Out = uniswapRouter.exactInputSingle(
            IUniswapRouter.ExactInputSingleParams({
                tokenIn: uniswapTokenIn,
                tokenOut: uniswapTokenOut,
                fee: uniswapFeeTier,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );

        uniswapWeth.withdraw(leg1Out);
        eloquraWeth.deposit{value: leg1Out}();

        eloquraWeth.approve(address(eloquraRouter), leg1Out);
        uint256[] memory amounts2 = eloquraRouter.swapExactTokensForTokens(
            leg1Out, 0, eloquraPath1, address(this), deadline
        );
        uint256 leg2Out = amounts2[amounts2.length - 1];

        IERC20(eloquraPath2[0]).approve(address(eloquraRouter), leg2Out);
        eloquraRouter.swapExactTokensForTokens(
            leg2Out, 0, eloquraPath2, address(this), deadline
        );
    }

    // ─── Internal: Direction A/B (memory paths — for flash loan callback) ─

    function _executeDirectionA_mem(
        uint256 amountIn,
        address[] memory eloquraPath1,
        address[] memory eloquraPath2,
        address uniswapTokenIn,
        address uniswapTokenOut,
        uint24 uniswapFeeTier,
        uint256 deadline
    ) internal {
        IERC20(eloquraPath1[0]).approve(address(eloquraRouter), amountIn);
        uint256[] memory amounts1 = eloquraRouter.swapExactTokensForTokens(
            amountIn, 0, _toCalldata(eloquraPath1), address(this), deadline
        );
        uint256 leg1Out = amounts1[amounts1.length - 1];

        IERC20(eloquraPath2[0]).approve(address(eloquraRouter), leg1Out);
        uint256[] memory amounts2 = eloquraRouter.swapExactTokensForTokens(
            leg1Out, 0, _toCalldata(eloquraPath2), address(this), deadline
        );
        uint256 leg2Out = amounts2[amounts2.length - 1];

        eloquraWeth.withdraw(leg2Out);
        uniswapWeth.deposit{value: leg2Out}();

        uniswapWeth.approve(address(uniswapRouter), leg2Out);
        uniswapRouter.exactInputSingle(
            IUniswapRouter.ExactInputSingleParams({
                tokenIn: uniswapTokenIn,
                tokenOut: uniswapTokenOut,
                fee: uniswapFeeTier,
                recipient: address(this),
                amountIn: leg2Out,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
    }

    function _executeDirectionB_mem(
        uint256 amountIn,
        address[] memory eloquraPath1,
        address[] memory eloquraPath2,
        address uniswapTokenIn,
        address uniswapTokenOut,
        uint24 uniswapFeeTier,
        uint256 deadline
    ) internal {
        IERC20(uniswapTokenIn).approve(address(uniswapRouter), amountIn);
        uint256 leg1Out = uniswapRouter.exactInputSingle(
            IUniswapRouter.ExactInputSingleParams({
                tokenIn: uniswapTokenIn,
                tokenOut: uniswapTokenOut,
                fee: uniswapFeeTier,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );

        uniswapWeth.withdraw(leg1Out);
        eloquraWeth.deposit{value: leg1Out}();

        eloquraWeth.approve(address(eloquraRouter), leg1Out);
        uint256[] memory amounts2 = eloquraRouter.swapExactTokensForTokens(
            leg1Out, 0, _toCalldata(eloquraPath1), address(this), deadline
        );
        uint256 leg2Out = amounts2[amounts2.length - 1];

        IERC20(eloquraPath2[0]).approve(address(eloquraRouter), leg2Out);
        eloquraRouter.swapExactTokensForTokens(
            leg2Out, 0, _toCalldata(eloquraPath2), address(this), deadline
        );
    }

    /// @dev Helper to pass memory arrays to functions expecting calldata.
    ///      The Eloqura router expects calldata paths, but abi.decode gives memory.
    ///      This works because Solidity handles the conversion at the ABI level.
    function _toCalldata(address[] memory arr) internal pure returns (address[] memory) {
        return arr;
    }

    // ─── Admin ──────────────────────────────────────────────────────────

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    function rescueETH() external onlyOwner {
        (bool ok, ) = owner.call{value: address(this).balance}("");
        require(ok, "ETH transfer failed");
    }
}
