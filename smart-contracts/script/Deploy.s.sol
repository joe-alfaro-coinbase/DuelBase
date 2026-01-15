// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DuelBaseToken} from "../src/DuelBaseToken.sol";
import {GameManager} from "../src/GameManager.sol";
import {TokenStore} from "../src/TokenStore.sol";

/**
 * @title DeployDuelBase
 * @notice Deployment script for all DuelBase contracts
 * @dev Run with: forge script script/Deploy.s.sol:DeployDuelBase --rpc-url <rpc> --broadcast
 */
contract DeployDuelBase is Script {
    // ============ Configuration ============

    // Initial token supply: 1 billion DUEL
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 1e18;

    // Store inventory allocation: 100 million DUEL
    uint256 public constant STORE_INVENTORY = 100_000_000 * 1e18;

    // Airdrop pool allocation: 200 million DUEL
    uint256 public constant AIRDROP_POOL = 200_000_000 * 1e18;

    // Initial price: 0.01 USDC per DUEL (10000 in 6 decimal USDC)
    uint256 public constant INITIAL_PRICE = 10000;

    // Base Mainnet USDC address
    address public constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    // Base Sepolia USDC address (mock for testing)
    address public constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // ============ Deployed Contracts ============

    DuelBaseToken public duelToken;
    GameManager public gameManager;
    TokenStore public tokenStore;

    function run() external {
        // Get deployment configuration from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address backendSigner = vm.envAddress("BACKEND_SIGNER");
        address airdropWallet = vm.envOr("AIRDROP_WALLET", msg.sender);

        // Determine USDC address based on chain
        address usdcAddress = _getUsdcAddress();

        console.log("Deploying DuelBase contracts...");
        console.log("Chain ID:", block.chainid);
        console.log("Backend Signer:", backendSigner);
        console.log("USDC Address:", usdcAddress);
        console.log("Airdrop Wallet:", airdropWallet);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy DuelBaseToken
        duelToken = new DuelBaseToken(INITIAL_SUPPLY);
        console.log("DuelBaseToken deployed at:", address(duelToken));

        // 2. Deploy GameManager
        gameManager = new GameManager(address(duelToken), backendSigner);
        console.log("GameManager deployed at:", address(gameManager));

        // 3. Deploy TokenStore
        tokenStore = new TokenStore(address(duelToken), usdcAddress, INITIAL_PRICE);
        console.log("TokenStore deployed at:", address(tokenStore));

        // 4. Transfer tokens to TokenStore
        duelToken.transfer(address(tokenStore), STORE_INVENTORY);
        console.log("Transferred", STORE_INVENTORY / 1e18, "DUEL to TokenStore");

        // 5. Transfer tokens to airdrop wallet
        duelToken.transfer(airdropWallet, AIRDROP_POOL);
        console.log("Transferred", AIRDROP_POOL / 1e18, "DUEL to airdrop wallet");

        vm.stopBroadcast();

        // Log summary
        console.log("\n=== Deployment Summary ===");
        console.log("DuelBaseToken:", address(duelToken));
        console.log("GameManager:", address(gameManager));
        console.log("TokenStore:", address(tokenStore));
        console.log("\nToken Distribution:");
        console.log("- Store Inventory:", STORE_INVENTORY / 1e18, "DUEL");
        console.log("- Airdrop Pool:", AIRDROP_POOL / 1e18, "DUEL");
        console.log("- Remaining (Deployer):", (INITIAL_SUPPLY - STORE_INVENTORY - AIRDROP_POOL) / 1e18, "DUEL");
    }

    function _getUsdcAddress() internal view returns (address) {
        if (block.chainid == 8453) {
            // Base Mainnet
            return BASE_MAINNET_USDC;
        } else if (block.chainid == 84532) {
            // Base Sepolia
            return BASE_SEPOLIA_USDC;
        } else {
            // For local testing, use env variable or revert
            address customUsdc = vm.envOr("USDC_ADDRESS", address(0));
            require(customUsdc != address(0), "USDC_ADDRESS env var required for this chain");
            return customUsdc;
        }
    }
}

/**
 * @title DeployDuelBaseLocal
 * @notice Deployment script for local testing with mock USDC
 * @dev Run with: forge script script/Deploy.s.sol:DeployDuelBaseLocal --broadcast
 */
contract DeployDuelBaseLocal is Script {
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public constant STORE_INVENTORY = 100_000_000 * 1e18;
    uint256 public constant INITIAL_PRICE = 10000;

    function run() external {
        vm.startBroadcast();

        // Deploy mock USDC
        MockUSDC mockUsdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(mockUsdc));

        // Deploy DuelBaseToken
        DuelBaseToken duelToken = new DuelBaseToken(INITIAL_SUPPLY);
        console.log("DuelBaseToken deployed at:", address(duelToken));

        // Deploy GameManager with deployer as backend signer for testing
        GameManager gameManager = new GameManager(address(duelToken), msg.sender);
        console.log("GameManager deployed at:", address(gameManager));

        // Deploy TokenStore
        TokenStore tokenStore = new TokenStore(address(duelToken), address(mockUsdc), INITIAL_PRICE);
        console.log("TokenStore deployed at:", address(tokenStore));

        // Transfer tokens to TokenStore
        duelToken.transfer(address(tokenStore), STORE_INVENTORY);
        console.log("Transferred", STORE_INVENTORY / 1e18, "DUEL to TokenStore");

        // Mint some USDC to deployer for testing
        mockUsdc.mint(msg.sender, 1_000_000 * 1e6);
        console.log("Minted 1,000,000 USDC to deployer");

        vm.stopBroadcast();
    }
}

/**
 * @title MockUSDC
 * @notice Mock USDC for local testing
 */
contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
