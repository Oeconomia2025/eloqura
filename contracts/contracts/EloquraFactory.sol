// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EloquraPair.sol";

/**
 * @title EloquraFactory
 * @notice Factory contract for creating Eloqura trading pairs
 * @dev Creates and tracks all trading pairs in the DEX
 */
contract EloquraFactory {
    address public feeTo;
    address public feeToSetter;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    // Fee tiers: 5 = 0.05%, 25 = 0.25%, 50 = 0.5%, 100 = 1%
    uint256[] public feeTiers = [5, 25, 50, 100];

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 pairIndex);
    event FeeToUpdated(address indexed oldFeeTo, address indexed newFeeTo);
    event FeeToSetterUpdated(address indexed oldSetter, address indexed newSetter);

    error IdenticalAddresses();
    error ZeroAddress();
    error PairExists();
    error Forbidden();

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        if (tokenA == tokenB) revert IdenticalAddresses();

        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        if (token0 == address(0)) revert ZeroAddress();
        if (getPair[token0][token1] != address(0)) revert PairExists();

        bytes memory bytecode = type(EloquraPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));

        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        EloquraPair(pair).initialize(token0, token1);

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function setFeeTo(address _feeTo) external {
        if (msg.sender != feeToSetter) revert Forbidden();
        address oldFeeTo = feeTo;
        feeTo = _feeTo;
        emit FeeToUpdated(oldFeeTo, _feeTo);
    }

    function setFeeToSetter(address _feeToSetter) external {
        if (msg.sender != feeToSetter) revert Forbidden();
        address oldSetter = feeToSetter;
        feeToSetter = _feeToSetter;
        emit FeeToSetterUpdated(oldSetter, _feeToSetter);
    }

    function getFeeTiers() external view returns (uint256[] memory) {
        return feeTiers;
    }

    /// @notice Compute pair address without calling the factory
    function pairFor(address tokenA, address tokenB) external view returns (address) {
        return getPair[tokenA][tokenB];
    }
}
