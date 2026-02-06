// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./EloquraFactory.sol";
import "./EloquraPair.sol";

/**
 * @title EloquraRouter
 * @notice Router contract for executing swaps and managing liquidity
 * @dev Provides user-facing functions with deadline and slippage protection
 */
contract EloquraRouter {
    using SafeERC20 for IERC20;

    address public immutable factory;
    address public immutable WETH;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "EXPIRED");
        _;
    }

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }

    receive() external payable {
        assert(msg.sender == WETH);
    }

    // ============ ADD LIQUIDITY ============

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal returns (uint256 amountA, uint256 amountB) {
        // Create pair if it doesn't exist
        if (EloquraFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            EloquraFactory(factory).createPair(tokenA, tokenB);
        }

        address pair = EloquraFactory(factory).getPair(tokenA, tokenB);
        (uint112 reserve0, uint112 reserve1,) = EloquraPair(pair).getReserves();

        // Sort tokens to match pair order
        (address token0,) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (uint256 reserveA, uint256 reserveB) = tokenA == token0
            ? (uint256(reserve0), uint256(reserve1))
            : (uint256(reserve1), uint256(reserve0));

        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, "INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);

        address pair = EloquraFactory(factory).getPair(tokenA, tokenB);

        IERC20(tokenA).safeTransferFrom(msg.sender, pair, amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, pair, amountB);

        liquidity = EloquraPair(pair).mint(to);
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        (amountToken, amountETH) = _addLiquidity(
            token,
            WETH,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountETHMin
        );

        address pair = EloquraFactory(factory).getPair(token, WETH);

        IERC20(token).safeTransferFrom(msg.sender, pair, amountToken);
        IWETH(WETH).deposit{value: amountETH}();
        assert(IWETH(WETH).transfer(pair, amountETH));

        liquidity = EloquraPair(pair).mint(to);

        // Refund dust ETH
        if (msg.value > amountETH) {
            (bool success,) = msg.sender.call{value: msg.value - amountETH}("");
            require(success, "ETH_REFUND_FAILED");
        }
    }

    // ============ REMOVE LIQUIDITY ============

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pair = EloquraFactory(factory).getPair(tokenA, tokenB);

        IERC20(pair).safeTransferFrom(msg.sender, pair, liquidity);

        (uint256 amount0, uint256 amount1) = EloquraPair(pair).burn(to);

        (address token0,) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);

        require(amountA >= amountAMin, "INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "INSUFFICIENT_B_AMOUNT");
    }

    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountToken, uint256 amountETH) {
        (amountToken, amountETH) = removeLiquidity(
            token,
            WETH,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );

        IERC20(token).safeTransfer(to, amountToken);
        IWETH(WETH).withdraw(amountETH);

        (bool success,) = to.call{value: amountETH}("");
        require(success, "ETH_TRANSFER_FAILED");
    }

    // ============ SWAP ============

    function _swap(uint256[] memory amounts, address[] memory path, address _to) internal {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = input < output ? (input, output) : (output, input);

            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));

            address to = i < path.length - 2
                ? EloquraFactory(factory).getPair(output, path[i + 2])
                : _to;

            EloquraPair(EloquraFactory(factory).getPair(input, output)).swap(
                amount0Out,
                amount1Out,
                to,
                new bytes(0)
            );
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");

        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            EloquraFactory(factory).getPair(path[0], path[1]),
            amounts[0]
        );

        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = getAmountsIn(amountOut, path);
        require(amounts[0] <= amountInMax, "EXCESSIVE_INPUT_AMOUNT");

        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            EloquraFactory(factory).getPair(path[0], path[1]),
            amounts[0]
        );

        _swap(amounts, path, to);
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WETH, "INVALID_PATH");

        amounts = getAmountsOut(msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");

        IWETH(WETH).deposit{value: amounts[0]}();
        assert(IWETH(WETH).transfer(EloquraFactory(factory).getPair(path[0], path[1]), amounts[0]));

        _swap(amounts, path, to);
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, "INVALID_PATH");

        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");

        IERC20(path[0]).safeTransferFrom(
            msg.sender,
            EloquraFactory(factory).getPair(path[0], path[1]),
            amounts[0]
        );

        _swap(amounts, path, address(this));

        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        (bool success,) = to.call{value: amounts[amounts.length - 1]}("");
        require(success, "ETH_TRANSFER_FAILED");
    }

    // ============ LIBRARY FUNCTIONS ============

    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) public pure returns (uint256 amountB) {
        require(amountA > 0, "INSUFFICIENT_AMOUNT");
        require(reserveA > 0 && reserveB > 0, "INSUFFICIENT_LIQUIDITY");
        amountB = (amountA * reserveB) / reserveA;
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQUIDITY");

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;

        amountOut = numerator / denominator;
    }

    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountIn) {
        require(amountOut > 0, "INSUFFICIENT_OUTPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQUIDITY");

        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;

        amountIn = (numerator / denominator) + 1;
    }

    function getAmountsOut(uint256 amountIn, address[] memory path) public view returns (uint256[] memory amounts) {
        require(path.length >= 2, "INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;

        for (uint256 i; i < path.length - 1; i++) {
            address pair = EloquraFactory(factory).getPair(path[i], path[i + 1]);
            require(pair != address(0), "PAIR_NOT_FOUND");

            (uint112 reserve0, uint112 reserve1,) = EloquraPair(pair).getReserves();
            (address token0,) = path[i] < path[i + 1] ? (path[i], path[i + 1]) : (path[i + 1], path[i]);

            (uint256 reserveIn, uint256 reserveOut) = path[i] == token0
                ? (uint256(reserve0), uint256(reserve1))
                : (uint256(reserve1), uint256(reserve0));

            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    function getAmountsIn(uint256 amountOut, address[] memory path) public view returns (uint256[] memory amounts) {
        require(path.length >= 2, "INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;

        for (uint256 i = path.length - 1; i > 0; i--) {
            address pair = EloquraFactory(factory).getPair(path[i - 1], path[i]);
            require(pair != address(0), "PAIR_NOT_FOUND");

            (uint112 reserve0, uint112 reserve1,) = EloquraPair(pair).getReserves();
            (address token0,) = path[i - 1] < path[i] ? (path[i - 1], path[i]) : (path[i], path[i - 1]);

            (uint256 reserveIn, uint256 reserveOut) = path[i - 1] == token0
                ? (uint256(reserve0), uint256(reserve1))
                : (uint256(reserve1), uint256(reserve0));

            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }

    /// @notice Get swap quote for frontend
    function getSwapQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (
        uint256 amountOut,
        uint256 priceImpact,
        uint256 fee
    ) {
        address pair = EloquraFactory(factory).getPair(tokenIn, tokenOut);

        if (pair == address(0)) {
            return (0, 0, 0);
        }

        (uint112 reserve0, uint112 reserve1,) = EloquraPair(pair).getReserves();
        (address token0,) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);

        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0
            ? (uint256(reserve0), uint256(reserve1))
            : (uint256(reserve1), uint256(reserve0));

        if (reserveIn == 0 || reserveOut == 0) {
            return (0, 0, 0);
        }

        // Calculate output
        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);

        // Calculate price impact (in basis points)
        uint256 spotPrice = (reserveOut * 1e18) / reserveIn;
        uint256 executionPrice = (amountOut * 1e18) / amountIn;
        priceImpact = spotPrice > executionPrice
            ? ((spotPrice - executionPrice) * 10000) / spotPrice
            : 0;

        // Fee is 0.3% of input
        fee = (amountIn * 30) / 10000;
    }
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function transfer(address to, uint256 value) external returns (bool);
}
