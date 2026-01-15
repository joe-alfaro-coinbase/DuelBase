'use client';

import { sdk } from '@farcaster/miniapp-sdk';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, type Address } from 'viem';
import { Alert, Snackbar, CircularProgress, Box } from '@mui/material';
import { useMiniApp } from './providers/miniAppProvider';
import StartGameModal, { type GameFormData } from './components/StartGameModal';
import { TicTacToeGameABI } from './contracts/TicTacToeGameABI';
import { ERC20ABI } from './contracts/ERC20ABI';

// TODO: Replace with your deployed contract address
const TICTACTOE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TICTACTOE_CONTRACT_ADDRESS as Address || '0x0000000000000000000000000000000000000000';

export default function Home() {
  const router = useRouter();
  const { address } = useAccount();
  const { isInMiniApp } = useMiniApp();

  const [isModalOpen, setIsModalOpen] = useState(true);
  const [pendingGameData, setPendingGameData] = useState<GameFormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'idle' | 'approving' | 'creating'>('idle');

  // Read the DUEL token address from the contract
  const { data: duelTokenAddress } = useReadContract({
    address: TICTACTOE_CONTRACT_ADDRESS,
    abi: TicTacToeGameABI,
    functionName: 'duelToken',
  });

  // Check current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: duelTokenAddress as Address,
    abi: ERC20ABI,
    functionName: 'allowance',
    args: address && duelTokenAddress ? [address, TICTACTOE_CONTRACT_ADDRESS] : undefined,
    query: {
      enabled: !!address && !!duelTokenAddress,
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

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  // Handle transaction confirmation
  useEffect(() => {
    if (!isConfirmed || !receipt || !pendingGameData) return;

    if (step === 'approving') {
      // Approval confirmed, now create the game
      refetchAllowance();
      createGame(pendingGameData);
    } else if (step === 'creating') {
      // Game created, find the gameId from logs
      const gameCreatedLog = receipt.logs.find((log) => {
        // GameCreated event topic
        return log.topics[0] === '0x7f4f1aa4f6a5f5c6e58d41b38acfb4d0c66e1a4f73a0f1b22a8f32e8e68f00d1';
      });

      // Get gameId from the first indexed topic (after event signature)
      let gameId = '0';
      if (receipt.logs.length > 0) {
        // The gameId is in topics[1] for indexed parameters
        const firstLog = receipt.logs[0];
        if (firstLog.topics[1]) {
          gameId = BigInt(firstLog.topics[1]).toString();
        }
      }

      // Navigate to the game page
      router.push(`/games/${TICTACTOE_CONTRACT_ADDRESS}?gameId=${gameId}`);
    }
  }, [isConfirmed, receipt, step, pendingGameData, refetchAllowance, router]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      setError(writeError.message);
      setStep('idle');
      setPendingGameData(null);
    }
  }, [writeError]);

  const createGame = useCallback(
    (data: GameFormData) => {
      if (!duelTokenAddress) {
        setError('Token address not loaded');
        return;
      }

      setStep('creating');
      const wagerAmountWei = parseUnits(data.wagerAmount, 18);

      writeContract({
        address: TICTACTOE_CONTRACT_ADDRESS,
        abi: TicTacToeGameABI,
        functionName: 'createGame',
        args: [data.opponent as Address, wagerAmountWei],
      });
    },
    [duelTokenAddress, writeContract]
  );

  const handleSubmit = useCallback(
    async (data: GameFormData) => {
      if (!address) {
        setError('Please connect your wallet');
        return;
      }

      if (!duelTokenAddress) {
        setError('Contract not loaded');
        return;
      }

      resetWrite();
      setError(null);
      setPendingGameData(data);

      const wagerAmountWei = parseUnits(data.wagerAmount, 18);

      // Check if we need approval
      if (!currentAllowance || currentAllowance < wagerAmountWei) {
        // Need to approve first
        setStep('approving');
        writeContract({
          address: duelTokenAddress as Address,
          abi: ERC20ABI,
          functionName: 'approve',
          args: [TICTACTOE_CONTRACT_ADDRESS, wagerAmountWei],
        });
      } else {
        // Already approved, create game directly
        createGame(data);
      }
    },
    [address, duelTokenAddress, currentAllowance, writeContract, createGame, resetWrite]
  );

  const isLoading = isWritePending || isConfirming;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Loading overlay */}
      {isLoading && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            gap: 2,
          }}
        >
          <CircularProgress size={48} />
          <Box sx={{ color: 'white', textAlign: 'center' }}>
            {step === 'approving' && 'Approving DUEL tokens...'}
            {step === 'creating' && 'Creating game...'}
          </Box>
        </Box>
      )}

      <StartGameModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />

      {/* Error snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
