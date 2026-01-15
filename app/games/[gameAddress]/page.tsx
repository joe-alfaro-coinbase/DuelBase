'use client';

import { use, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, type Address } from 'viem';
import { Box, Typography, CircularProgress, Button, Alert } from '@mui/material';
import TicTacToe from '../../components/TicTacToe';
import { TicTacToeGameABI } from '../../contracts/TicTacToeGameABI';

type GameStatus = 'Created' | 'Active' | 'Completed' | 'Cancelled';

const STATUS_MAP: Record<number, GameStatus> = {
  0: 'Created',
  1: 'Active',
  2: 'Completed',
  3: 'Cancelled',
};

interface PageProps {
  params: Promise<{ gameAddress: string }>;
}

export default function GamePage({ params }: PageProps) {
  const { gameAddress } = use(params);
  const searchParams = useSearchParams();
  const gameId = searchParams.get('gameId') ?? '0';

  const contractAddress = gameAddress as Address;
  const gameIdBigInt = BigInt(gameId);

  // Read game state
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
    },
  });

  // Write contract hooks
  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    error: writeError,
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

  // Loading state
  if (isLoadingGame) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (gameError) {
    return (
      <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load game: {gameError.message}
        </Alert>
        <Button variant="contained" onClick={() => refetchGame()}>
          Retry
        </Button>
      </Box>
    );
  }

  // No game data
  if (!gameData) {
    return (
      <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
        <Alert severity="warning">Game not found</Alert>
      </Box>
    );
  }

  const game = gameData;
  const status = STATUS_MAP[game.status] ?? 'Created';
  const board = [...game.board] as (0 | 1 | 2)[];
  const wagerAmount = formatUnits(game.wagerAmount, 18);
  const timeRemainingSeconds = timeRemaining ? Number(timeRemaining) : 120;

  return (
    <Box sx={{ p: 4, minHeight: '100vh' }}>
      {/* Transaction error */}
      {writeError && (
        <Alert severity="error" sx={{ mb: 2, maxWidth: 400, mx: 'auto' }}>
          Transaction failed: {writeError.message}
        </Alert>
      )}

      {/* Show join button if game is in Created status */}
      {status === 'Created' && (
        <Box sx={{ maxWidth: 400, mx: 'auto', mb: 3, textAlign: 'center' }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Waiting for opponent to join...
          </Alert>
          <Button
            variant="contained"
            onClick={handleJoinGame}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : 'Join Game'}
          </Button>
        </Box>
      )}

      {/* Render TicTacToe component */}
      <TicTacToe
        gameId={Number(game.id)}
        player1={game.player1}
        player2={game.player2}
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

      {/* Contract info */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Contract: {contractAddress}
        </Typography>
      </Box>
    </Box>
  );
}
