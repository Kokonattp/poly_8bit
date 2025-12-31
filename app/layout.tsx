import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Polymarket Leaderboard | Top 200 Traders',
  description: 'ดู Top 200 Traders บน Polymarket พร้อม PnL, Volume, ROI และ Positions ทั้งหมด',
  keywords: ['polymarket', 'leaderboard', 'prediction market', 'trading', 'crypto'],
  openGraph: {
    title: 'Polymarket Leaderboard',
    description: 'Top 200 Traders on Polymarket',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏆</text></svg>" />
      </head>
      <body className="antialiased text-white">
        <div className="bg-grid" />
        <div className="bg-glow bg-glow-1" />
        <div className="bg-glow bg-glow-2" />
        <div className="bg-glow bg-glow-3" />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
}
