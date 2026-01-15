"use client";

import { useParams } from "next/navigation";
import { useAccount, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useGame, GameType, GameStatus, useGameActions, DUEL_DECIMALS } from "@/app/hooks/useGameContracts";
import { formatUnits } from "viem";

// Types for synced game state
interface SyncedGameState {
  gameId: string;
  gameType: "tictactoe" | "connect4";
  board: number[][] | number[];
  currentTurn: string;
  moves: { player: string; position: number | { row: number; col: number }; timestamp: number }[];
  winner: string | null;
  isDraw: boolean;
  lastUpdated: number;
}

export default function GamePage() {
  const params = useParams();
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  
  const gameId = params.gameId ? BigInt(params.gameId as string) : undefined;
  const gameIdStr = gameId?.toString() || "";
  
  const { data: game, isLoading: isLoadingGame, refetch: refetchGame } = useGame(gameId);
  const { 
    completeGame, 
    isPending, 
    isConfirming, 
    isSuccess: isTxSuccess,
    hash: txHash,
    error: txError,
    reset: resetTx
  } = useGameActions();
  
  // Synced game state from server
  const [syncedState, setSyncedState] = useState<SyncedGameState | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  
  // Claiming state
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStep, setClaimStep] = useState<"idle" | "signing" | "submitting" | "success">("idle");
  const [hasClaimed, setHasClaimed] = useState(false);
  
  const isWrongNetwork = chainId !== baseSepolia.id;

  // Initialize game state on server when game becomes active
  useEffect(() => {
    if (!game || !gameIdStr || isInitializing) return;
    
    const isGameActive = game.status === GameStatus.Active || 
      (game.player2 !== "0x0000000000000000000000000000000000000000" && game.status !== GameStatus.Cancelled);
    
    if (!isGameActive) return;

    const initGame = async () => {
      try {
        // Check if game state already exists
        const checkRes = await fetch(`/api/games/${gameIdStr}`);
        const checkData = await checkRes.json();
        
        if (checkData.exists) {
          setSyncedState(checkData.state);
          return;
        }
        
        // Initialize new game state
        setIsInitializing(true);
        const gameType = game.gameType === GameType.ConnectFour ? "connect4" : "tictactoe";
        
        const res = await fetch(`/api/games/${gameIdStr}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "init",
            gameType,
            player1: game.player1,
            player2: game.player2,
          }),
        });
        
        const data = await res.json();
        if (data.success) {
          setSyncedState(data.state);
        }
      } catch (err) {
        console.error("Failed to initialize game:", err);
        setError("Failed to initialize game state");
      } finally {
        setIsInitializing(false);
      }
    };
    
    initGame();
  }, [game, gameIdStr, isInitializing]);

  // Poll for game state updates
  useEffect(() => {
    if (!gameIdStr || !syncedState) return;
    
    const pollState = async () => {
      try {
        const res = await fetch(`/api/games/${gameIdStr}`);
        const data = await res.json();
        
        if (data.exists && data.state.lastUpdated > syncedState.lastUpdated) {
          setSyncedState(data.state);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };
    
    // Poll every 1 second
    pollingRef.current = setInterval(pollState, 1000);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [gameIdStr, syncedState]);

  // Handle making a move
  const makeMove = useCallback(async (position: number) => {
    if (!game || !address || !syncedState) return;
    
    // Verify it's my turn
    if (syncedState.currentTurn.toLowerCase() !== address.toLowerCase()) {
      setError("Not your turn!");
      setTimeout(() => setError(null), 2000);
      return;
    }
    
    const isPlayer1 = address.toLowerCase() === game.player1.toLowerCase();
    const opponent = isPlayer1 ? game.player2 : game.player1;
    
    try {
      const res = await fetch(`/api/games/${gameIdStr}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          player: address,
          position,
          opponent,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSyncedState(data.state);
      } else {
        setError(data.error || "Failed to make move");
        setTimeout(() => setError(null), 2000);
      }
    } catch (err) {
      console.error("Move error:", err);
      setError("Failed to make move");
      setTimeout(() => setError(null), 2000);
    }
  }, [game, address, syncedState, gameIdStr]);

  // Handle claiming the win
  const handleClaimWin = useCallback(async () => {
    if (!syncedState?.winner || !gameId || isClaiming || hasClaimed) return;
    
    setIsClaiming(true);
    setClaimStep("signing");
    setError(null);
    
    try {
      // Step 1: Get signature from backend
      const signRes = await fetch("/api/complete-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: gameId.toString(),
          winner: syncedState.winner,
        }),
      });
      
      const signData = await signRes.json();
      
      if (!signRes.ok || !signData.success) {
        throw new Error(signData.error || "Failed to get signature");
      }
      
      // Step 2: Submit to blockchain
      setClaimStep("submitting");
      completeGame(
        gameId,
        syncedState.winner as `0x${string}`,
        signData.signature as `0x${string}`
      );
      
    } catch (err) {
      console.error("Claim error:", err);
      setError(err instanceof Error ? err.message : "Failed to claim winnings");
      setIsClaiming(false);
      setClaimStep("idle");
    }
  }, [syncedState?.winner, gameId, isClaiming, hasClaimed, completeGame]);

  // Handle successful claim transaction
  useEffect(() => {
    if (isTxSuccess && claimStep === "submitting") {
      setClaimStep("success");
      setHasClaimed(true);
      setIsClaiming(false);
      refetchGame(); // Refresh game state from blockchain
    }
  }, [isTxSuccess, claimStep, refetchGame]);

  // Handle claim transaction error
  useEffect(() => {
    if (txError && claimStep === "submitting") {
      setError(txError.message || "Transaction failed");
      setIsClaiming(false);
      setClaimStep("idle");
      resetTx();
    }
  }, [txError, claimStep, resetTx]);

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

  if (isLoadingGame || isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">{isInitializing ? "Initializing game..." : "Loading game..."}</p>
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
  const gameStatus = game.status as GameStatus;
  const gameType = game.gameType as GameType;
  const wagerAmount = formatUnits(game.wagerAmount, DUEL_DECIMALS);
  
  // Use synced state for game logic
  const currentTurn = syncedState?.currentTurn || game.player1;
  const isMyTurn = currentTurn.toLowerCase() === address.toLowerCase();
  const winner = syncedState?.winner || null;
  const isDraw = syncedState?.isDraw || false;

  // Check if game is active
  const isGameActive = gameStatus === GameStatus.Active || game.player2 !== "0x0000000000000000000000000000000000000000";
  
  // Format address for display
  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  
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

        {/* Error Toast */}
        {error && (
          <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
            {error}
          </div>
        )}

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
          
          {winner && (
            <div className={`rounded-xl p-4 text-center ${
              winner.toLowerCase() === address.toLowerCase()
                ? "bg-green-500/20 border border-green-500/50"
                : "bg-red-500/20 border border-red-500/50"
            }`}>
              <p className={`text-lg font-bold mb-2 ${winner.toLowerCase() === address.toLowerCase() ? "text-green-300" : "text-red-300"}`}>
                {winner.toLowerCase() === address.toLowerCase() ? "🎉 You Won!" : "😢 You Lost!"}
              </p>
              
              {winner.toLowerCase() === address.toLowerCase() && (
                <>
                  {/* Already claimed or game completed on-chain */}
                  {(hasClaimed || gameStatus === GameStatus.Completed) ? (
                    <div className="text-green-400 flex items-center justify-center gap-2">
                      <span>✅</span>
                      <span>Winnings claimed!</span>
                      {txHash && (
                        <a
                          href={`https://sepolia.basescan.org/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-300 hover:text-green-200 underline text-sm"
                        >
                          View tx
                        </a>
                      )}
                    </div>
                  ) : claimStep === "signing" ? (
                    <div className="flex items-center justify-center gap-2 text-yellow-300">
                      <div className="w-4 h-4 border-2 border-yellow-300 border-t-transparent rounded-full animate-spin"></div>
                      <span>Getting signature...</span>
                    </div>
                  ) : claimStep === "submitting" ? (
                    <div className="flex items-center justify-center gap-2 text-yellow-300">
                      <div className="w-4 h-4 border-2 border-yellow-300 border-t-transparent rounded-full animate-spin"></div>
                      <span>{isConfirming ? "Confirming transaction..." : "Submitting to blockchain..."}</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleClaimWin}
                      disabled={isClaiming}
                      className="mt-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-all shadow-lg"
                    >
                      💰 Claim {Number(wagerAmount) * 2} DUEL
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          
          {isDraw && (
            <div className="bg-gray-500/20 border border-gray-500/50 rounded-xl p-3 text-center">
              <p className="text-gray-300">🤝 It&apos;s a Draw!</p>
            </div>
          )}
        </div>

        {/* Game Board */}
        {isGameActive && !winner && !isDraw && syncedState && (
          <div className="flex flex-col items-center">
            {/* Turn Indicator */}
            <div className="mb-4 text-lg font-semibold">
              <span className={`inline-flex items-center gap-2 ${isMyTurn ? "text-green-400" : "text-yellow-400"}`}>
                <span className={`w-4 h-4 rounded-full ${isMyTurn ? "bg-green-400" : "bg-yellow-400"}`}></span>
                {isMyTurn ? "Your turn!" : "Waiting for opponent..."}
              </span>
            </div>
            
            {/* Player Info */}
            <div className="flex justify-between items-center w-full max-w-md mb-4">
              <div className={`flex items-center gap-2 ${currentTurn.toLowerCase() === game.player1.toLowerCase() ? "opacity-100" : "opacity-50"}`}>
                <div className="w-6 h-6 rounded-full bg-red-500"></div>
                <div>
                  <p className="text-sm font-medium">Player 1</p>
                  <p className="text-xs text-gray-400">{formatAddress(game.player1)}</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 ${currentTurn.toLowerCase() === game.player2.toLowerCase() ? "opacity-100" : "opacity-50"}`}>
                <div className="text-right">
                  <p className="text-sm font-medium">Player 2</p>
                  <p className="text-xs text-gray-400">{formatAddress(game.player2)}</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-yellow-500"></div>
              </div>
            </div>

            {/* Game Board Component */}
            {gameType === GameType.ConnectFour ? (
              <Connect4Board
                board={syncedState.board as number[][]}
                onMove={makeMove}
                disabled={!isParticipant || !isMyTurn || isPending || isConfirming}
                isMyTurn={isMyTurn}
                myColor={isPlayer1 ? "red" : "yellow"}
              />
            ) : (
              <TicTacToeBoard
                board={syncedState.board as number[]}
                onMove={makeMove}
                disabled={!isParticipant || !isMyTurn || isPending || isConfirming}
                isMyTurn={isMyTurn}
                myMark={isPlayer1 ? "X" : "O"}
              />
            )}
            
            {!isMyTurn && (
              <p className="text-gray-400 text-sm mt-4">Waiting for opponent&apos;s move...</p>
            )}
          </div>
        )}

        {/* Waiting for game to start */}
        {isGameActive && !syncedState && (
          <div className="flex flex-col items-center py-12">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400">Syncing game state...</p>
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
          <h3 className="font-semibold text-green-400 mb-2">✅ Real-Time Sync Enabled</h3>
          <p className="text-sm text-gray-400 mb-2">
            Game state is synced between players! To test:
          </p>
          <ol className="text-sm text-gray-400 list-decimal list-inside space-y-1">
            <li>Create a game with one wallet (Player 1)</li>
            <li>Open the invite link in another browser/incognito</li>
            <li>Connect a different wallet (Player 2)</li>
            <li>Accept the wager and start playing</li>
            <li>Moves sync automatically between both players!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// Connect 4 Board Component
function Connect4Board({ 
  board, 
  onMove, 
  disabled, 
  isMyTurn,
  myColor 
}: { 
  board: number[][]; 
  onMove: (col: number) => void; 
  disabled: boolean;
  isMyTurn: boolean;
  myColor: "red" | "yellow";
}) {
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  
  return (
    <div className="bg-blue-600 p-4 rounded-xl shadow-lg">
      {/* Preview row */}
      <div className="flex gap-2 mb-2 h-10">
        {Array(7).fill(null).map((_, col) => (
          <div
            key={col}
            className="w-10 h-10 flex items-center justify-center"
          >
            {hoverCol === col && !disabled && board[0][col] === 0 && (
              <div
                className={`w-8 h-8 rounded-full opacity-50 ${
                  myColor === "red" ? "bg-red-500" : "bg-yellow-400"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      
      {/* Board */}
      <div className="flex flex-col gap-2">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2">
            {row.map((cell, colIndex) => (
              <button
                key={colIndex}
                onClick={() => !disabled && board[0][colIndex] === 0 && onMove(colIndex)}
                onMouseEnter={() => setHoverCol(colIndex)}
                onMouseLeave={() => setHoverCol(null)}
                disabled={disabled || board[0][colIndex] !== 0}
                className={`w-10 h-10 rounded-full transition-all duration-200 ${
                  cell === 0
                    ? "bg-blue-800 hover:bg-blue-700"
                    : cell === 1
                    ? "bg-red-500 shadow-inner"
                    : "bg-yellow-400 shadow-inner"
                } ${!disabled && cell === 0 ? "cursor-pointer" : "cursor-not-allowed"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Tic Tac Toe Board Component
function TicTacToeBoard({ 
  board, 
  onMove, 
  disabled, 
  isMyTurn,
  myMark 
}: { 
  board: number[]; 
  onMove: (pos: number) => void; 
  disabled: boolean;
  isMyTurn: boolean;
  myMark: "X" | "O";
}) {
  return (
    <div className="grid grid-cols-3 gap-3 bg-gray-800 p-4 rounded-xl">
      {board.map((cell, index) => (
        <button
          key={index}
          onClick={() => !disabled && cell === 0 && onMove(index)}
          disabled={disabled || cell !== 0}
          className={`w-20 h-20 rounded-lg text-4xl font-bold flex items-center justify-center transition-all duration-200 ${
            cell === 0
              ? "bg-gray-700 hover:bg-gray-600"
              : "bg-gray-700"
          } ${!disabled && cell === 0 ? "cursor-pointer" : "cursor-not-allowed"}`}
        >
          {cell === 1 ? (
            <span className="text-red-500">X</span>
          ) : cell === 2 ? (
            <span className="text-yellow-400">O</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
