'use client';

import { sdk } from '@farcaster/miniapp-sdk';
import { useEffect } from 'react';
import { useMiniApp } from './providers/miniAppProvider';
import StartGameModal from './components/StartGameModal';

export default function Home() {
  const { isInMiniApp, context } = useMiniApp();

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return (
    <StartGameModal open={true}/>
  );
}
