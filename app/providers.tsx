'use client';

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { config } from "./config";
import { MiniAppIndicator } from "./providers/miniAppIndicator";
import { MiniAppProvider } from "./providers/miniAppProvider";

const queryClient = new QueryClient();

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MiniAppProvider>
      <MiniAppIndicator />
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WagmiProvider>
      </ThemeProvider>
    </MiniAppProvider>
  );
}
