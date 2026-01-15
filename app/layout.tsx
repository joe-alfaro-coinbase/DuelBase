import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { WalletIndicator } from "./components/WalletIndicator";
import "./globals.css";
import { Providers } from "./providers";
import { ErudaProvider } from "./providers/erudaProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DuelBase - 1v1 Wagering Games",
  description: "Play 1v1 wagering games with friends on Base. Tic-Tac-Toe, Connect 4, and more with DUEL token stakes.",
  metadataBase: new URL('https://duel-base.vercel.app'),
  keywords: ["base", "farcaster", "mini app", "games", "wagering", "duel", "tic-tac-toe", "connect4"],
  openGraph: {
    title: "DuelBase - 1v1 Wagering Games",
    description: "Play 1v1 wagering games with friends on Base. Stake DUEL tokens and compete!",
    url: "https://duel-base.vercel.app",
    siteName: "DuelBase",
    images: [
      {
        url: "/hero.png",
        width: 1200,
        height: 630,
        alt: "DuelBase - 1v1 Wagering Games"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "DuelBase - 1v1 Wagering Games",
    description: "Play 1v1 wagering games with friends on Base. Stake DUEL tokens and compete!",
    images: ["/hero.png"]
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png"
  },
  other: {
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: "https://duel-base.vercel.app/hero.png",
      button: {
        title: "Play Now",
        action: {
          type: "launch_miniapp",
          url: "https://duel-base.vercel.app",
          name: "DuelBase",
          splashImageUrl: "https://duel-base.vercel.app/splash.png",
          splashBackgroundColor: "#000000"
        }
      }
    })
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <ErudaProvider />
        <meta name="base:app_id" content="696943adeffdef4d6af2c42c" />
      </head>
      <body
        className={`${inter.variable} antialiased`}
      >
        <Providers>
          <WalletIndicator />
          {children}
        </Providers>
      </body>
    </html>
  );
}
