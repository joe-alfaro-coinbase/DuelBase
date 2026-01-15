/**
 * Backend Signing Utility
 * 
 * This code should run on your BACKEND SERVER, not the frontend!
 * The backend holds the private key and signs game results.
 */

import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// Contract address (must match deployed GameManager)
const GAME_MANAGER_ADDRESS = "0xA40b4539d79ed767C8603e7f2E8F12D873174294";

// EIP-712 Domain
const domain = {
  name: "DuelBase",
  version: "1",
  chainId: baseSepolia.id, // 84532 for Base Sepolia
  verifyingContract: GAME_MANAGER_ADDRESS as `0x${string}`,
} as const;

// EIP-712 Types
const types = {
  GameResult: [
    { name: "gameId", type: "uint256" },
    { name: "winner", type: "address" },
  ],
} as const;

/**
 * Sign a game result with the backend signer key
 * 
 * @param gameId - The game ID
 * @param winner - The winner's address
 * @param privateKey - The backend signer's private key (KEEP SECRET!)
 * @returns The signature as a hex string
 * 
 * @example
 * // On your backend API endpoint:
 * const signature = await signGameResult(
 *   BigInt(gameId),
 *   winnerAddress,
 *   process.env.NEXT_PUBLIC_BACKEND_SIGNER_KEY
 * );
 * return { signature };
 */
export async function signGameResult(
  gameId: bigint,
  winner: `0x${string}`,
  privateKey: `0x${string}`
): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: "GameResult",
    message: {
      gameId,
      winner,
    },
  });

  return signature;
}

/**
 * Example backend API handler (e.g., Next.js API route)
 * 
 * POST /api/complete-game
 * Body: { gameId: string, winner: string }
 * 
 * This would be called when the game logic determines a winner
 */
export async function exampleApiHandler(request: Request) {
  const { gameId, winner } = await request.json();

  // TODO: Verify the game actually exists and this is the correct winner
  // You should validate the game state before signing!

  const signature = await signGameResult(
    BigInt(gameId),
    winner as `0x${string}`,
    process.env.NEXT_PUBLIC_BACKEND_SIGNER_KEY as `0x${string}`
  );

  return Response.json({ signature });
}

/**
 * Frontend calls backend, then submits to contract:
 * 
 * // 1. Frontend determines winner from game logic
 * const winner = determineWinner(gameState);
 * 
 * // 2. Frontend requests signature from backend
 * const res = await fetch('/api/complete-game', {
 *   method: 'POST',
 *   body: JSON.stringify({ gameId, winner }),
 * });
 * const { signature } = await res.json();
 * 
 * // 3. Frontend (or anyone) submits to contract
 * completeGame(BigInt(gameId), winner, signature);
 */
