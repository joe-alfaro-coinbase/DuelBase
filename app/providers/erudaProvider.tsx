'use client';

import { useEffect } from 'react';

export function ErudaProvider() {
  useEffect(() => {
    // Only load Eruda on the client side to prevent hydration mismatch
    if (typeof window !== 'undefined' && !(window as unknown as { eruda?: unknown }).eruda) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/eruda';
      script.onload = () => {
        (window as unknown as { eruda: { init: () => void } }).eruda.init();
      };
      document.body.appendChild(script);
    }
  }, []);

  return null;
}
