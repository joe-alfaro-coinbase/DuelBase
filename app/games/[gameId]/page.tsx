'use client';

import { use, useCallback } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import Link from 'next/link';
import TicTacToe from '../../components/TicTacToe';
import { TicTacToeGameABI } from '../../contracts/TicTacToeGameABI';
import { CONTRACTS } from '../../hooks/useGameContracts';

type GameStatus = 'Created' | 'Active' | 'Completed' | 'Cancelled';

const STATUS_MAP: Record<number, GameStatus> = {
  0: 'Created',
  1: 'Active',
  2: 'Completed',
  3: 'Cancelled',
};

interface PageProps {
  params: Promise<{ gameId: string }>;
}

export default function GamePage({ params }: PageProps) {
  const { gameId } = use(params);

  const { address, chainId, isConnected } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const contractAddress = CONTRACTS.TICTACTOE;
  const gameIdBigInt = BigInt(gameId);
  const isWrongNetwork = chainId !== baseSepolia.id;

  // Read game state from TicTacToeGame contract
  const {
    data: gameData,
    isLoading: isLoadingGame,
    error: gameError,
    refetch: refetchGame,
  } = useReadContract({
    address: contractAddress,
    abi: TicTacToeGameABI,
    functionName: 'getGame',
    args: [gameIdBigInt],
    query: {
      refetchInterval: 5000, // Poll every 5 seconds
      enabled: isConnected && !isWrongNetwork,
    },
  });

  // Read time remaining
  const { data: timeRemaining, refetch: refetchTime } = useReadContract({
    address: contractAddress,
    abi: TicTacToeGameABI,
    functionName: 'getTimeRemaining',
    args: [gameIdBigInt],
    query: {
      refetchInterval: 1000, // Poll every second for timer
      enabled: isConnected && !isWrongNetwork && !!gameData,
    },
  });

  // Write contract hooks
  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const isLoading = isWritePending || isConfirming;

  // Handle making a move
  const handleMakeMove = useCallback(
    async (position: number) => {
      writeContract(
        {
          address: contractAddress,
          abi: TicTacToeGameABI,
          functionName: 'makeMove',
          args: [gameIdBigInt, position],
        },
        {
          onSuccess: () => {
            refetchGame();
            refetchTime();
          },
        }
      );
    },
    [contractAddress, gameIdBigInt, writeContract, refetchGame, refetchTime]
  );

  // Handle claiming timeout win
  const handleClaimTimeout = useCallback(async () => {
    writeContract(
      {
        address: contractAddress,
        abi: TicTacToeGameABI,
        functionName: 'claimTimeoutWin',
        args: [gameIdBigInt],
      },
      {
        onSuccess: () => {
          refetchGame();
        },
      }
    );
  }, [contractAddress, gameIdBigInt, writeContract, refetchGame]);

  // Handle joining game
  const handleJoinGame = useCallback(async () => {
    writeContract(
      {
        address: contractAddress,
        abi: TicTacToeGameABI,
        functionName: 'joinGame',
        args: [gameIdBigInt],
      },
      {
        onSuccess: () => {
          refetchGame();
        },
      }
    );
  }, [contractAddress, gameIdBigInt, writeContract, refetchGame]);

  // Copy invite link
  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/games/${gameId}`);
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold mb-4">Connect Wallet</h1>
          <p className="text-gray-400 mb-6">Please connect your wallet to view this game.</p>
          <Link
            href="/"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Wrong network state
  if (isWrongNetwork) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Wrong Network</h1>
          <p className="text-gray-400 mb-6">Please switch to Base Sepolia to play.</p>
          <button
            onClick={() => switchChain({ chainId: baseSepolia.id })}
            disabled={isSwitching}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition-colors disabled:opacity-50"
          >
            {isSwitching ? 'Switching...' : 'Switch to Base Sepolia'}
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoadingGame) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading game...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (gameError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-4">Error Loading Game</h1>
          <p className="text-gray-400 mb-6 break-all">{gameError.message}</p>
          <div className="space-y-3">
            <button
              onClick={() => refetchGame()}
              className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition-colors"
            >
              Retry
            </button>
            <Link
              href="/"
              className="block text-purple-400 hover:text-purple-300 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No game data
  if (!gameData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-4">Game Not Found</h1>
          <p className="text-gray-400 mb-6">This game doesn&apos;t exist or has been cancelled.</p>
          <Link
            href="/"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const game = gameData;
  const status = STATUS_MAP[game.status] ?? 'Created';
  const board = [...game.board] as (0 | 1 | 2)[];
  const wagerAmount = formatUnits(game.wagerAmount, 18);
  const timeRemainingSeconds = timeRemaining ? Number(timeRemaining) : 120;

  const isPlayer1 = address?.toLowerCase() === game.player1.toLowerCase();
  const isPlayer2 = address?.toLowerCase() === game.player2.toLowerCase();
  const isParticipant = isPlayer1 || isPlayer2;
  const isWaitingForOpponent = status === 'Created' && game.player2 === '0x0000000000000000000000000000000000000000';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="text-purple-400 hover:text-purple-300 flex items-center gap-2 transition-colors"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-bold">Game #{gameId}</h1>
          <div className="w-16"></div>
        </div>

        {/* Transaction error */}
        {writeError && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-4">
            <p className="text-red-300 text-sm">Transaction failed: {writeError.message.slice(0, 100)}</p>
            <button
              onClick={() => resetWrite()}
              className="text-red-400 hover:text-red-300 text-sm mt-2 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Game Info Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <span className="text-gray-400 text-sm">Game Type</span>
              <p className="font-semibold">⭕ Tic Tac Toe</p>
            </div>
            <div className="text-right">
              <span className="text-gray-400 text-sm">Total Pot</span>
              <p className="font-semibold text-green-400">{Number(wagerAmount) * 2} DUEL</p>
            </div>
          </div>

          {/* Waiting for opponent banner */}
          {isWaitingForOpponent && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 text-center">
              <p className="text-yellow-300 mb-2">⏳ Waiting for opponent to join...</p>
              {isPlayer1 && (
                <button
                  onClick={copyInviteLink}
                  className="text-sm text-yellow-400 hover:text-yellow-300 underline transition-colors"
                >
                  📋 Copy invite link
                </button>
              )}
              {!isParticipant && (
                <button
                  onClick={handleJoinGame}
                  disabled={isLoading}
                  className="mt-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Joining...' : 'Join Game'}
                </button>
              )}
            </div>
          )}

          {/* Join button for non-participants when game needs player 2 */}
          {status === 'Created' && !isWaitingForOpponent && !isParticipant && (
            <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-4 text-center">
              <p className="text-blue-300 mb-2">This game is waiting for players</p>
              <button
                onClick={handleJoinGame}
                disabled={isLoading}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Joining...' : 'Join Game'}
              </button>
            </div>
          )}
        </div>

        {/* TicTacToe Component */}
        <TicTacToe
          gameId={Number(game.id)}
          player1={game.player1}
          player2={game.player2 === '0x0000000000000000000000000000000000000000' ? 'Waiting...' : game.player2}
          board={board}
          currentTurn={game.currentTurn}
          winner={game.winner === '0x0000000000000000000000000000000000000000' ? null : game.winner}
          isDraw={game.isDraw}
          status={status}
          timeRemaining={timeRemainingSeconds}
          wagerAmount={wagerAmount}
          onMakeMove={handleMakeMove}
          onClaimTimeout={handleClaimTimeout}
          isLoading={isLoading}
        />

        {/* Spectator Notice */}
        {!isParticipant && status === 'Active' && (
          <div className="bg-gray-800/50 rounded-xl p-4 text-center mt-6 border border-gray-700">
            <p className="text-gray-400">👀 You are spectating this game</p>
          </div>
        )}

        {/* Contract info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 break-all">
            Contract: {contractAddress}
          </p>
        </div>
      </div>
    </div>
  );
}
