"use client";

import { useState, useEffect, useCallback } from "react";

interface Connect4Props {
  gameId: bigint;
  player1: string;
  player2: string;
  currentPlayer: string;
  isMyTurn: boolean;
  onMove: (column: number) => void;
  disabled?: boolean;
}

type Cell = "red" | "yellow" | null;
type Board = Cell[][];

const ROWS = 6;
const COLS = 7;

function createEmptyBoard(): Board {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
}

function checkWin(board: Board, row: number, col: number, player: Cell): boolean {
  if (!player) return false;

  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal down-right
    [1, -1],  // diagonal down-left
  ];

  for (const [dRow, dCol] of directions) {
    let count = 1;

    // Check positive direction
    for (let i = 1; i < 4; i++) {
      const newRow = row + dRow * i;
      const newCol = col + dCol * i;
      if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS) break;
      if (board[newRow][newCol] !== player) break;
      count++;
    }

    // Check negative direction
    for (let i = 1; i < 4; i++) {
      const newRow = row - dRow * i;
      const newCol = col - dCol * i;
      if (newRow < 0 || newRow >= ROWS || newCol < 0 || newCol >= COLS) break;
      if (board[newRow][newCol] !== player) break;
      count++;
    }

    if (count >= 4) return true;
  }

  return false;
}

function isBoardFull(board: Board): boolean {
  return board[0].every(cell => cell !== null);
}

export function Connect4({
  gameId,
  player1,
  player2,
  currentPlayer,
  isMyTurn,
  onMove,
  disabled = false,
}: Connect4Props) {
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [currentTurn, setCurrentTurn] = useState<"red" | "yellow">("red");
  const [winner, setWinner] = useState<Cell>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [hoverColumn, setHoverColumn] = useState<number | null>(null);
  const [lastMove, setLastMove] = useState<{ row: number; col: number } | null>(null);

  // Player 1 is always red (goes first), Player 2 is yellow
  const myColor: Cell = currentPlayer.toLowerCase() === player1.toLowerCase() ? "red" : "yellow";
  const canPlay = isMyTurn && !winner && !isDraw && !disabled && currentTurn === myColor;

  const dropPiece = useCallback((col: number) => {
    if (!canPlay) return;
    if (board[0][col] !== null) return; // Column is full

    // Find the lowest empty row
    let row = ROWS - 1;
    while (row >= 0 && board[row][col] !== null) {
      row--;
    }

    if (row < 0) return; // Column is full

    // Make the move
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentTurn;
    setBoard(newBoard);
    setLastMove({ row, col });

    // Check for win
    if (checkWin(newBoard, row, col, currentTurn)) {
      setWinner(currentTurn);
    } else if (isBoardFull(newBoard)) {
      setIsDraw(true);
    } else {
      // Switch turns
      setCurrentTurn(currentTurn === "red" ? "yellow" : "red");
    }

    // Notify parent
    onMove(col);
  }, [board, currentTurn, canPlay, onMove]);

  const getColumnTop = (col: number): number => {
    let row = ROWS - 1;
    while (row >= 0 && board[row][col] !== null) {
      row--;
    }
    return row;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Game Status */}
      <div className="mb-4 text-center">
        {winner ? (
          <div className="text-2xl font-bold">
            <span className={winner === "red" ? "text-red-500" : "text-yellow-400"}>
              {winner === "red" ? "🔴 Red" : "🟡 Yellow"} Wins!
            </span>
          </div>
        ) : isDraw ? (
          <div className="text-2xl font-bold text-gray-400">It&apos;s a Draw!</div>
        ) : (
          <div className="text-lg">
            <span className={currentTurn === "red" ? "text-red-500" : "text-yellow-400"}>
              {currentTurn === "red" ? "🔴 Red" : "🟡 Yellow"}&apos;s turn
            </span>
            {canPlay && <span className="ml-2 text-green-400">(Your move!)</span>}
          </div>
        )}
      </div>

      {/* Players */}
      <div className="flex justify-between w-full max-w-md mb-4 text-sm">
        <div className={`flex items-center gap-2 ${currentTurn === "red" && !winner ? "opacity-100" : "opacity-50"}`}>
          <span className="text-2xl">🔴</span>
          <div>
            <div className="font-medium text-white">Player 1</div>
            <div className="font-mono text-xs text-gray-400">
              {player1.slice(0, 6)}...{player1.slice(-4)}
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${currentTurn === "yellow" && !winner ? "opacity-100" : "opacity-50"}`}>
          <div className="text-right">
            <div className="font-medium text-white">Player 2</div>
            <div className="font-mono text-xs text-gray-400">
              {player2.slice(0, 6)}...{player2.slice(-4)}
            </div>
          </div>
          <span className="text-2xl">🟡</span>
        </div>
      </div>

      {/* Board */}
      <div className="bg-blue-600 p-3 rounded-xl shadow-2xl">
        {/* Column buttons (for dropping pieces) */}
        <div className="flex mb-2">
          {Array(COLS).fill(null).map((_, col) => {
            const topRow = getColumnTop(col);
            const isColumnFull = topRow < 0;
            
            return (
              <button
                key={col}
                onClick={() => dropPiece(col)}
                onMouseEnter={() => setHoverColumn(col)}
                onMouseLeave={() => setHoverColumn(null)}
                disabled={!canPlay || isColumnFull}
                className={`w-12 h-8 flex items-center justify-center transition-all ${
                  canPlay && !isColumnFull
                    ? "hover:bg-blue-500 cursor-pointer"
                    : "cursor-not-allowed opacity-50"
                }`}
              >
                {hoverColumn === col && canPlay && !isColumnFull && (
                  <div className={`w-8 h-8 rounded-full ${
                    myColor === "red" ? "bg-red-500/50" : "bg-yellow-400/50"
                  }`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {board.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  cell === "red"
                    ? "bg-red-500 shadow-inner"
                    : cell === "yellow"
                    ? "bg-yellow-400 shadow-inner"
                    : "bg-blue-800"
                } ${
                  lastMove?.row === rowIndex && lastMove?.col === colIndex
                    ? "ring-4 ring-white/50"
                    : ""
                }`}
              >
                {cell && (
                  <div className={`w-10 h-10 rounded-full ${
                    cell === "red"
                      ? "bg-gradient-to-br from-red-400 to-red-600"
                      : "bg-gradient-to-br from-yellow-300 to-yellow-500"
                  }`} />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center text-sm text-gray-400">
        {canPlay ? (
          <p>Click a column to drop your piece</p>
        ) : winner ? (
          <p>Game Over! Winner will receive the pot.</p>
        ) : isDraw ? (
          <p>Game ended in a draw. Wagers will be returned.</p>
        ) : (
          <p>Waiting for opponent&apos;s move...</p>
        )}
      </div>
    </div>
  );
}
