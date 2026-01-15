import { NextRequest, NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// Game Manager contract address
const GAME_MANAGER_ADDRESS = "0xA40b4539d79ed767C8603e7f2E8F12D873174294";

// EIP-712 Domain (must match the contract)
const domain = {
  name: "DuelBase",
  version: "1",
  chainId: baseSepolia.id, // 84532
  verifyingContract: GAME_MANAGER_ADDRESS as `0x${string}`,
} as const;

// EIP-712 Types
const types = {
  GameResult: [
    { name: "gameId", type: "uint256" },
    { name: "winner", type: "address" },
  ],
} as const;

// In-memory game states (shared with the games API)
// In production, use a database
const gameStatesCache = new Map<string, {
  winner: string | null;
  isDraw: boolean;
}>();

// POST - Sign a game result
export async function POST(request: NextRequest) {
  try {
    const { gameId, winner } = await request.json();

    if (!gameId || !winner) {
      return NextResponse.json(
        { error: "Missing gameId or winner" },
        { status: 400 }
      );
    }

    // Get the backend signer private key from environment
    const privateKey = process.env.BACKEND_SIGNER_PRIVATE_KEY;
    
    if (!privateKey) {
      console.error("BACKEND_SIGNER_PRIVATE_KEY not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Verify the game state from our API
    // In production, you'd fetch this from a database
    const gameStateRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/games/${gameId}`
    );
    const gameStateData = await gameStateRes.json();

    if (!gameStateData.exists) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    const gameState = gameStateData.state;

    // Verify the winner matches our game state
    if (gameState.isDraw) {
      return NextResponse.json(
        { error: "Game ended in a draw - no winner to claim" },
        { status: 400 }
      );
    }

    if (!gameState.winner) {
      return NextResponse.json(
        { error: "Game is not finished yet" },
        { status: 400 }
      );
    }

    if (gameState.winner.toLowerCase() !== winner.toLowerCase()) {
      return NextResponse.json(
        { error: "Invalid winner - does not match game result" },
        { status: 400 }
      );
    }

    // Sign the game result
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    const signature = await account.signTypedData({
      domain,
      types,
      primaryType: "GameResult",
      message: {
        gameId: BigInt(gameId),
        winner: winner as `0x${string}`,
      },
    });

    return NextResponse.json({
      success: true,
      signature,
      gameId,
      winner,
    });
  } catch (error) {
    console.error("Error signing game result:", error);
    return NextResponse.json(
      { error: "Failed to sign game result" },
      { status: 500 }
    );
  }
}
