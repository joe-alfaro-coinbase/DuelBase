"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { formatUnits } from "viem";
import Link from "next/link";
import {
  useGame,
  useDuelBalance,
  useDuelAllowance,
  useGameActions,
  GameStatus,
  GameType,
  DUEL_DECIMALS,
  CONTRACTS,
  type GameData,
} from "@/app/hooks/useGameContracts";

export default function JoinGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId ? BigInt(params.gameId as string) : undefined;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const isWrongNetwork = chainId !== baseSepolia.id;

  // Fetch game data
  const { data: gameData, isLoading: isLoadingGame, refetch: refetchGame } = useGame(gameId);
  const game = gameData as GameData | undefined;

  // User's DUEL balance and allowance
  const { data: duelBalance } = useDuelBalance(address);
  const { data: duelAllowance, refetch: refetchAllowance } = useDuelAllowance(address);

  // Game actions
  const {
    approveTokens,
    joinGame,
    isPending,
    isConfirming,
    isSuccess,
    error,
  } = useGameActions();

  const [step, setStep] = useState<"view" | "approve" | "join" | "success">("view");

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess) {
      if (step === "approve") {
        refetchAllowance();
        setStep("view");
      } else if (step === "join") {
        setStep("success");
        refetchGame();
      }
    }
  }, [isSuccess, step, refetchAllowance, refetchGame]);

  // Format values for display
  const formattedWager = game ? formatUnits(game.wagerAmount, DUEL_DECIMALS) : "0";
  const formattedPlayer2Wager = game ? formatUnits(game.player2Wager, DUEL_DECIMALS) : "0";
  const formattedBalance = duelBalance ? formatUnits(duelBalance, DUEL_DECIMALS) : "0";

  // Check if user needs to approve tokens
  const needsApproval = game && duelAllowance !== undefined && duelAllowance < game.player2Wager;
  const hasEnoughBalance = game && duelBalance !== undefined && duelBalance >= game.player2Wager;

  // Check if user is the invited player
  const isInvitedPlayer = game && address && game.player2.toLowerCase() === address.toLowerCase();
  const isPlayer1 = game && address && game.player1.toLowerCase() === address.toLowerCase();

  const gameTypeLabel = game?.gameType === GameType.TicTacToe ? "Tic Tac Toe" : "Connect Four";
  const statusLabel = game ? ["Waiting for opponent", "Active", "Completed", "Cancelled"][game.status] : "";

  const handleApprove = () => {
    if (!game) return;
    setStep("approve");
    approveTokens(game.player2Wager);
  };

  const handleJoin = () => {
    if (!gameId) return;
    setStep("join");
    joinGame(gameId);
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${gameId}`;
    navigator.clipboard.writeText(link);
  };

  if (!gameId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Game</h1>
          <p className="text-gray-400 mb-6">No game ID provided.</p>
          <Link href="/" className="text-purple-400 hover:text-purple-300 font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (isLoadingGame) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!game || game.player1 === "0x0000000000000000000000000000000000000000") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Game Not Found</h1>
          <p className="text-gray-400 mb-6">This game doesn&apos;t exist.</p>
          <Link href="/" className="text-purple-400 hover:text-purple-300 font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800/50 backdrop-blur-sm border border-purple-500/20 rounded-2xl shadow-xl p-6 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎮</div>
          <h1 className="text-2xl font-bold text-white">Game Invitation</h1>
          <p className="text-gray-400 text-sm mt-1">{gameTypeLabel}</p>
        </div>

        {/* Game Details Card */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-4 text-white mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="opacity-80">Game ID</span>
            <span className="font-mono font-bold">#{gameId.toString()}</span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="opacity-80">Status</span>
            <span className={`font-medium px-2 py-1 rounded-full text-xs ${
              game.status === GameStatus.Created ? "bg-yellow-400 text-yellow-900" :
              game.status === GameStatus.Active ? "bg-green-400 text-green-900" :
              game.status === GameStatus.Completed ? "bg-blue-400 text-blue-900" :
              "bg-red-400 text-red-900"
            }`}>
              {statusLabel}
            </span>
          </div>
          <div className="border-t border-white/20 pt-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="opacity-80">Wager</span>
              <span className="text-2xl font-bold">{Number(formattedWager).toLocaleString()} DUEL</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="opacity-60">Your stake (with edge discount)</span>
              <span className="font-medium">{Number(formattedPlayer2Wager).toLocaleString()} DUEL</span>
            </div>
          </div>
        </div>

        {/* Players Info */}
        <div className="bg-gray-900/50 rounded-xl p-4 mb-6 border border-purple-500/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Challenger</p>
              <p className="font-mono text-sm text-gray-300 truncate max-w-[180px]">
                {game.player1}
              </p>
            </div>
            <span className="text-2xl">⚔️</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Opponent (You?)</p>
              <p className="font-mono text-sm text-gray-300 truncate max-w-[180px]">
                {game.player2}
              </p>
            </div>
            {isInvitedPlayer && <span className="text-green-400 text-xl">✓</span>}
          </div>
        </div>

        {/* Success State */}
        {step === "success" && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-6 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h3 className="font-bold text-green-400 mb-2">You&apos;re In!</h3>
            <p className="text-green-300 text-sm mb-4">Game is now active. Time to play!</p>
            <Link
              href={`/game/${gameId}`}
              className="inline-block px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl transition-all"
            >
              🎮 Start Playing
            </Link>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 rounded-xl p-4 mb-4 text-sm">
            {error.message.includes("insufficient") 
              ? "Insufficient DUEL balance" 
              : error.message.slice(0, 100)}
          </div>
        )}

        {/* Not Connected */}
        {!isConnected && (
          <div className="text-center py-4">
            <p className="text-gray-400 mb-4">Connect your wallet to join this game</p>
          </div>
        )}

        {/* Wrong Network */}
        {isConnected && isWrongNetwork && (
          <button
            onClick={() => switchChain({ chainId: baseSepolia.id })}
            disabled={isSwitching}
            className="w-full py-4 mb-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold text-lg rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSwitching ? "Switching..." : "⚠️ Switch to Base Sepolia"}
          </button>
        )}

        {/* Game Already Joined or Completed */}
        {isConnected && !isWrongNetwork && game.status !== GameStatus.Created && (
          <div className="text-center py-4">
            <p className="text-gray-400 mb-4">
              {game.status === GameStatus.Active && "This game is already in progress!"}
              {game.status === GameStatus.Completed && "This game has already ended."}
              {game.status === GameStatus.Cancelled && "This game was cancelled."}
            </p>
          </div>
        )}

        {/* Not the Invited Player */}
        {isConnected && !isWrongNetwork && game.status === GameStatus.Created && !isInvitedPlayer && !isPlayer1 && (
          <div className="text-center py-4">
            <p className="text-gray-400 mb-4">
              This game invitation is for a different wallet address.
            </p>
            <p className="text-sm text-gray-500">
              Expected: <span className="font-mono">{game.player2.slice(0, 10)}...</span>
            </p>
          </div>
        )}

        {/* Player 1 View (waiting for opponent) */}
        {isConnected && !isWrongNetwork && game.status === GameStatus.Created && isPlayer1 && (
          <div className="text-center py-4">
            <p className="text-gray-400 mb-4">Waiting for your opponent to join...</p>
            <button
              onClick={copyInviteLink}
              className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              📋 Copy Invite Link
            </button>
          </div>
        )}

        {/* Action Buttons for Invited Player */}
        {isConnected && !isWrongNetwork && game.status === GameStatus.Created && isInvitedPlayer && step !== "success" && (
          <>
            {/* Balance Warning */}
            {!hasEnoughBalance && (
              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 mb-4">
                <p className="text-yellow-300 text-sm">
                  You need {Number(formattedPlayer2Wager).toLocaleString()} DUEL to join.
                  <br />
                  Your balance: {Number(formattedBalance).toLocaleString()} DUEL
                </p>
                <Link href="/store" className="text-purple-400 hover:text-purple-300 font-medium text-sm mt-2 inline-block">
                  → Get more DUEL
                </Link>
              </div>
            )}

            {/* Approve Button */}
            {hasEnoughBalance && needsApproval && (
              <button
                onClick={handleApprove}
                disabled={isPending || isConfirming}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending || isConfirming ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Approving...
                  </>
                ) : (
                  <>🔓 Approve DUEL</>
                )}
              </button>
            )}

            {/* Join Button */}
            {hasEnoughBalance && !needsApproval && (
              <button
                onClick={handleJoin}
                disabled={isPending || isConfirming}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-green-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending || isConfirming ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Joining...
                  </>
                ) : (
                  <>⚔️ Join Game & Stake {Number(formattedPlayer2Wager).toLocaleString()} DUEL</>
                )}
              </button>
            )}
          </>
        )}

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-gray-500 hover:text-gray-400 text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
