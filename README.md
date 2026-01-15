# DuelBase

1v1 wagering games on Base. Play Tic-Tac-Toe, Connect 4, and more with DUEL token stakes.

🎮 **Live App**: [https://duel-base.vercel.app](https://duel-base.vercel.app)

## Features

- ⚔️ **1v1 Wagering Games** - Challenge friends to Tic-Tac-Toe or Connect 4
- 🪙 **DUEL Token** - Buy DUEL tokens with USDC to place wagers
- ⏱️ **Turn Timer** - 60-second turn limit keeps games moving
- 💰 **Smart Contract Escrow** - Secure wagering via GameManager contract
- 🔗 **Invite Links** - Share a link to challenge anyone

## Smart Contracts (Base Sepolia)

- **DUEL Token**: `0x84d46e11EdD0fB5d8bAb68E55DF1D8Cd10B91FfB`
- **GameManager**: `0xA40b4539d79ed767C8603e7f2E8F12D873174294`
- **TokenStore**: `0x3DE5ACcd7ABE6a25EDfc06326988A06342c8b21E`

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_DUEL_TOKEN_ADDRESS=0x84d46e11EdD0fB5d8bAb68E55DF1D8Cd10B91FfB
NEXT_PUBLIC_GAME_MANAGER_ADDRESS=0xA40b4539d79ed767C8603e7f2E8F12D873174294
NEXT_PUBLIC_TOKEN_STORE_ADDRESS=0x3DE5ACcd7ABE6a25EDfc06326988A06342c8b21E
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_BACKEND_SIGNER_KEY=your_private_key_here
```

## How to Play

1. **Connect Wallet** - Connect your wallet on Base Sepolia
2. **Buy DUEL** - Purchase DUEL tokens with USDC in the store
3. **Create Game** - Start a new game and invite an opponent
4. **Share Link** - Send the invite link to your friend
5. **Play & Win** - Winner takes the pot!

## Tech Stack

- Next.js 16 with App Router
- TypeScript & Tailwind CSS
- Wagmi + Viem for blockchain interaction
- Solidity smart contracts (Foundry)

## License

MIT
