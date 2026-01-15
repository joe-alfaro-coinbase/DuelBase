'use client';

import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, Chip } from '@mui/material';
import { useAccount } from 'wagmi';

type CellState = 0 | 1 | 2; // 0 = Empty, 1 = X, 2 = O

type GameStatus = 'Created' | 'Active' | 'Completed' | 'Cancelled';

interface TicTacToeProps {
  gameId: number;
  player1: string;
  player2: string;
  board: CellState[];
  currentTurn: string;
  winner: string | null;
  isDraw: boolean;
  status: GameStatus;
  timeRemaining: number;
  wagerAmount: string;
  onMakeMove: (position: number) => Promise<void>;
  onClaimTimeout: () => Promise<void>;
  isLoading?: boolean;
}

const CELL_SYMBOLS: Record<CellState, string> = {
  0: '',
  1: 'X',
  2: 'O',
};

export default function TicTacToe({
  gameId,
  player1,
  player2,
  board,
  currentTurn,
  winner,
  isDraw,
  status,
  timeRemaining,
  wagerAmount,
  onMakeMove,
  onClaimTimeout,
  isLoading = false,
}: TicTacToeProps) {
  const { address } = useAccount();
  const [localTimeRemaining, setLocalTimeRemaining] = useState(timeRemaining);
  const [pendingMove, setPendingMove] = useState<number | null>(null);

  const isPlayer1 = address?.toLowerCase() === player1.toLowerCase();
  const isPlayer2 = address?.toLowerCase() === player2.toLowerCase();
  const isMyTurn = address?.toLowerCase() === currentTurn.toLowerCase();
  const isGameActive = status === 'Active';
  const isGameOver = status === 'Completed' || status === 'Cancelled';
  const hasTimedOut = localTimeRemaining <= 0 && isGameActive;
  const canClaimTimeout = hasTimedOut && !isMyTurn && (isPlayer1 || isPlayer2);

  // Countdown timer
  useEffect(() => {
    setLocalTimeRemaining(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    if (!isGameActive || localTimeRemaining <= 0) return;

    const interval = setInterval(() => {
      setLocalTimeRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isGameActive, localTimeRemaining]);

  const handleCellClick = useCallback(
    async (position: number) => {
      if (!isGameActive || !isMyTurn || board[position] !== 0 || isLoading || pendingMove !== null) {
        return;
      }

      setPendingMove(position);
      try {
        await onMakeMove(position);
      } finally {
        setPendingMove(null);
      }
    },
    [isGameActive, isMyTurn, board, isLoading, pendingMove, onMakeMove]
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getStatusMessage = () => {
    if (status === 'Created') {
      return 'Waiting for opponent to join...';
    }
    if (isDraw) {
      return "It's a draw! Wagers returned.";
    }
    if (winner) {
      const isWinner = address?.toLowerCase() === winner.toLowerCase();
      return isWinner ? '🎉 You won!' : 'You lost.';
    }
    if (hasTimedOut) {
      return isMyTurn ? 'You ran out of time!' : 'Opponent timed out!';
    }
    return isMyTurn ? 'Your turn' : "Opponent's turn";
  };

  const getCellColor = (cellState: CellState) => {
    if (cellState === 1) return '#3b82f6'; // blue for X
    if (cellState === 2) return '#ef4444'; // red for O
    return 'transparent';
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        maxWidth: 400,
        mx: 'auto',
        bgcolor: 'background.paper',
        borderRadius: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Game #{gameId}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Wager: {wagerAmount} DUEL
        </Typography>

        {/* Players */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Chip
            label={`X: ${formatAddress(player1)}`}
            color={isPlayer1 ? 'primary' : 'default'}
            variant={currentTurn.toLowerCase() === player1.toLowerCase() ? 'filled' : 'outlined'}
            size="small"
          />
          <Chip
            label={`O: ${formatAddress(player2)}`}
            color={isPlayer2 ? 'primary' : 'default'}
            variant={currentTurn.toLowerCase() === player2.toLowerCase() ? 'filled' : 'outlined'}
            size="small"
          />
        </Box>

        {/* Timer */}
        {isGameActive && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="h4"
              sx={{
                fontFamily: 'monospace',
                color: localTimeRemaining < 30 ? 'error.main' : 'text.primary',
              }}
            >
              {formatTime(localTimeRemaining)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isMyTurn ? 'Your time' : "Opponent's time"}
            </Typography>
          </Box>
        )}

        {/* Status */}
        <Typography
          variant="body1"
          sx={{
            fontWeight: 600,
            color: winner
              ? address?.toLowerCase() === winner.toLowerCase()
                ? 'success.main'
                : 'error.main'
              : 'text.primary',
          }}
        >
          {getStatusMessage()}
        </Typography>
      </Box>

      {/* Board */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
          mb: 3,
        }}
      >
        {board.map((cell, index) => (
          <Box
            key={index}
            onClick={() => handleCellClick(index)}
            sx={{
              aspectRatio: '1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'action.hover',
              borderRadius: 1,
              cursor:
                isGameActive && isMyTurn && cell === 0 && !isLoading ? 'pointer' : 'default',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor:
                  isGameActive && isMyTurn && cell === 0 && !isLoading
                    ? 'action.selected'
                    : 'action.hover',
              },
              position: 'relative',
            }}
          >
            {pendingMove === index ? (
              <CircularProgress size={24} />
            ) : (
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  color: getCellColor(cell),
                  userSelect: 'none',
                }}
              >
                {CELL_SYMBOLS[cell]}
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {/* Actions */}
      {canClaimTimeout && (
        <Button
          variant="contained"
          color="success"
          fullWidth
          onClick={onClaimTimeout}
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Claim Timeout Win'}
        </Button>
      )}

      {isGameOver && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Game Over
        </Typography>
      )}
    </Paper>
  );
}
