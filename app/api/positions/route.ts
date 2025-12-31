import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet')

  if (!wallet) {
    return NextResponse.json({ success: false, error: 'wallet required' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(
      `https://data-api.polymarket.com/positions?user=${wallet}&sizeThreshold=0.1`,
      {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; PolyLeaderboard/1.0)',
        },
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`)
    }

    const data = await response.json()

    const positions = (Array.isArray(data) ? data : []).map((p: any) => ({
      market: p.title || p.question || 'Unknown Market',
      slug: p.slug || p.conditionId || '',
      side: p.outcome === 'Yes' || p.side === 'long' ? 'YES' : 'NO',
      size: parseFloat(p.size) || parseFloat(p.currentValue) || 0,
      avgPrice: Math.round((parseFloat(p.avgPrice) || 0.5) * 100),
      pnl: parseFloat(p.pnl) || 0,
    }))

    positions.sort((a: any, b: any) => b.size - a.size)

    return NextResponse.json({ success: true, data: positions })
  } catch (error: any) {
    console.error('Positions API error:', error.message)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch' },
      { status: 500 }
    )
  }
}
