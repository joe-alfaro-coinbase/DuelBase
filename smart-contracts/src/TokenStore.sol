// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenStore
 * @notice Allows users to purchase DUEL tokens with USDC
 * @dev Simple token swap contract with owner-configurable pricing
 */
contract TokenStore is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice The DUEL token being sold
    IERC20 public immutable duelToken;

    /// @notice The USDC token used for payment
    IERC20 public immutable usdc;

    /// @notice Price per 1 DUEL token in USDC (6 decimals)
    /// @dev For example, 10000 = 0.01 USDC per DUEL token
    uint256 public pricePerToken;

    /// @notice Whether the store is currently open for purchases
    bool public isOpen;

    // ============ Constants ============

    /// @notice DUEL token decimals (18)
    uint256 public constant DUEL_DECIMALS = 18;

    /// @notice USDC decimals (6)
    uint256 public constant USDC_DECIMALS = 6;

    /// @notice Decimal adjustment factor (10^12)
    uint256 public constant DECIMAL_ADJUSTMENT = 10 ** (DUEL_DECIMALS - USDC_DECIMALS);

    // ============ Events ============

    event TokensPurchased(
        address indexed buyer,
        uint256 duelAmount,
        uint256 usdcPaid
    );

    event PriceUpdated(uint256 oldPrice, uint256 newPrice);

    event StoreStatusChanged(bool isOpen);

    event TokensWithdrawn(address indexed to, uint256 amount);

    event UsdcWithdrawn(address indexed to, uint256 amount);

    // ============ Errors ============

    error InvalidAddress();
    error InvalidAmount();
    error InvalidPrice();
    error StoreClosed();
    error InsufficientInventory();

    // ============ Constructor ============

    /**
     * @notice Creates a new TokenStore
     * @param _duelToken The DUEL token address
     * @param _usdc The USDC token address
     * @param _pricePerToken Initial price per DUEL token in USDC (6 decimals)
     */
    constructor(
        address _duelToken,
        address _usdc,
        uint256 _pricePerToken
    ) Ownable(msg.sender) {
        if (_duelToken == address(0) || _usdc == address(0)) {
            revert InvalidAddress();
        }
        if (_pricePerToken == 0) {
            revert InvalidPrice();
        }

        duelToken = IERC20(_duelToken);
        usdc = IERC20(_usdc);
        pricePerToken = _pricePerToken;
        isOpen = true;
    }

    // ============ External Functions ============

    /**
     * @notice Purchases DUEL tokens with USDC
     * @param duelAmount The amount of DUEL tokens to purchase (18 decimals)
     */
    function buyTokens(uint256 duelAmount) external nonReentrant {
        if (!isOpen) {
            revert StoreClosed();
        }
        if (duelAmount == 0) {
            revert InvalidAmount();
        }

        // Calculate USDC cost
        // Formula: (duelAmount * pricePerToken) / 10^18
        // pricePerToken is in USDC (6 decimals) per 1 DUEL (18 decimals)
        uint256 usdcCost = (duelAmount * pricePerToken) / (10 ** DUEL_DECIMALS);

        if (usdcCost == 0) {
            revert InvalidAmount();
        }

        // Check inventory
        uint256 inventory = duelToken.balanceOf(address(this));
        if (inventory < duelAmount) {
            revert InsufficientInventory();
        }

        // Transfer USDC from buyer
        usdc.safeTransferFrom(msg.sender, address(this), usdcCost);

        // Transfer DUEL to buyer
        duelToken.safeTransfer(msg.sender, duelAmount);

        emit TokensPurchased(msg.sender, duelAmount, usdcCost);
    }

    // ============ Admin Functions ============

    /**
     * @notice Updates the price per DUEL token
     * @param newPrice The new price in USDC (6 decimals)
     */
    function setPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) {
            revert InvalidPrice();
        }

        uint256 oldPrice = pricePerToken;
        pricePerToken = newPrice;

        emit PriceUpdated(oldPrice, newPrice);
    }

    /**
     * @notice Opens or closes the store
     * @param _isOpen Whether the store should be open
     */
    function setStoreStatus(bool _isOpen) external onlyOwner {
        isOpen = _isOpen;
        emit StoreStatusChanged(_isOpen);
    }

    /**
     * @notice Withdraws DUEL tokens from the store
     * @param to The address to send tokens to
     * @param amount The amount of tokens to withdraw
     */
    function withdrawTokens(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        duelToken.safeTransfer(to, amount);

        emit TokensWithdrawn(to, amount);
    }

    /**
     * @notice Withdraws USDC from the store
     * @param to The address to send USDC to
     * @param amount The amount of USDC to withdraw
     */
    function withdrawUsdc(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) {
            revert InvalidAddress();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        usdc.safeTransfer(to, amount);

        emit UsdcWithdrawn(to, amount);
    }

    /**
     * @notice Withdraws all USDC from the store
     * @param to The address to send USDC to
     */
    function withdrawAllUsdc(address to) external onlyOwner {
        if (to == address(0)) {
            revert InvalidAddress();
        }

        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) {
            revert InvalidAmount();
        }

        usdc.safeTransfer(to, balance);

        emit UsdcWithdrawn(to, balance);
    }

    // ============ View Functions ============

    /**
     * @notice Gets the current DUEL token inventory
     * @return The amount of DUEL tokens available for purchase
     */
    function getInventory() external view returns (uint256) {
        return duelToken.balanceOf(address(this));
    }

    /**
     * @notice Gets the current USDC balance
     * @return The amount of USDC in the store
     */
    function getUsdcBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Calculates the USDC cost for a given amount of DUEL tokens
     * @param duelAmount The amount of DUEL tokens to purchase
     * @return The USDC cost
     */
    function calculateCost(uint256 duelAmount) external view returns (uint256) {
        return (duelAmount * pricePerToken) / (10 ** DUEL_DECIMALS);
    }

    /**
     * @notice Calculates how many DUEL tokens can be bought with a given USDC amount
     * @param usdcAmount The amount of USDC to spend
     * @return The amount of DUEL tokens that can be purchased
     */
    function calculateTokensForUsdc(
        uint256 usdcAmount
    ) external view returns (uint256) {
        return (usdcAmount * (10 ** DUEL_DECIMALS)) / pricePerToken;
    }
}
