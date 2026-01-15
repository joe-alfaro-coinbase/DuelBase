"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { parseEther, formatEther } from "viem";

// ============ Contract Addresses (from environment variables) ============
export const CONTRACTS = {
  DUEL_TOKEN: (process.env.NEXT_PUBLIC_DUEL_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  GAME_MANAGER: (process.env.NEXT_PUBLIC_GAME_MANAGER_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  TOKEN_STORE: (process.env.NEXT_PUBLIC_TOKEN_STORE_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  TICTACTOE: (process.env.NEXT_PUBLIC_TICTACTOE_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  USDC: (process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`, // Base Sepolia USDC fallback
} as const;

// ============ Constants ============
export const USDC_DECIMALS = 6;
export const DUEL_DECIMALS = 18;

// Chain ID for all contract interactions
const CHAIN_ID = baseSepolia.id;

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

export const USDC_ABI = [
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

export const TOKEN_STORE_ABI = [
  {
    name: "pricePerToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "isOpen",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "getInventory",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "calculateCost",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "duelAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "calculateTokensForUsdc",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "usdcAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "buyTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "duelAmount", type: "uint256" }],
    outputs: [],
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
    chainId: CHAIN_ID,
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
    chainId: CHAIN_ID,
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
    chainId: CHAIN_ID,
    query: { enabled: gameId !== undefined },
  });
}

/**
 * Get the next game ID (total number of games created)
 */
export function useNextGameId() {
  return useReadContract({
    address: CONTRACTS.GAME_MANAGER,
    abi: GAME_MANAGER_ABI,
    functionName: "nextGameId",
    chainId: CHAIN_ID,
  });
}

/**
 * Game data structure returned from contract
 */
export interface GameData {
  id: bigint;
  player1: `0x${string}`;
  player2: `0x${string}`;
  wagerAmount: bigint;
  player1Wager: bigint; // Amount player1 pays (includes edge percentage)
  gameType: number;
  status: number;
  createdAt: bigint;
  winner: `0x${string}`;
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
    chainId: CHAIN_ID,
  });
}

/**
 * Hook for all game write operations
 */
export function useGameActions() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });

  const approveTokens = (amount: bigint) => {
    writeContract({
      address: CONTRACTS.DUEL_TOKEN,
      abi: DUEL_TOKEN_ABI,
      functionName: "approve",
      args: [CONTRACTS.GAME_MANAGER, amount],
      chainId: CHAIN_ID,
    });
  };

  const createGame = (opponent: `0x${string}`, wagerAmount: bigint, gameType: GameType) => {
    writeContract({
      address: CONTRACTS.GAME_MANAGER,
      abi: GAME_MANAGER_ABI,
      functionName: "createGame",
      args: [opponent, wagerAmount, gameType],
      chainId: CHAIN_ID,
    });
  };

  const joinGame = (gameId: bigint) => {
    writeContract({
      address: CONTRACTS.GAME_MANAGER,
      abi: GAME_MANAGER_ABI,
      functionName: "joinGame",
      chainId: CHAIN_ID,
      args: [gameId],
    });
  };

  const completeGame = (gameId: bigint, winner: `0x${string}`, signature: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.GAME_MANAGER,
      abi: GAME_MANAGER_ABI,
      functionName: "completeGame",
      args: [gameId, winner, signature],
      chainId: CHAIN_ID,
    });
  };

  const cancelGame = (gameId: bigint) => {
    writeContract({
      address: CONTRACTS.GAME_MANAGER,
      abi: GAME_MANAGER_ABI,
      functionName: "cancelGame",
      args: [gameId],
      chainId: CHAIN_ID,
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
    reset,
    receipt,
  };
}

// ============ Token Store Hooks ============

/**
 * Get USDC balance for an address
 */
export function useUsdcBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.USDC,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  });
}

/**
 * Get USDC allowance for TokenStore
 */
export function useUsdcAllowance(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.USDC,
    abi: USDC_ABI,
    functionName: "allowance",
    args: owner ? [owner, CONTRACTS.TOKEN_STORE] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!owner },
  });
}

/**
 * Get the current price per DUEL token in USDC
 */
export function useTokenPrice() {
  return useReadContract({
    address: CONTRACTS.TOKEN_STORE,
    abi: TOKEN_STORE_ABI,
    functionName: "pricePerToken",
    chainId: CHAIN_ID,
  });
}

/**
 * Check if the store is open
 */
export function useStoreIsOpen() {
  return useReadContract({
    address: CONTRACTS.TOKEN_STORE,
    abi: TOKEN_STORE_ABI,
    functionName: "isOpen",
    chainId: CHAIN_ID,
  });
}

/**
 * Get available DUEL inventory in the store
 */
export function useStoreInventory() {
  return useReadContract({
    address: CONTRACTS.TOKEN_STORE,
    abi: TOKEN_STORE_ABI,
    functionName: "getInventory",
    chainId: CHAIN_ID,
  });
}

/**
 * Calculate USDC cost for a given DUEL amount
 */
export function useCalculateCost(duelAmount: bigint) {
  return useReadContract({
    address: CONTRACTS.TOKEN_STORE,
    abi: TOKEN_STORE_ABI,
    functionName: "calculateCost",
    args: [duelAmount],
    chainId: CHAIN_ID,
    query: { enabled: duelAmount > BigInt(0) },
  });
}

/**
 * Hook for token store purchase operations
 */
export function useTokenStore() {
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approveUsdc = (amount: bigint) => {
    writeContract({
      address: CONTRACTS.USDC,
      abi: USDC_ABI,
      functionName: "approve",
      args: [CONTRACTS.TOKEN_STORE, amount],
      chainId: CHAIN_ID,
    });
  };

  const buyTokens = (duelAmount: bigint) => {
    writeContract({
      address: CONTRACTS.TOKEN_STORE,
      abi: TOKEN_STORE_ABI,
      functionName: "buyTokens",
      args: [duelAmount],
      chainId: CHAIN_ID,
    });
  };

  return {
    approveUsdc,
    buyTokens,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  };
}
