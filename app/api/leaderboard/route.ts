import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const revalidate = 60

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const window = searchParams.get('window') || 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)

  try {
    const response = await fetch(
      `https://data-api.polymarket.com/leaderboard?window=${window}&limit=${limit}`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      }
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    const traders = data.map((t: any, i: number) => {
      const pnl = parseFloat(t.pnl) || 0
      const volume = parseFloat(t.volume) || 0
      
      return {
        rank: t.rank || i + 1,
        wallet: t.proxyWallet || t.address || '',
        username: t.userName || t.name || `Trader_${i + 1}`,
        pnl,
        volume,
        positions: parseInt(t.positions) || parseInt(t.numTrades) || 0,
        verified: t.verifiedBadge || false,
        profileImage: t.profileImage || null,
        roi: volume > 0 ? Math.round((pnl / volume) * 10000) / 100 : 0
      }
    })

    return NextResponse.json(traders, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Leaderboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
