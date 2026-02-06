// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title EloquraPair
 * @notice AMM liquidity pool for a token pair
 * @dev Implements constant product market maker (x * y = k)
 */
contract EloquraPair is ERC20, ReentrancyGuard {
    using Math for uint256;

    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public swapFeeBps = 30; // 0.3% default fee

    address public factory;
    address public token0;
    address public token1;

    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;
    uint256 public kLast; // reserve0 * reserve1, as of immediately after the most recent liquidity event

    // Position tracking for concentrated liquidity-like features
    struct Position {
        uint128 liquidity;
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    mapping(address => Position) public positions;
    uint256 public feeGrowthGlobal0X128;
    uint256 public feeGrowthGlobal1X128;

    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Sync(uint112 reserve0, uint112 reserve1);
    event FeesCollected(address indexed owner, uint256 amount0, uint256 amount1);

    error Locked();
    error Overflow();
    error InsufficientLiquidityMinted();
    error InsufficientLiquidityBurned();
    error InsufficientOutputAmount();
    error InsufficientInputAmount();
    error InsufficientLiquidity();
    error InvalidTo();
    error InvalidK();
    error Forbidden();

    constructor() ERC20("Eloqura LP Token", "ELQ-LP") {
        factory = msg.sender;
    }

    function initialize(address _token0, address _token1) external {
        if (msg.sender != factory) revert Forbidden();
        token0 = _token0;
        token1 = _token1;
    }

    function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    function _update(uint256 balance0, uint256 balance1, uint112 _reserve0, uint112 _reserve1) private {
        if (balance0 > type(uint112).max || balance1 > type(uint112).max) revert Overflow();

        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed;
        unchecked {
            timeElapsed = blockTimestamp - blockTimestampLast;
        }

        if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
            unchecked {
                price0CumulativeLast += uint256(_reserve1) * timeElapsed / _reserve0;
                price1CumulativeLast += uint256(_reserve0) * timeElapsed / _reserve1;
            }
        }

        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = blockTimestamp;

        emit Sync(reserve0, reserve1);
    }

    function _mintFee(uint112 _reserve0, uint112 _reserve1) private returns (bool feeOn) {
        address feeTo = IEloquraFactory(factory).feeTo();
        feeOn = feeTo != address(0);
        uint256 _kLast = kLast;

        if (feeOn) {
            if (_kLast != 0) {
                uint256 rootK = Math.sqrt(uint256(_reserve0) * _reserve1);
                uint256 rootKLast = Math.sqrt(_kLast);
                if (rootK > rootKLast) {
                    uint256 numerator = totalSupply() * (rootK - rootKLast);
                    uint256 denominator = rootK * 5 + rootKLast;
                    uint256 liquidity = numerator / denominator;
                    if (liquidity > 0) _mint(feeTo, liquidity);
                }
            }
        } else if (_kLast != 0) {
            kLast = 0;
        }
    }

    function mint(address to) external nonReentrant returns (uint256 liquidity) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 amount0 = balance0 - _reserve0;
        uint256 amount1 = balance1 - _reserve1;

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint256 _totalSupply = totalSupply();

        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0xdead), MINIMUM_LIQUIDITY); // permanently lock first MINIMUM_LIQUIDITY
        } else {
            liquidity = Math.min(
                (amount0 * _totalSupply) / _reserve0,
                (amount1 * _totalSupply) / _reserve1
            );
        }

        if (liquidity == 0) revert InsufficientLiquidityMinted();

        _mint(to, liquidity);

        // Track position
        positions[to].liquidity += uint128(liquidity);

        _update(balance0, balance1, _reserve0, _reserve1);

        if (feeOn) kLast = uint256(reserve0) * reserve1;

        emit Mint(msg.sender, amount0, amount1);
    }

    function burn(address to) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        address _token0 = token0;
        address _token1 = token1;
        uint256 balance0 = IERC20(_token0).balanceOf(address(this));
        uint256 balance1 = IERC20(_token1).balanceOf(address(this));
        uint256 liquidity = balanceOf(address(this));

        bool feeOn = _mintFee(_reserve0, _reserve1);
        uint256 _totalSupply = totalSupply();

        amount0 = (liquidity * balance0) / _totalSupply;
        amount1 = (liquidity * balance1) / _totalSupply;

        if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidityBurned();

        _burn(address(this), liquidity);

        _safeTransfer(_token0, to, amount0);
        _safeTransfer(_token1, to, amount1);

        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));

        _update(balance0, balance1, _reserve0, _reserve1);

        if (feeOn) kLast = uint256(reserve0) * reserve1;

        emit Burn(msg.sender, amount0, amount1, to);
    }

    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external nonReentrant {
        if (amount0Out == 0 && amount1Out == 0) revert InsufficientOutputAmount();

        (uint112 _reserve0, uint112 _reserve1,) = getReserves();

        if (amount0Out >= _reserve0 || amount1Out >= _reserve1) revert InsufficientLiquidity();

        uint256 balance0;
        uint256 balance1;
        {
            address _token0 = token0;
            address _token1 = token1;

            if (to == _token0 || to == _token1) revert InvalidTo();

            if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out);
            if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out);

            if (data.length > 0) {
                IEloquraCallee(to).eloquraCall(msg.sender, amount0Out, amount1Out, data);
            }

            balance0 = IERC20(_token0).balanceOf(address(this));
            balance1 = IERC20(_token1).balanceOf(address(this));
        }

        uint256 amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;

        if (amount0In == 0 && amount1In == 0) revert InsufficientInputAmount();

        {
            // Apply fee (0.3% = 30 bps)
            uint256 balance0Adjusted = balance0 * FEE_DENOMINATOR - amount0In * swapFeeBps;
            uint256 balance1Adjusted = balance1 * FEE_DENOMINATOR - amount1In * swapFeeBps;

            if (balance0Adjusted * balance1Adjusted < uint256(_reserve0) * _reserve1 * (FEE_DENOMINATOR ** 2)) {
                revert InvalidK();
            }

            // Update fee growth for LPs
            if (amount0In > 0) {
                uint256 fee0 = (amount0In * swapFeeBps) / FEE_DENOMINATOR;
                feeGrowthGlobal0X128 += (fee0 << 128) / totalSupply();
            }
            if (amount1In > 0) {
                uint256 fee1 = (amount1In * swapFeeBps) / FEE_DENOMINATOR;
                feeGrowthGlobal1X128 += (fee1 << 128) / totalSupply();
            }
        }

        _update(balance0, balance1, _reserve0, _reserve1);

        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

    /// @notice Force balances to match reserves
    function skim(address to) external nonReentrant {
        address _token0 = token0;
        address _token1 = token1;
        _safeTransfer(_token0, to, IERC20(_token0).balanceOf(address(this)) - reserve0);
        _safeTransfer(_token1, to, IERC20(_token1).balanceOf(address(this)) - reserve1);
    }

    /// @notice Force reserves to match balances
    function sync() external nonReentrant {
        _update(
            IERC20(token0).balanceOf(address(this)),
            IERC20(token1).balanceOf(address(this)),
            reserve0,
            reserve1
        );
    }

    /// @notice Collect accumulated fees for a liquidity provider
    function collectFees(address owner) external returns (uint256 amount0, uint256 amount1) {
        Position storage position = positions[owner];

        amount0 = uint256(position.tokensOwed0);
        amount1 = uint256(position.tokensOwed1);

        if (amount0 > 0) {
            position.tokensOwed0 = 0;
            _safeTransfer(token0, owner, amount0);
        }
        if (amount1 > 0) {
            position.tokensOwed1 = 0;
            _safeTransfer(token1, owner, amount1);
        }

        emit FeesCollected(owner, amount0, amount1);
    }

    /// @notice Get position info for a liquidity provider
    function getPosition(address owner) external view returns (
        uint128 liquidity,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    ) {
        Position storage position = positions[owner];
        return (position.liquidity, position.tokensOwed0, position.tokensOwed1);
    }

    /// @notice Get current price (token1 per token0)
    function getPrice() external view returns (uint256) {
        if (reserve0 == 0) return 0;
        return (uint256(reserve1) * 1e18) / reserve0;
    }

    /// @notice Calculate output amount for a given input
    function getAmountOut(uint256 amountIn, bool zeroForOne) external view returns (uint256 amountOut) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();

        uint256 reserveIn = zeroForOne ? _reserve0 : _reserve1;
        uint256 reserveOut = zeroForOne ? _reserve1 : _reserve0;

        uint256 amountInWithFee = amountIn * (FEE_DENOMINATOR - swapFeeBps);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * FEE_DENOMINATOR + amountInWithFee;

        amountOut = numerator / denominator;
    }

    /// @notice Calculate input amount for a given output
    function getAmountIn(uint256 amountOut, bool zeroForOne) external view returns (uint256 amountIn) {
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();

        uint256 reserveIn = zeroForOne ? _reserve0 : _reserve1;
        uint256 reserveOut = zeroForOne ? _reserve1 : _reserve0;

        uint256 numerator = reserveIn * amountOut * FEE_DENOMINATOR;
        uint256 denominator = (reserveOut - amountOut) * (FEE_DENOMINATOR - swapFeeBps);

        amountIn = (numerator / denominator) + 1;
    }

    function _safeTransfer(address token, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }
}

interface IEloquraFactory {
    function feeTo() external view returns (address);
}

interface IEloquraCallee {
    function eloquraCall(address sender, uint256 amount0, uint256 amount1, bytes calldata data) external;
}
