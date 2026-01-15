"use client";

import { sdk } from "@farcaster/miniapp-sdk";
import { useEffect } from "react";
import { TokenStore } from "@/app/components/TokenStore";
import { WalletIndicator } from "@/app/components/WalletIndicator";

export default function StorePage() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <WalletIndicator />
      
      <div className="max-w-lg mx-auto px-4 py-8 pt-16">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            DuelBase Store
          </h1>
          <p className="text-gray-400">
            Get DUEL tokens to wager on games
          </p>
        </div>

        {/* Store Component */}
        <TokenStore />

        {/* Info Section */}
        <div className="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
          <h3 className="font-bold text-white mb-3">How it works</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-purple-400">1.</span>
              <span>Connect your wallet to see your balances</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">2.</span>
              <span>Enter the amount of DUEL you want to buy</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">3.</span>
              <span>Approve USDC spending (first time only)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400">4.</span>
              <span>Confirm your purchase</span>
            </li>
          </ul>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-purple-400 hover:text-purple-300 font-medium hover:underline"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
