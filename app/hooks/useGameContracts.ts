"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";

// ============ Contract Addresses (Base Sepolia) ============
export const CONTRACTS = {
  DUEL_TOKEN: "0x84d46e11EdD0fB5d8bAb68E55DF1D8Cd10B91FfB",
  GAME_MANAGER: "0xA40b4539d79ed767C8603e7f2E8F12D873174294",
  TOKEN_STORE: "0x3DE5ACcd7ABE6a25EDfc06326988A06342c8b21E",
} as const;

// ============ ABIs (minimal for frontend use) ============
export const DUEL_TOKEN_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const GAME_MANAGER_ABI = [
  // Read functions
  {
    name: "getGame",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "player1", type: "address" },
          { name: "player2", type: "address" },
          { name: "wagerAmount", type: "uint256" },
          { name: "player1Wager", type: "uint256" },
          { name: "gameType", type: "uint8" },
          { name: "status", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "winner", type: "address" },
        ],
      },
    ],
  },
  {
    name: "calculatePlayer1Wager",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "wagerAmount", type: "uint256" },
      { name: "gameType", type: "uint8" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "nextGameId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Write functions
  {
    name: "createGame",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "opponent", type: "address" },
      { name: "wagerAmount", type: "uint256" },
      { name: "gameType", type: "uint8" },
    ],
    outputs: [{ name: "gameId", type: "uint256" }],
  },
  {
    name: "joinGame",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "completeGame",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "gameId", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "cancelGame",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  // Events
  {
    name: "GameCreated",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player1", type: "address", indexed: true },
      { name: "player2", type: "address", indexed: true },
      { name: "wagerAmount", type: "uint256", indexed: false },
      { name: "player1Wager", type: "uint256", indexed: false },
      { name: "gameType", type: "uint8", indexed: false },
    ],
  },
  {
    name: "GameJoined",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player2", type: "address", indexed: true },
    ],
  },
  {
    name: "GameCompleted",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "totalPayout", type: "uint256", indexed: false },
    ],
  },
] as const;

// ============ Enums ============
export enum GameType {
  TicTacToe = 0,
  ConnectFour = 1,
}

export enum GameStatus {
  Created = 0,
  Active = 1,
  Completed = 2,
  Cancelled = 3,
}

// ============ Hooks ============

/**
 * Get DUEL token balance for an address
 */
export function useDuelBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.DUEL_TOKEN,
    abi: DUEL_TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

/**
 * Get allowance for GameManager to spend user's DUEL
 */
export function useDuelAllowance(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.DUEL_TOKEN,
    abi: DUEL_TOKEN_ABI,
    functionName: "allowance",
    args: owner ? [owner, CONTRACTS.GAME_MANAGER] : undefined,
    query: { enabled: !!owner },
  });
}

/**
 * Get game details by ID
 */
export function useGame(gameId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.GAME_MANAGER,
    abi: GAME_MANAGER_ABI,
    functionName: "getGame",
    args: gameId !== undefined ? [gameId] : undefined,
    query: { enabled: gameId !== undefined },
  });
}

/**
 * Calculate player1's wager (with edge) for a given base wager
 */
export function useCalculatePlayer1Wager(wagerAmount: bigint, gameType: GameType) {
  return useReadContract({
    address: CONTRACTS.GAME_MANAGER,
    abi: GAME_MANAGER_ABI,
    functionName: "calculatePlayer1Wager",
    args: [wagerAmount, gameType],
  });
}

/**
 * Hook for all game write operations
 */
export function useGameActions() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approveTokens = (amount: bigint) => {
    writeContract({
      address: CONTRACTS.DUEL_TOKEN,
      abi: DUEL_TOKEN_ABI,
      functionName: "approve",
      args: [CONTRACTS.GAME_MANAGER, amount],
    });
  };

  const createGame = (opponent: `0x${string}`, wagerAmount: bigint, gameType: GameType) => {
    writeContract({
      address: CONTRACTS.GAME_MANAGER,
      abi: GAME_MANAGER_ABI,
      functionName: "createGame",
      args: [opponent, wagerAmount, gameType],
    });
  };

  const joinGame = (gameId: bigint) => {
    writeContract({
      address: CONTRACTS.GAME_MANAGER,
      abi: GAME_MANAGER_ABI,
      functionName: "joinGame",
      args: [gameId],
    });
  };

  const completeGame = (gameId: bigint, winner: `0x${string}`, signature: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.GAME_MANAGER,
      abi: GAME_MANAGER_ABI,
      functionName: "completeGame",
      args: [gameId, winner, signature],
    });
  };

  const cancelGame = (gameId: bigint) => {
    writeContract({
      address: CONTRACTS.GAME_MANAGER,
      abi: GAME_MANAGER_ABI,
      functionName: "cancelGame",
      args: [gameId],
    });
  };

  return {
    approveTokens,
    createGame,
    joinGame,
    completeGame,
    cancelGame,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
