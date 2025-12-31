import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const API_URL = 'https://data-api.polymarket.com/leaderboard'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const window = searchParams.get('window') || 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)

  const url = `${API_URL}?window=${window}&limit=${limit}`
  
  try {
    console.log(`[Leaderboard] Fetching: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      // Vercel Edge: no timeout needed, has built-in
    })

    console.log(`[Leaderboard] Status: ${response.status}`)

    if (!response.ok) {
      const text = await response.text()
      console.error(`[Leaderboard] Error response: ${text}`)
      throw new Error(`API ${response.status}: ${text.slice(0, 100)}`)
    }

    const data = await response.json()
    console.log(`[Leaderboard] Received ${Array.isArray(data) ? data.length : 0} items`)

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Empty or invalid data')
    }

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
        roi: volume > 0 ? Math.round((pnl / volume) * 10000) / 100 : 0,
      }
    })

    return NextResponse.json({ 
      success: true, 
      source: 'polymarket-api',
      data: traders 
    })
  } catch (error: any) {
    console.error(`[Leaderboard] Error: ${error.message}`)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch',
      url: url,
    }, { status: 500 })
  }
}
