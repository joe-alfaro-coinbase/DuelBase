# DuelBase Smart Contracts

Solidity smart contracts for the DuelBase 1v1 gaming platform on Base.

## Contracts

### DuelBaseToken (`src/DuelBaseToken.sol`)

ERC-20 token used for wagering in games.

- **Name:** DuelBase Token
- **Symbol:** DUEL
- **Decimals:** 18
- **Features:** Standard ERC-20 + owner-controlled minting + burn functions

### GameManager (`src/GameManager.sol`)

Escrow contract for managing game wagers and payouts.

- Create games with specified opponent and wager amount
- First player pays a configurable edge percentage (default: 5% for Tic-Tac-Toe, 3% for Connect Four)
- Backend-signed winner verification using EIP-712 typed data
- Cancel games after timeout if opponent doesn't join
- ReentrancyGuard protected

### TokenStore (`src/TokenStore.sol`)

Store for purchasing DUEL tokens with USDC.

- Configurable price per token
- Owner can open/close store
- Withdraw USDC proceeds

## Development

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### Build

```bash
forge build
```

### Test

```bash
forge test
```

Run with verbosity:

```bash
forge test -vvv
```

### Gas Report

```bash
forge test --gas-report
```

## Deployment

### Local Testing

```bash
forge script script/Deploy.s.sol:DeployDuelBaseLocal --broadcast
```

### Testnet (Base Sepolia)

1. Set environment variables:

```bash
export PRIVATE_KEY=<your-deployer-private-key>
export BACKEND_SIGNER=<backend-signer-address>
export AIRDROP_WALLET=<optional-airdrop-wallet-address>
```

2. Deploy:

```bash
forge script script/Deploy.s.sol:DeployDuelBase \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify
```

### Mainnet (Base)

```bash
forge script script/Deploy.s.sol:DeployDuelBase \
  --rpc-url https://mainnet.base.org \
  --broadcast \
  --verify
```

## Contract Addresses

| Contract | Base Sepolia | Base Mainnet |
|----------|--------------|--------------|
| DuelBaseToken | TBD | TBD |
| GameManager | TBD | TBD |
| TokenStore | TBD | TBD |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  DuelBaseToken  │     │   GameManager   │     │   TokenStore    │
│    (ERC-20)     │◄────│    (Escrow)     │     │   (USDC→DUEL)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                       ▲                       ▲
        │                       │                       │
        │    ┌─────────────┐    │                       │
        └────│   Players   │────┘                       │
             └─────────────┘                            │
                    │                                   │
                    └───────────────────────────────────┘
```

## Game Flow

1. **Create Game:** Player 1 calls `createGame(opponent, wagerAmount, gameType)`
   - Player 1 deposits `wagerAmount + edge`
   - Game status: `Created`

2. **Join Game:** Player 2 calls `joinGame(gameId)`
   - Player 2 deposits `wagerAmount`
   - Game status: `Active`

3. **Play:** Game logic runs off-chain (frontend)

4. **Complete Game:** Backend signs winner, anyone can call `completeGame(gameId, winner, signature)`
   - Winner receives total pot
   - Game status: `Completed`

5. **Cancel (Optional):** If Player 2 doesn't join within timeout, Player 1 can call `cancelGame(gameId)`
   - Player 1 gets refund
   - Game status: `Cancelled`

## Backend Signature

The backend signs game results using EIP-712 typed data:

```solidity
// Domain
{
    name: "DuelBase",
    version: "1",
    chainId: <chain-id>,
    verifyingContract: <GameManager-address>
}

// Type
GameResult(uint256 gameId, address winner)
```

Example signing (ethers.js):

```javascript
const domain = {
    name: "DuelBase",
    version: "1",
    chainId: 8453, // Base mainnet
    verifyingContract: gameManagerAddress
};

const types = {
    GameResult: [
        { name: "gameId", type: "uint256" },
        { name: "winner", type: "address" }
    ]
};

const value = {
    gameId: gameId,
    winner: winnerAddress
};

const signature = await signer._signTypedData(domain, types, value);
```

## Configuration

### Edge Percentages

Default first-player advantage edges (configurable by owner):

| Game Type | Edge |
|-----------|------|
| Tic-Tac-Toe | 5% |
| Connect Four | 3% |

### Timeouts

| Setting | Default |
|---------|---------|
| Cancel Timeout | 24 hours |

### Token Economics

| Allocation | Amount |
|------------|--------|
| Initial Supply | 1,000,000,000 DUEL |
| Store Inventory | 100,000,000 DUEL |
| Airdrop Pool | 200,000,000 DUEL |
| Initial Price | 0.01 USDC per DUEL |

## Security

- ReentrancyGuard on all state-changing functions
- SafeERC20 for token transfers
- EIP-712 typed data signatures for winner verification
- Signature replay protection
- Ownable access control for admin functions

## License

MIT
