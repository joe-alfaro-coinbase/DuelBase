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
    <div className="min-h-screen bg-gradient-to-b from-amber-100 via-orange-50 to-white">
      <WalletIndicator />
      
      <div className="max-w-lg mx-auto px-4 py-8 pt-16">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            DuelBase Store
          </h1>
          <p className="text-gray-600">
            Get DUEL tokens to wager on games
          </p>
        </div>

        {/* Store Component */}
        <TokenStore />

        {/* Info Section */}
        <div className="mt-8 bg-white/80 rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-3">How it works</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-amber-500">1.</span>
              <span>Connect your wallet to see your balances</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500">2.</span>
              <span>Enter the amount of DUEL you want to buy</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500">3.</span>
              <span>Approve USDC spending (first time only)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500">4.</span>
              <span>Confirm your purchase</span>
            </li>
          </ul>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-amber-600 hover:text-amber-700 font-medium hover:underline"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
