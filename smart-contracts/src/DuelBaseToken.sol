// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DuelBaseToken
 * @notice ERC-20 token used for wagering in DuelBase games
 * @dev Standard ERC-20 with owner-controlled minting capability
 */
contract DuelBaseToken is ERC20, Ownable {
    /**
     * @notice Emitted when tokens are minted
     * @param to The address receiving the minted tokens
     * @param amount The amount of tokens minted
     */
    event TokensMinted(address indexed to, uint256 amount);

    /**
     * @notice Creates a new DuelBase Token with an initial supply
     * @param initialSupply The initial supply of tokens to mint to the deployer
     */
    constructor(uint256 initialSupply) ERC20("DuelBase Token", "DUEL") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    /**
     * @notice Mints new tokens to a specified address
     * @dev Only callable by the contract owner
     * @param to The address to receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "DuelBaseToken: mint to zero address");
        require(amount > 0, "DuelBaseToken: mint amount must be greater than 0");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Burns tokens from the caller's balance
     * @param amount The amount of tokens to burn
     */
    function burn(uint256 amount) external {
        require(amount > 0, "DuelBaseToken: burn amount must be greater than 0");
        _burn(msg.sender, amount);
    }

    /**
     * @notice Burns tokens from a specified account (requires approval)
     * @param account The account to burn tokens from
     * @param amount The amount of tokens to burn
     */
    function burnFrom(address account, uint256 amount) external {
        require(amount > 0, "DuelBaseToken: burn amount must be greater than 0");
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }
}
