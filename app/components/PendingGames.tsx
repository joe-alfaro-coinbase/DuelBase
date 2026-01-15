"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
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
  status: GameStatus;
}

export function PendingGames() {
  const { address } = useAccount();
  const { data: nextGameId } = useNextGameId();
  const [pendingGames, setPendingGames] = useState<PendingGame[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [dismissedGames, setDismissedGames] = useState<Set<string>>(new Set());

  // Load dismissed games from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('dismissedGames');
    if (stored) {
      setDismissedGames(new Set(JSON.parse(stored)));
    }
  }, []);

  // Cancel game transaction (only for game creator/player1)
  const { 
    data: cancelHash, 
    writeContract: cancelGame, 
    isPending: isCancelPending,
    reset: resetCancel,
    error: cancelError
  } = useWriteContract();
  
  const { isLoading: isCancelConfirming, isSuccess: isCancelSuccess } = useWaitForTransactionReceipt({
    hash: cancelHash,
  });

  // Handle cancel success
  useEffect(() => {
    if (isCancelSuccess && cancellingId) {
      // Remove the cancelled game from the list
      setPendingGames(prev => prev.filter(g => g.id.toString() !== cancellingId));
      setCancellingId(null);
      resetCancel();
    }
  }, [isCancelSuccess, cancellingId, resetCancel]);

  // Handle cancel error
  useEffect(() => {
    if (cancelError) {
      setCancellingId(null);
      resetCancel();
    }
  }, [cancelError, resetCancel]);

  // On-chain cancel for game creator (refunds their wager)
  const handleCancelGame = (gameId: bigint) => {
    setCancellingId(gameId.toString());
    cancelGame({
      address: CONTRACTS.GAME_MANAGER,
      abi: GAME_MANAGER_ABI,
      functionName: "cancelGame",
      args: [gameId],
      chainId: CHAIN_ID,
    });
  };

  // Local dismiss for invitee (they haven't staked funds yet)
  const handleDismissInvite = (gameId: bigint) => {
    const newDismissed = new Set(dismissedGames);
    newDismissed.add(gameId.toString());
    setDismissedGames(newDismissed);
    localStorage.setItem('dismissedGames', JSON.stringify([...newDismissed]));
  };

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
      
      // Show Created (waiting) and Active games
      if (game.status !== GameStatus.Created && game.status !== GameStatus.Active) return;
      
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
          status: game.status,
        });
      }
    });

    // Sort by creation time (newest first)
    pending.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Filter out dismissed games (for invitees who declined)
    const filtered = pending.filter(g => !dismissedGames.has(g.id.toString()));
    setPendingGames(filtered);
  }, [gamesData, address, dismissedGames]);

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
                  {game.status === GameStatus.Active ? "🎮" : game.isChallenger ? "⚔️" : "📩"}
                </span>
                <span className="font-medium text-white">
                  {game.status === GameStatus.Active 
                    ? "Game in progress" 
                    : game.isChallenger 
                    ? "Waiting for opponent" 
                    : "You're invited!"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {game.status === GameStatus.Active && (
                  <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full border border-green-500/30">
                    Active
                  </span>
                )}
                <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full border border-purple-500/30">
                  {game.gameType}
                </span>
              </div>
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

              <div className="flex items-center gap-2">
                {game.status === GameStatus.Active ? (
                  <Link
                    href={`/games/${game.id}`}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    🎮 Play
                  </Link>
                ) : game.isChallenger ? (
                  <>
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
                    <button
                      onClick={() => handleCancelGame(game.id)}
                      disabled={cancellingId === game.id.toString() && (isCancelPending || isCancelConfirming)}
                      className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-medium rounded-lg transition-colors border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Cancel game and get refund"
                    >
                      {cancellingId === game.id.toString() && (isCancelPending || isCancelConfirming) ? (
                        <span className="flex items-center gap-1">
                          <span className="animate-spin h-3 w-3 border-2 border-red-300 border-t-transparent rounded-full" />
                          Cancelling...
                        </span>
                      ) : (
                        "Cancel"
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/join/${game.id}`}
                      className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Accept
                    </Link>
                    <button
                      onClick={() => handleDismissInvite(game.id)}
                      className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-medium rounded-lg transition-colors border border-red-500/30"
                    >
                      Decline
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
