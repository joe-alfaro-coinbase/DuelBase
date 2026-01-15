import { NextRequest, NextResponse } from "next/server";

// In-memory game state storage (for MVP - use database in production)
// This will persist across requests but reset on server restart
const gameStates = new Map<string, GameState>();

interface GameState {
  gameId: string;
  gameType: "tictactoe" | "connect4";
  board: number[][] | number[]; // 2D for connect4, 1D for tictactoe
  currentTurn: string; // address of whose turn it is
  moves: Move[];
  winner: string | null;
  isDraw: boolean;
  lastUpdated: number;
}

interface Move {
  player: string;
  position: number | { row: number; col: number };
  timestamp: number;
}

// GET - Retrieve game state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  
  const state = gameStates.get(gameId);
  
  if (!state) {
    return NextResponse.json({ exists: false });
  }
  
  return NextResponse.json({ exists: true, state });
}

// POST - Initialize or update game state
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const body = await request.json();
  
  // Initialize new game
  if (body.action === "init") {
    const { gameType, player1, player2 } = body;
    
    let initialBoard: number[][] | number[];
    if (gameType === "connect4") {
      // 6 rows x 7 columns, all zeros
      initialBoard = Array(6).fill(null).map(() => Array(7).fill(0));
    } else {
      // Tic-tac-toe: 9 cells
      initialBoard = Array(9).fill(0);
    }
    
    const state: GameState = {
      gameId,
      gameType,
      board: initialBoard,
      currentTurn: player1, // Player 1 always starts
      moves: [],
      winner: null,
      isDraw: false,
      lastUpdated: Date.now(),
    };
    
    gameStates.set(gameId, state);
    return NextResponse.json({ success: true, state });
  }
  
  // Make a move
  if (body.action === "move") {
    const { player, position } = body;
    
    let state = gameStates.get(gameId);
    if (!state) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    
    // Verify it's the player's turn
    if (state.currentTurn.toLowerCase() !== player.toLowerCase()) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }
    
    // Check if game is already over
    if (state.winner || state.isDraw) {
      return NextResponse.json({ error: "Game is already over" }, { status: 400 });
    }
    
    // Apply the move based on game type
    if (state.gameType === "connect4") {
      const board = state.board as number[][];
      const col = position as number;
      
      // Find the lowest empty row in this column
      let row = -1;
      for (let r = 5; r >= 0; r--) {
        if (board[r][col] === 0) {
          row = r;
          break;
        }
      }
      
      if (row === -1) {
        return NextResponse.json({ error: "Column is full" }, { status: 400 });
      }
      
      // Determine player number (1 for player1, 2 for player2)
      const playerNum = state.moves.length % 2 === 0 ? 1 : 2;
      board[row][col] = playerNum;
      
      // Check for win
      const winner = checkConnect4Win(board, row, col, playerNum);
      if (winner) {
        state.winner = player;
      }
      
      // Check for draw (board full)
      if (!state.winner && board[0].every((cell, c) => board.some((row) => row[c] !== 0) && board[0][c] !== 0)) {
        // Check if top row is full
        if (board[0].every(cell => cell !== 0)) {
          state.isDraw = true;
        }
      }
      
      state.moves.push({ player, position: { row, col: col }, timestamp: Date.now() });
      
    } else {
      // Tic-tac-toe
      const board = state.board as number[];
      const pos = position as number;
      
      if (board[pos] !== 0) {
        return NextResponse.json({ error: "Cell already occupied" }, { status: 400 });
      }
      
      const playerNum = state.moves.length % 2 === 0 ? 1 : 2;
      board[pos] = playerNum;
      
      // Check for win
      const winner = checkTicTacToeWin(board);
      if (winner) {
        state.winner = player;
      }
      
      // Check for draw
      if (!state.winner && board.every(cell => cell !== 0)) {
        state.isDraw = true;
      }
      
      state.moves.push({ player, position: pos, timestamp: Date.now() });
    }
    
    // Switch turns if game isn't over
    if (!state.winner && !state.isDraw) {
      const nextPlayer = body.opponent;
      state.currentTurn = nextPlayer;
    }
    
    state.lastUpdated = Date.now();
    gameStates.set(gameId, state);
    
    return NextResponse.json({ success: true, state });
  }
  
  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// Check Connect 4 win
function checkConnect4Win(board: number[][], row: number, col: number, player: number): boolean {
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
      if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 && board[newRow][newCol] === player) {
        count++;
      } else {
        break;
      }
    }
    
    // Check negative direction
    for (let i = 1; i < 4; i++) {
      const newRow = row - dRow * i;
      const newCol = col - dCol * i;
      if (newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 7 && board[newRow][newCol] === player) {
        count++;
      } else {
        break;
      }
    }
    
    if (count >= 4) return true;
  }
  
  return false;
}

// Check Tic Tac Toe win
function checkTicTacToeWin(board: number[]): number | null {
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
}
