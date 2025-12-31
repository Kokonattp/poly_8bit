import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const revalidate = 30

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const wallet = searchParams.get('wallet')

  if (!wallet) {
    return NextResponse.json(
      { error: 'wallet parameter required' },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(
      `https://data-api.polymarket.com/positions?user=${wallet}&sizeThreshold=1`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 30 }
      }
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()

    const positions = data.map((p: any) => ({
      market: p.title || p.question || 'Unknown Market',
      slug: p.slug || p.conditionId || '',
      side: p.outcome === 'Yes' || p.side === 'long' ? 'YES' : 'NO',
      size: parseFloat(p.size) || parseFloat(p.currentValue) || 0,
      avgPrice: Math.round((parseFloat(p.avgPrice) || 0.5) * 100),
      curPrice: Math.round((parseFloat(p.curPrice) || 0.5) * 100),
      pnl: parseFloat(p.pnl) || 0
    }))

    positions.sort((a: any, b: any) => b.size - a.size)

    return NextResponse.json(positions, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Positions API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    )
  }
}
