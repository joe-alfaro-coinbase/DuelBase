"use client";

import { useParams, useRouter } from "next/navigation";
import { useAccount, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { useState, useEffect, useCallback } from "react";
import { formatEther } from "viem";
import Link from "next/link";
import { useGame, GameType, GameStatus, useGameActions } from "@/app/hooks/useGameContracts";
import { Connect4 } from "@/app/components/Connect4";
import TicTacToe from "@/app/components/TicTacToe";

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  
  const gameId = params.gameId ? BigInt(params.gameId as string) : undefined;
  
  const { data: game, isLoading: isLoadingGame, refetch: refetchGame } = useGame(gameId);
  const { completeGame, hash, isPending, isConfirming, isSuccess, error, reset } = useGameActions();
  
  // For demo/testing: local game state
  const [localWinner, setLocalWinner] = useState<string | null>(null);
  const [localIsDraw, setLocalIsDraw] = useState(false);
  const [ticTacToeBoard, setTicTacToeBoard] = useState<(0 | 1 | 2)[]>([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [currentTurn, setCurrentTurn] = useState<string>("");
  
  const isWrongNetwork = chainId !== baseSepolia.id;
  
  // Initialize current turn when game loads
  useEffect(() => {
    if (game && game.player1) {
      setCurrentTurn(game.player1);
    }
  }, [game]);

  // Check for TicTacToe win
  const checkTicTacToeWin = useCallback((board: (0 | 1 | 2)[]): number | null => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6], // diagonals
    ];
    
    for (const [a, b, c] of lines) {
      if (board[a] !== 0 && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  }, []);

  // Handle TicTacToe move
  const handleTicTacToeMove = useCallback(async (position: number) => {
    if (!game || !address) return;
    
    const isPlayer1 = address.toLowerCase() === game.player1.toLowerCase();
    const playerMark = isPlayer1 ? 1 : 2;
    
    const newBoard = [...ticTacToeBoard] as (0 | 1 | 2)[];
    newBoard[position] = playerMark as 0 | 1 | 2;
    setTicTacToeBoard(newBoard);
    
    // Check for win
    const winner = checkTicTacToeWin(newBoard);
    if (winner) {
      setLocalWinner(winner === 1 ? game.player1 : game.player2);
    } else if (newBoard.every(cell => cell !== 0)) {
      setLocalIsDraw(true);
    } else {
      // Switch turns
      setCurrentTurn(isPlayer1 ? game.player2 : game.player1);
    }
  }, [game, address, ticTacToeBoard, checkTicTacToeWin]);

  // Handle Connect4 move
  const handleConnect4Move = useCallback((column: number) => {
    if (!game || !address) return;
    
    // For Connect4, the component handles the logic internally
    // We just switch turns here
    const isPlayer1 = address.toLowerCase() === game.player1.toLowerCase();
    setCurrentTurn(isPlayer1 ? game.player2 : game.player1);
  }, [game, address]);

  // Handle claiming the win (submitting to blockchain)
  const handleClaimWin = useCallback(async () => {
    if (!localWinner || !gameId) return;
    
    // In production, this would call a backend to get a signed message
    // For testing, we'll just show a message
    alert("In production, this would submit the game result to the blockchain with a backend signature.");
  }, [localWinner, gameId]);

  if (!address) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Wallet</h1>
          <p className="text-gray-400">Please connect your wallet to play.</p>
        </div>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Wrong Network</h1>
          <p className="text-gray-400 mb-4">Please switch to Base Sepolia to play.</p>
          <button
            onClick={() => switchChain({ chainId: baseSepolia.id })}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition-colors"
          >
            Switch to Base Sepolia
          </button>
        </div>
      </div>
    );
  }

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

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Game Not Found</h1>
          <p className="text-gray-400 mb-4">This game doesn&apos;t exist.</p>
          <Link href="/" className="text-purple-400 hover:text-purple-300">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const isPlayer1 = address.toLowerCase() === game.player1.toLowerCase();
  const isPlayer2 = address.toLowerCase() === game.player2.toLowerCase();
  const isParticipant = isPlayer1 || isPlayer2;
  const isMyTurn = currentTurn.toLowerCase() === address.toLowerCase();
  const gameStatus = game.status as GameStatus;
  const gameType = game.gameType as GameType;
  const wagerAmount = formatEther(game.wagerAmount);

  // Check if game is active (player2 has joined)
  const isGameActive = gameStatus === GameStatus.Active || game.player2 !== "0x0000000000000000000000000000000000000000";
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-purple-400 hover:text-purple-300 flex items-center gap-2">
            ← Back
          </Link>
          <h1 className="text-xl font-bold">Game #{gameId?.toString()}</h1>
          <div className="w-16"></div>
        </div>

        {/* Game Info */}
        <div className="bg-gray-800/50 rounded-2xl p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <span className="text-gray-400 text-sm">Game Type</span>
              <p className="font-semibold">{gameType === GameType.TicTacToe ? "Tic Tac Toe" : "Connect 4"}</p>
            </div>
            <div className="text-right">
              <span className="text-gray-400 text-sm">Pot</span>
              <p className="font-semibold text-green-400">{Number(wagerAmount) * 2} DUEL</p>
            </div>
          </div>
          
          {/* Status Banner */}
          {!isGameActive && gameStatus === GameStatus.Created && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-3 text-center">
              <p className="text-yellow-300">⏳ Waiting for opponent to join...</p>
              {isPlayer1 && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/join/${gameId}`);
                    alert("Invite link copied!");
                  }}
                  className="mt-2 text-sm text-yellow-400 hover:text-yellow-300 underline"
                >
                  Copy invite link
                </button>
              )}
            </div>
          )}
          
          {localWinner && (
            <div className={`rounded-xl p-3 text-center ${
              localWinner.toLowerCase() === address.toLowerCase()
                ? "bg-green-500/20 border border-green-500/50"
                : "bg-red-500/20 border border-red-500/50"
            }`}>
              <p className={localWinner.toLowerCase() === address.toLowerCase() ? "text-green-300" : "text-red-300"}>
                {localWinner.toLowerCase() === address.toLowerCase() ? "🎉 You Won!" : "😢 You Lost!"}
              </p>
              {localWinner.toLowerCase() === address.toLowerCase() && (
                <button
                  onClick={handleClaimWin}
                  className="mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  Claim Winnings
                </button>
              )}
            </div>
          )}
          
          {localIsDraw && (
            <div className="bg-gray-500/20 border border-gray-500/50 rounded-xl p-3 text-center">
              <p className="text-gray-300">🤝 It&apos;s a Draw! Wagers returned.</p>
            </div>
          )}
        </div>

        {/* Game Board */}
        {isGameActive && !localWinner && !localIsDraw && (
          <div className="flex justify-center">
            {gameType === GameType.ConnectFour ? (
              <Connect4
                gameId={gameId!}
                player1={game.player1}
                player2={game.player2}
                currentPlayer={address}
                isMyTurn={isMyTurn}
                onMove={handleConnect4Move}
                disabled={!isParticipant}
              />
            ) : (
              <TicTacToe
                gameId={Number(gameId)}
                player1={game.player1}
                player2={game.player2}
                board={ticTacToeBoard}
                currentTurn={currentTurn}
                winner={localWinner}
                isDraw={localIsDraw}
                status={isGameActive ? "Active" : "Created"}
                timeRemaining={300} // 5 min placeholder
                wagerAmount={wagerAmount}
                onMakeMove={handleTicTacToeMove}
                onClaimTimeout={async () => {}}
                isLoading={isPending || isConfirming}
              />
            )}
          </div>
        )}

        {/* Spectator Notice */}
        {!isParticipant && (
          <div className="bg-gray-800/50 rounded-xl p-4 text-center mt-6">
            <p className="text-gray-400">👀 You are spectating this game</p>
          </div>
        )}

        {/* Testing Instructions */}
        <div className="mt-8 bg-gray-800/30 rounded-xl p-4">
          <h3 className="font-semibold text-yellow-400 mb-2">🧪 Testing Mode</h3>
          <p className="text-sm text-gray-400 mb-2">
            To test the full flow with two players:
          </p>
          <ol className="text-sm text-gray-400 list-decimal list-inside space-y-1">
            <li>Create a game with one wallet (Player 1)</li>
            <li>Copy the invite link and open in an incognito window</li>
            <li>Connect a <strong>different wallet address</strong> (Player 2)</li>
            <li>Accept the wager as Player 2</li>
            <li>Play the game by switching between windows</li>
          </ol>
          <p className="text-sm text-gray-500 mt-2 italic">
            Note: The smart contract prevents playing against yourself for security.
          </p>
        </div>
      </div>
    </div>
  );
}
