// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./EloquraRouter.sol";

/**
 * @title EloquraLimitOrders
 * @notice Limit order functionality for the Eloqura DEX
 * @dev Allows users to place orders that execute when price conditions are met
 */
contract EloquraLimitOrders is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    EloquraRouter public immutable router;

    struct Order {
        address owner;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;      // Minimum output (acts as limit price)
        uint256 triggerPrice;       // Price at which order becomes executable (scaled by 1e18)
        uint256 expiry;
        bool executed;
        bool cancelled;
    }

    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) public userOrders;

    uint256 public executorFeeBps = 10; // 0.1% fee for executors

    event OrderPlaced(
        uint256 indexed orderId,
        address indexed owner,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 triggerPrice,
        uint256 expiry
    );

    event OrderExecuted(
        uint256 indexed orderId,
        address indexed executor,
        uint256 amountIn,
        uint256 amountOut,
        uint256 executorFee
    );

    event OrderCancelled(uint256 indexed orderId);

    error OrderNotFound();
    error OrderAlreadyExecuted();
    error OrderAlreadyCancelled();
    error OrderExpired();
    error OrderNotExpired();
    error NotOrderOwner();
    error PriceConditionNotMet();
    error InvalidAmount();
    error InvalidExpiry();

    constructor(address _router) Ownable(msg.sender) {
        router = EloquraRouter(payable(_router));
    }

    /**
     * @notice Place a limit order
     * @param tokenIn Token to sell
     * @param tokenOut Token to buy
     * @param amountIn Amount of tokenIn to sell
     * @param minAmountOut Minimum amount of tokenOut to receive
     * @param triggerPrice Price (tokenOut/tokenIn * 1e18) at which order can execute
     * @param expiry Timestamp when order expires
     */
    function placeOrder(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 triggerPrice,
        uint256 expiry
    ) external nonReentrant returns (uint256 orderId) {
        if (amountIn == 0 || minAmountOut == 0) revert InvalidAmount();
        if (expiry <= block.timestamp) revert InvalidExpiry();

        // Transfer tokens to this contract
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        orderId = nextOrderId++;

        orders[orderId] = Order({
            owner: msg.sender,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            triggerPrice: triggerPrice,
            expiry: expiry,
            executed: false,
            cancelled: false
        });

        userOrders[msg.sender].push(orderId);

        emit OrderPlaced(orderId, msg.sender, tokenIn, tokenOut, amountIn, minAmountOut, triggerPrice, expiry);
    }

    /**
     * @notice Execute a limit order (can be called by anyone when conditions are met)
     * @param orderId The order to execute
     */
    function executeOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];

        if (order.owner == address(0)) revert OrderNotFound();
        if (order.executed) revert OrderAlreadyExecuted();
        if (order.cancelled) revert OrderAlreadyCancelled();
        if (block.timestamp > order.expiry) revert OrderExpired();

        // Check if price condition is met
        address[] memory path = new address[](2);
        path[0] = order.tokenIn;
        path[1] = order.tokenOut;

        uint256[] memory amounts = router.getAmountsOut(order.amountIn, path);
        uint256 expectedOut = amounts[1];

        // Calculate current price
        uint256 currentPrice = (expectedOut * 1e18) / order.amountIn;

        // For a buy limit order (buying tokenOut), we want price <= triggerPrice
        // For a sell limit order, we want price >= triggerPrice
        // Since this is a swap from tokenIn to tokenOut, higher price is better for user
        if (currentPrice < order.triggerPrice) revert PriceConditionNotMet();

        // Check minimum output
        if (expectedOut < order.minAmountOut) revert PriceConditionNotMet();

        // Mark as executed
        order.executed = true;

        // Calculate executor fee
        uint256 executorFee = (order.amountIn * executorFeeBps) / 10000;
        uint256 swapAmount = order.amountIn - executorFee;

        // Approve router
        IERC20(order.tokenIn).approve(address(router), swapAmount);

        // Execute swap
        uint256[] memory swapAmounts = router.swapExactTokensForTokens(
            swapAmount,
            order.minAmountOut,
            path,
            order.owner,
            block.timestamp
        );

        // Pay executor fee
        if (executorFee > 0) {
            IERC20(order.tokenIn).safeTransfer(msg.sender, executorFee);
        }

        emit OrderExecuted(orderId, msg.sender, swapAmount, swapAmounts[1], executorFee);
    }

    /**
     * @notice Cancel an order and refund tokens
     * @param orderId The order to cancel
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];

        if (order.owner == address(0)) revert OrderNotFound();
        if (order.executed) revert OrderAlreadyExecuted();
        if (order.cancelled) revert OrderAlreadyCancelled();
        if (msg.sender != order.owner) revert NotOrderOwner();

        order.cancelled = true;

        // Refund tokens
        IERC20(order.tokenIn).safeTransfer(order.owner, order.amountIn);

        emit OrderCancelled(orderId);
    }

    /**
     * @notice Claim expired order tokens
     * @param orderId The expired order
     */
    function claimExpired(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];

        if (order.owner == address(0)) revert OrderNotFound();
        if (order.executed) revert OrderAlreadyExecuted();
        if (order.cancelled) revert OrderAlreadyCancelled();
        if (block.timestamp <= order.expiry) revert OrderNotExpired();
        if (msg.sender != order.owner) revert NotOrderOwner();

        order.cancelled = true;

        // Refund tokens
        IERC20(order.tokenIn).safeTransfer(order.owner, order.amountIn);

        emit OrderCancelled(orderId);
    }

    /**
     * @notice Get order details
     */
    function getOrder(uint256 orderId) external view returns (
        address owner,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 triggerPrice,
        uint256 expiry,
        bool executed,
        bool cancelled
    ) {
        Order storage order = orders[orderId];
        return (
            order.owner,
            order.tokenIn,
            order.tokenOut,
            order.amountIn,
            order.minAmountOut,
            order.triggerPrice,
            order.expiry,
            order.executed,
            order.cancelled
        );
    }

    /**
     * @notice Get all orders for a user
     */
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    /**
     * @notice Check if an order is executable
     */
    function isExecutable(uint256 orderId) external view returns (bool executable, string memory reason) {
        Order storage order = orders[orderId];

        if (order.owner == address(0)) return (false, "Order not found");
        if (order.executed) return (false, "Already executed");
        if (order.cancelled) return (false, "Cancelled");
        if (block.timestamp > order.expiry) return (false, "Expired");

        // Check price
        address[] memory path = new address[](2);
        path[0] = order.tokenIn;
        path[1] = order.tokenOut;

        try router.getAmountsOut(order.amountIn, path) returns (uint256[] memory amounts) {
            uint256 expectedOut = amounts[1];
            uint256 currentPrice = (expectedOut * 1e18) / order.amountIn;

            if (currentPrice < order.triggerPrice) {
                return (false, "Price condition not met");
            }
            if (expectedOut < order.minAmountOut) {
                return (false, "Output below minimum");
            }

            return (true, "Executable");
        } catch {
            return (false, "Quote failed");
        }
    }

    /**
     * @notice Update executor fee (owner only)
     */
    function setExecutorFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 100, "Fee too high"); // Max 1%
        executorFeeBps = _feeBps;
    }
}
