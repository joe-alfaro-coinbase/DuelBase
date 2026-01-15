"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import Link from "next/link";
import { useReadContracts } from "wagmi";
import {
  useNextGameId,
  CONTRACTS,
  GAME_MANAGER_ABI,
  GameStatus,
  GameType,
  DUEL_DECIMALS,
  type GameData,
} from "@/app/hooks/useGameContracts";
import { baseSepolia } from "wagmi/chains";

const CHAIN_ID = baseSepolia.id;

interface PendingGame {
  id: bigint;
  opponent: string;
  wagerAmount: string;
  gameType: string;
  isChallenger: boolean;
  createdAt: Date;
}

export function PendingGames() {
  const { address } = useAccount();
  const { data: nextGameId } = useNextGameId();
  const [pendingGames, setPendingGames] = useState<PendingGame[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Build contract calls to fetch recent games
  const gameIds = nextGameId ? Array.from(
    { length: Math.min(Number(nextGameId), 50) }, // Fetch last 50 games max
    (_, i) => BigInt(Number(nextGameId) - 1 - i)
  ).filter(id => id >= BigInt(0)) : [];

  const contracts = gameIds.map((id) => ({
    address: CONTRACTS.GAME_MANAGER as `0x${string}`,
    abi: GAME_MANAGER_ABI,
    functionName: "getGame",
    args: [id],
    chainId: CHAIN_ID,
  }));

  const { data: gamesData, isLoading } = useReadContracts({
    contracts: contracts as any,
    query: { enabled: contracts.length > 0 && !!address },
  });

  // Process games data
  useEffect(() => {
    if (!gamesData || !address) {
      setPendingGames([]);
      return;
    }

    const userAddress = address.toLowerCase();
    const pending: PendingGame[] = [];

    gamesData.forEach((result, index) => {
      if (result.status !== "success" || !result.result) return;
      
      const game = result.result as GameData;
      
      // Only show Created (waiting) games
      if (game.status !== GameStatus.Created) return;
      
      const player1 = game.player1.toLowerCase();
      const player2 = game.player2.toLowerCase();
      
      // Check if user is involved in this game
      if (player1 === userAddress || player2 === userAddress) {
        const isChallenger = player1 === userAddress;
        
        pending.push({
          id: game.id,
          opponent: isChallenger ? game.player2 : game.player1,
          wagerAmount: formatUnits(game.wagerAmount, DUEL_DECIMALS),
          gameType: game.gameType === GameType.TicTacToe ? "Tic Tac Toe" : "Connect Four",
          isChallenger,
          createdAt: new Date(Number(game.createdAt) * 1000),
        });
      }
    });

    // Sort by creation time (newest first)
    pending.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    setPendingGames(pending);
  }, [gamesData, address]);

  const copyInviteLink = (gameId: bigint) => {
    const link = `${window.location.origin}/join/${gameId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(gameId.toString());
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!address) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Your Games</h2>
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (pendingGames.length === 0) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Your Games</h2>
        <p className="text-gray-400 text-center py-4">No pending games. Start a new game to challenge a friend!</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-6">
      <h2 className="text-xl font-bold text-white mb-4">Your Games</h2>
      
      <div className="space-y-3">
        {pendingGames.map((game) => (
          <div
            key={game.id.toString()}
            className="border border-purple-500/30 bg-gray-900/50 rounded-xl p-4 hover:border-purple-400/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {game.isChallenger ? "⚔️" : "📩"}
                </span>
                <span className="font-medium text-white">
                  {game.isChallenger ? "Waiting for opponent" : "You're invited!"}
                </span>
              </div>
              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full border border-purple-500/30">
                {game.gameType}
              </span>
            </div>

            <div className="text-sm text-gray-400 mb-3">
              <span className="font-mono truncate block max-w-[200px]">
                vs {game.opponent.slice(0, 6)}...{game.opponent.slice(-4)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-400">
                {Number(game.wagerAmount).toLocaleString()} DUEL
              </span>

              {game.isChallenger ? (
                <button
                  onClick={() => copyInviteLink(game.id)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                >
                  {copiedId === game.id.toString() ? (
                    <>✓ Copied!</>
                  ) : (
                    <>📋 Copy Link</>
                  )}
                </button>
              ) : (
                <Link
                  href={`/join/${game.id}`}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Accept
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
