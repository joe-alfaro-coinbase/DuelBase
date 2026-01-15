"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { formatUnits, parseUnits } from "viem";
import {
  useDuelBalance,
  useUsdcBalance,
  useUsdcAllowance,
  useTokenPrice,
  useStoreIsOpen,
  useStoreInventory,
  useCalculateCost,
  useTokenStore,
  USDC_DECIMALS,
  DUEL_DECIMALS,
} from "@/app/hooks/useGameContracts";

export function TokenStore() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [duelAmount, setDuelAmount] = useState("");
  const [step, setStep] = useState<"input" | "approve" | "buy" | "success">("input");
  
  // Check if on correct network
  const isWrongNetwork = chainId !== baseSepolia.id;

  // Read contract data
  const { data: duelBalance, refetch: refetchDuel } = useDuelBalance(address);
  const { data: usdcBalance, refetch: refetchUsdc } = useUsdcBalance(address);
  const { data: usdcAllowance, refetch: refetchAllowance } = useUsdcAllowance(address);
  const { data: pricePerToken } = useTokenPrice();
  const { data: isOpen } = useStoreIsOpen();
  const { data: inventory } = useStoreInventory();

  // Calculate cost for the entered amount
  const duelAmountBigInt = duelAmount ? parseUnits(duelAmount, DUEL_DECIMALS) : BigInt(0);
  const { data: usdcCost } = useCalculateCost(duelAmountBigInt);

  // Write operations
  const {
    approveUsdc,
    buyTokens,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  } = useTokenStore();

  // Check if approval is needed
  const needsApproval = usdcAllowance !== undefined && usdcCost !== undefined && usdcAllowance < usdcCost;

  // Format display values
  const formattedDuelBalance = duelBalance ? formatUnits(duelBalance, DUEL_DECIMALS) : "0";
  const formattedUsdcBalance = usdcBalance ? formatUnits(usdcBalance, USDC_DECIMALS) : "0";
  const formattedUsdcCost = usdcCost ? formatUnits(usdcCost, USDC_DECIMALS) : "0";
  const formattedInventory = inventory ? formatUnits(inventory, DUEL_DECIMALS) : "0";
  const formattedPrice = pricePerToken ? formatUnits(pricePerToken, USDC_DECIMALS) : "0";

  // Handle successful transaction
  useEffect(() => {
    if (isSuccess) {
      if (step === "approve") {
        // Small delay for blockchain state to update
        setTimeout(() => {
          refetchAllowance();
          setStep("buy");
          reset();
        }, 1000);
      } else if (step === "buy") {
        // Refetch balances after a short delay for blockchain state to propagate
        const refetchBalances = async () => {
          // Wait a bit for blockchain state
          await new Promise(resolve => setTimeout(resolve, 2000));
          await Promise.all([refetchDuel(), refetchUsdc()]);
          setStep("success");
        };
        refetchBalances();
      }
    }
  }, [isSuccess, step, refetchAllowance, refetchDuel, refetchUsdc, reset]);

  const handleApprove = useCallback(() => {
    if (!usdcCost) return;
    setStep("approve");
    // Approve exact amount needed (or slightly more for safety)
    approveUsdc(usdcCost);
  }, [usdcCost, approveUsdc]);

  const handleBuy = useCallback(() => {
    if (!duelAmountBigInt) return;
    setStep("buy");
    buyTokens(duelAmountBigInt);
  }, [duelAmountBigInt, buyTokens]);

  const handleReset = useCallback(() => {
    setStep("input");
    setDuelAmount("");
    reset();
    // Refetch balances when returning to input
    refetchDuel();
    refetchUsdc();
    refetchAllowance();
  }, [reset, refetchDuel, refetchUsdc, refetchAllowance]);

  // Quick amount buttons
  const quickAmounts = ["100", "500", "1000", "5000"];

  if (!isConnected) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-8 text-center">
        <div className="text-6xl mb-4">🪙</div>
        <h2 className="text-2xl font-bold text-white mb-2">DUEL Token Store</h2>
        <p className="text-gray-400 mb-4">Connect your wallet to purchase DUEL tokens</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-400 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-gray-500" />
          Wallet not connected
        </div>
      </div>
    );
  }

  if (isOpen === false) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-8 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-white mb-2">Store Closed</h2>
        <p className="text-gray-400">The token store is currently closed. Check back later!</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-purple-500/20 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>🪙</span> DUEL Token Store
            </h2>
            <p className="text-purple-200 text-sm mt-1">
              Buy DUEL tokens with USDC
            </p>
          </div>
          <div className="text-right">
            <div className="text-purple-200 text-xs">Current Price</div>
            <div className="text-white font-bold text-lg">${formattedPrice}/DUEL</div>
          </div>
        </div>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-4 p-6 bg-gray-900/50">
        <div className="bg-gray-800 rounded-xl p-4 border border-purple-500/20">
          <div className="text-gray-400 text-xs font-medium mb-1">Your DUEL Balance</div>
          <div className="text-2xl font-bold text-white">
            {Number(formattedDuelBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-purple-400 text-xs">DUEL</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-blue-500/20">
          <div className="text-gray-400 text-xs font-medium mb-1">Your USDC Balance</div>
          <div className="text-2xl font-bold text-white">
            ${Number(formattedUsdcBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-blue-400 text-xs">USDC</div>
        </div>
      </div>

      {/* Purchase Section */}
      <div className="p-6">
        {step === "success" ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-green-400 mb-2">Purchase Complete!</h3>
            <p className="text-gray-400 mb-6">
              You successfully purchased {duelAmount} DUEL tokens
            </p>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              Buy More
            </button>
          </div>
        ) : (
          <>
            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-gray-300 font-medium mb-2">
                Amount to Buy (DUEL)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={duelAmount}
                  onChange={(e) => setDuelAmount(e.target.value)}
                  placeholder="Enter amount..."
                  disabled={isPending || isConfirming}
                  className="w-full px-4 py-4 text-xl font-semibold text-white bg-gray-800 border-2 border-purple-500/30 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all disabled:bg-gray-700 placeholder:text-gray-500"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 font-medium">
                  DUEL
                </span>
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex gap-2 mb-6">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setDuelAmount(amount)}
                  disabled={isPending || isConfirming}
                  className="flex-1 py-2 px-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-medium rounded-lg transition-colors disabled:opacity-50 border border-purple-500/30"
                >
                  {amount}
                </button>
              ))}
            </div>

            {/* Cost Display */}
            {duelAmount && usdcCost !== undefined && (
              <div className="bg-gray-800 rounded-xl p-4 mb-6 border border-purple-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">You Pay</span>
                  <span className="text-2xl font-bold text-white">
                    ${Number(formattedUsdcCost).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-700">
                  <span className="text-gray-400">You Receive</span>
                  <span className="text-xl font-semibold text-purple-400">
                    {Number(duelAmount).toLocaleString()} DUEL
                  </span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 rounded-xl p-4 mb-4 text-sm">
                {error.message.includes("insufficient") 
                  ? "Insufficient USDC balance" 
                  : error.message.slice(0, 100)}
              </div>
            )}

            {/* Wrong Network Warning */}
            {isWrongNetwork && (
              <button
                onClick={() => switchChain({ chainId: baseSepolia.id })}
                disabled={isSwitching}
                className="w-full py-4 mb-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSwitching ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Switching...
                  </>
                ) : (
                  <>
                    <span>⚠️</span> Switch to Base Sepolia
                  </>
                )}
              </button>
            )}

            {/* Action Button */}
            {duelAmount && Number(duelAmount) > 0 && !isWrongNetwork && (
              <button
                onClick={needsApproval ? handleApprove : handleBuy}
                disabled={isPending || isConfirming || !usdcCost || (usdcBalance !== undefined && usdcCost !== undefined && usdcCost > usdcBalance)}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending || isConfirming ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {step === "approve" ? "Approving..." : "Purchasing..."}
                  </>
                ) : needsApproval ? (
                  <>
                    <span>🔓</span> Approve USDC
                  </>
                ) : usdcBalance && usdcCost && usdcCost > usdcBalance ? (
                  "Insufficient USDC"
                ) : (
                  <>
                    <span>💰</span> Buy {Number(duelAmount).toLocaleString()} DUEL
                  </>
                )}
              </button>
            )}
          </>
        )}

        {/* Store Info */}
        <div className="mt-6 pt-6 border-t border-purple-500/20">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Store Inventory</span>
            <span className="font-medium text-gray-300">
              {Number(formattedInventory).toLocaleString(undefined, { maximumFractionDigits: 0 })} DUEL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
