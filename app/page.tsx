'use client';

import { sdk } from '@farcaster/miniapp-sdk';
import { useEffect, useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { baseSepolia } from 'wagmi/chains';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMiniApp } from './providers/miniAppProvider';
import { PendingGames } from './components/PendingGames';
import {
  useDuelBalance,
  useDuelAllowance,
  useGameActions,
  useCalculatePlayer1Wager,
  GameType,
  DUEL_DECIMALS,
  CONTRACTS,
} from './hooks/useGameContracts';

export default function Home() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { isInMiniApp } = useMiniApp();

  const isWrongNetwork = chainId !== baseSepolia.id;

  // Game creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [wagerAmount, setWagerAmount] = useState('');
  const [gameType, setGameType] = useState<GameType>(GameType.TicTacToe);
  const [step, setStep] = useState<'form' | 'approve' | 'creating-after-approve' | 'create' | 'success'>('form');
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Contract data
  const { data: duelBalance, refetch: refetchBalance } = useDuelBalance(address);
  const { data: duelAllowance, refetch: refetchAllowance } = useDuelAllowance(address);
  
  // Calculate Player 1's actual cost (base wager + edge fee)
  const wagerBigInt = wagerAmount ? parseUnits(wagerAmount, DUEL_DECIMALS) : BigInt(0);
  const { data: player1WagerCost } = useCalculatePlayer1Wager(wagerBigInt, gameType);

  // Game actions
  const {
    approveTokens,
    createGame,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
    reset,
    receipt,
  } = useGameActions();

  const formattedBalance = duelBalance ? formatUnits(duelBalance, DUEL_DECIMALS) : '0';
  // Player 1 needs to approve and have enough for wager + edge fee
  const actualCost = player1WagerCost || wagerBigInt;
  const needsApproval = duelAllowance !== undefined && actualCost > BigInt(0) && duelAllowance < actualCost;
  const hasEnoughBalance = duelBalance !== undefined && actualCost <= duelBalance;

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  // Handle successful transactions
  useEffect(() => {
    if (isSuccess && hash) {
      if (step === 'approve') {
        // Show loading state while preparing to create game
        setStep('creating-after-approve');
        
        // Wait for allowance to update, then auto-trigger create
        const proceedToCreate = async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await refetchAllowance();
          reset();
          // Directly trigger createGame after approval
          if (opponent && wagerAmount) {
            setStep('create');
            createGame(
              opponent as `0x${string}`,
              parseUnits(wagerAmount, DUEL_DECIMALS),
              gameType
            );
          }
        };
        proceedToCreate();
      } else if (step === 'create' && receipt) {
        // Game created successfully - extract gameId from GameCreated event
        let gameId = '0';
        
        // Find the log from GameManager contract (not ERC20 transfer logs)
        const gameManagerLog = receipt.logs.find(
          (log) => log.address.toLowerCase() === CONTRACTS.GAME_MANAGER.toLowerCase()
        );
        
        if (gameManagerLog && gameManagerLog.topics[1]) {
          // topics[0] = event signature, topics[1] = gameId (indexed)
          gameId = BigInt(gameManagerLog.topics[1]).toString();
        }
        
        setCreatedGameId(gameId);
        setStep('success');
        refetchBalance();
      }
    }
  }, [isSuccess, hash, step, opponent, wagerAmount, gameType, refetchAllowance, refetchBalance, createGame, reset, receipt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponent || !wagerAmount) return;

    // Reset any previous transaction state
    reset();

    if (needsApproval) {
      setStep('approve');
      // Approve the actual cost (wager + edge fee for Player 1)
      approveTokens(actualCost);
    } else {
      setStep('create');
      createGame(
        opponent as `0x${string}`,
        wagerBigInt,
        gameType
      );
    }
  };

  const resetForm = () => {
    setShowCreateModal(false);
    setOpponent('');
    setWagerAmount('');
    setGameType(GameType.TicTacToe);
    setStep('form');
    setCreatedGameId(null);
    setCopied(false);
  };

  const goToGame = () => {
    if (createdGameId) {
      router.push(`/games/${createdGameId}`);
    }
  };

  const copyInviteLink = () => {
    if (createdGameId) {
      navigator.clipboard.writeText(`${window.location.origin}/games/${createdGameId}`);
      setCopied(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-sm border-b border-purple-500/20 text-white p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">🎮 DuelBase</h1>
            <p className="text-purple-300/70 text-sm">1v1 Wagering Games</p>
          </div>
          {isConnected && (
            <div className="text-right">
              <p className="text-xs text-purple-300/70">Balance</p>
              <p className="font-bold text-white">{Number(formattedBalance).toLocaleString()} DUEL</p>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {/* Network Warning */}
        {isConnected && isWrongNetwork && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
            <p className="text-red-300 font-medium mb-2">Wrong Network</p>
            <button
              onClick={() => switchChain({ chainId: baseSepolia.id })}
              disabled={isSwitching}
              className="w-full py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
            >
              {isSwitching ? 'Switching...' : 'Switch to Base Sepolia'}
            </button>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!isConnected || isWrongNetwork}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⚔️ New Game
          </button>
          <Link
            href="/store"
            className="bg-gray-800/80 hover:bg-gray-700/80 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all text-center border border-purple-500/30"
          >
            🪙 Buy DUEL
          </Link>
        </div>

        {/* Pending Games */}
        {isConnected && !isWrongNetwork && <PendingGames />}

        {/* Not Connected State */}
        {!isConnected && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-8 text-center">
            <div className="text-6xl mb-4">🎮</div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to DuelBase</h2>
            <p className="text-gray-400 mb-6">
              Connect your wallet to start playing 1v1 wagering games with friends!
            </p>
            <p className="text-sm text-gray-500">
              Use the wallet button in the top corner to connect.
            </p>
          </div>
        )}
      </main>

      {/* Create Game Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-purple-500/30 rounded-2xl shadow-xl shadow-purple-500/10 max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            {step === 'success' ? (
              // Success State
              <div className="text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold text-white mb-2">Game Created!</h2>
                <p className="text-gray-400 mb-6">
                  Share the link with your opponent or go to the game page.
                </p>
                
                {hash && (
                  <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-purple-500/20">
                    <p className="text-xs text-gray-500 mb-2">Transaction Hash</p>
                    <p className="font-mono text-sm text-gray-300 break-all">{hash}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    onClick={goToGame}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl transition-all"
                  >
                    🎮 Go to Game
                  </button>
                  <button
                    onClick={copyInviteLink}
                    className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-all border border-purple-500/30"
                  >
                    {copied ? '✅ Link Copied!' : '📋 Copy Invite Link'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="w-full py-3 text-gray-400 hover:text-white transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              // Form State
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Create New Game</h2>
                  <button
                    onClick={resetForm}
                    className="text-gray-500 hover:text-gray-300 text-2xl"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Game Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Game Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGameType(GameType.TicTacToe)}
                        className={`py-3 px-4 rounded-xl border-2 transition-all ${
                          gameType === GameType.TicTacToe
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        ⭕ Tic Tac Toe
                      </button>
                      <button
                        type="button"
                        onClick={() => setGameType(GameType.ConnectFour)}
                        className={`py-3 px-4 rounded-xl border-2 transition-all ${
                          gameType === GameType.ConnectFour
                            ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        🔴 Connect Four
                      </button>
                    </div>
                  </div>

                  {/* Opponent Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Opponent Address
                    </label>
                    <input
                      type="text"
                      value={opponent}
                      onChange={(e) => setOpponent(e.target.value)}
                      placeholder="0x..."
                      className="w-full px-4 py-3 border border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-white bg-gray-800 placeholder-gray-500"
                      required
                    />
                  </div>

                  {/* Wager Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Wager Amount (DUEL)
                    </label>
                    <input
                      type="number"
                      value={wagerAmount}
                      onChange={(e) => setWagerAmount(e.target.value)}
                      placeholder="100"
                      min="1"
                      className="w-full px-4 py-3 border border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all text-white bg-gray-800 placeholder-gray-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your balance: {Number(formattedBalance).toLocaleString()} DUEL
                    </p>
                    {wagerAmount && player1WagerCost && player1WagerCost > wagerBigInt && (
                      <p className="text-xs text-purple-400 mt-1">
                        💡 Your cost: {formatUnits(player1WagerCost, DUEL_DECIMALS)} DUEL (includes 5% edge fee)
                      </p>
                    )}
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="bg-red-500/20 border border-red-500/50 text-red-300 rounded-xl p-3 text-sm">
                      {error.message.slice(0, 100)}
                    </div>
                  )}

                  {/* Balance Warning */}
                  {wagerAmount && !hasEnoughBalance && (
                    <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-3">
                      <p className="text-yellow-300 text-sm">
                        Insufficient balance.{' '}
                        <Link href="/store" className="text-purple-400 font-medium hover:text-purple-300">
                          Get more DUEL →
                        </Link>
                      </p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={
                      isPending ||
                      isConfirming ||
                      step === 'creating-after-approve' ||
                      !opponent ||
                      !wagerAmount ||
                      !hasEnoughBalance
                    }
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isPending || isConfirming || step === 'creating-after-approve' ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {step === 'approve' ? 'Approving...' : step === 'creating-after-approve' ? 'Preparing game...' : 'Creating...'}
                      </>
                    ) : needsApproval ? (
                      '🔓 Approve & Create Game'
                    ) : (
                      '⚔️ Create Game'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
