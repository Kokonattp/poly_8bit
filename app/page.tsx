'use client'

import { useState, useEffect, useCallback } from 'react'

interface Trader {
  rank: number
  wallet: string
  username: string
  pnl: number
  volume: number
  positions: number
  verified: boolean
  roi: number
}

interface Position {
  market: string
  slug: string
  side: 'YES' | 'NO'
  size: number
  avgPrice: number
  pnl: number
}

// Fallback demo data
const DEMO_TRADERS: Trader[] = Array.from({ length: 100 }, (_, i) => ({
  rank: i + 1,
  wallet: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
  username: ['Theo', 'Fredi9999', 'Domer', 'PredictPro', 'CryptoWhale', 'SmartMoney', 'ElectionGuru', 'PolyKing', 'DataDriven', 'SharpBettor'][i % 10] + (i >= 10 ? `_${Math.floor(i / 10)}` : ''),
  pnl: Math.round(8500000 * Math.pow(0.92, i) * (0.8 + Math.random() * 0.4)),
  volume: Math.round(25000000 * Math.pow(0.93, i) * (0.7 + Math.random() * 0.6)),
  positions: Math.floor(20 + Math.random() * 200),
  verified: Math.random() > 0.6,
  roi: Math.round((15 + Math.random() * 10) * 100) / 100,
}))

const DEMO_POSITIONS: Position[] = [
  { market: 'Will Bitcoin exceed $150k in 2025?', slug: 'bitcoin-150k-2025', side: 'YES', size: 25000, avgPrice: 42, pnl: 4200 },
  { market: 'Will Trump win 2028 election?', slug: 'trump-2028', side: 'YES', size: 18500, avgPrice: 35, pnl: 3100 },
  { market: 'Will ETH flip BTC market cap?', slug: 'eth-flip-btc', side: 'NO', size: 18000, avgPrice: 85, pnl: 2100 },
  { market: 'Fed rate cut Q1 2025?', slug: 'fed-rate-cut-q1', side: 'YES', size: 12500, avgPrice: 65, pnl: -1800 },
  { market: 'SpaceX IPO in 2025?', slug: 'spacex-ipo-2025', side: 'NO', size: 15000, avgPrice: 88, pnl: 1500 },
]

const formatMoney = (v: number) => {
  const abs = Math.abs(v)
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

const formatPnl = (v: number) => `${v >= 0 ? '+' : ''}${formatMoney(v)}`

export default function Home() {
  const [traders, setTraders] = useState<Trader[]>([])
  const [filtered, setFiltered] = useState<Trader[]>([])
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  const [period, setPeriod] = useState('all')
  const [minPnl, setMinPnl] = useState(0)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<keyof Trader>('pnl')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [selectedTrader, setSelectedTrader] = useState<Trader | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [posLoading, setPosLoading] = useState(false)
  const [posFilter, setPosFilter] = useState<'all' | 'YES' | 'NO'>('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leaderboard?window=${period}&limit=200`)
      const json = await res.json()
      if (json.success && json.data?.length > 0) {
        setTraders(json.data)
        setIsLive(true)
      } else {
        throw new Error('No data')
      }
    } catch {
      setTraders(DEMO_TRADERS)
      setIsLive(false)
    }
    setLoading(false)
  }, [period])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    let result = traders.filter(t => {
      if (t.pnl < minPnl) return false
      if (search && !t.username.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    result.sort((a, b) => {
      const va = a[sortField] as number
      const vb = b[sortField] as number
      return sortDir === 'desc' ? vb - va : va - vb
    })
    setFiltered(result)
  }, [traders, minPnl, search, sortField, sortDir])

  const openProfile = async (t: Trader) => {
    setSelectedTrader(t)
    setPosLoading(true)
    setPosFilter('all')
    try {
      const res = await fetch(`/api/positions?wallet=${t.wallet}`)
      const json = await res.json()
      setPositions(json.success && json.data?.length > 0 ? json.data : DEMO_POSITIONS)
    } catch {
      setPositions(DEMO_POSITIONS)
    }
    setPosLoading(false)
  }

  const handleSort = (field: keyof Trader) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortField(field); setSortDir('desc') }
  }

  const stats = {
    total: filtered.length,
    topPnl: filtered[0]?.pnl || 0,
    totalVol: filtered.reduce((s, t) => s + t.volume, 0),
    avgRoi: filtered.slice(0, 10).reduce((s, t) => s + t.roi, 0) / Math.min(10, filtered.length) || 0,
  }

  const filteredPos = positions.filter(p => posFilter === 'all' || p.side === posFilter)

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] bg-[#0d0d0d] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-lg">P</div>
            <div>
              <h1 className="font-semibold text-lg">Polymarket Leaderboard</h1>
              <p className="text-xs text-[#666]">Top 200 Traders</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://polymarket.com" target="_blank" className="btn btn-secondary text-sm hidden sm:block">
              Open Polymarket ↗
            </a>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isLive ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`}></div>
              {isLive ? 'Live' : 'Demo'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="stat-card">
            <p className="text-[#666] text-sm mb-1">Total Traders</p>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="stat-card">
            <p className="text-[#666] text-sm mb-1">Top PnL</p>
            <p className="text-2xl font-semibold text-profit">{formatMoney(stats.topPnl)}</p>
          </div>
          <div className="stat-card">
            <p className="text-[#666] text-sm mb-1">Total Volume</p>
            <p className="text-2xl font-semibold">{formatMoney(stats.totalVol)}</p>
          </div>
          <div className="stat-card">
            <p className="text-[#666] text-sm mb-1">Avg ROI (Top 10)</p>
            <p className="text-2xl font-semibold text-profit">{stats.avgRoi.toFixed(1)}%</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-[#666] mb-1 block">Period</label>
              <select value={period} onChange={e => setPeriod(e.target.value)} className="select w-full">
                <option value="all">All Time</option>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-[#666] mb-1 block">Min PnL</label>
              <select value={minPnl} onChange={e => setMinPnl(Number(e.target.value))} className="select w-full">
                <option value="0">All</option>
                <option value="10000">$10K+</option>
                <option value="50000">$50K+</option>
                <option value="100000">$100K+</option>
                <option value="500000">$500K+</option>
              </select>
            </div>
            <div className="flex-[2] min-w-[200px]">
              <label className="text-xs text-[#666] mb-1 block">Search</label>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trader..." className="input w-full" />
            </div>
            <button onClick={loadData} disabled={loading} className="btn btn-primary flex items-center gap-2">
              {loading ? <span className="loading"></span> : '↻'} Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="table-header text-left text-xs text-[#666] uppercase">
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Trader</th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('pnl')}>
                    PnL {sortField === 'pnl' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('volume')}>
                    Volume {sortField === 'volume' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('positions')}>
                    Trades {sortField === 'positions' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 font-medium cursor-pointer hover:text-white" onClick={() => handleSort('roi')}>
                    ROI {sortField === 'roi' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-16 text-center text-[#666]"><span className="loading mr-2"></span> Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-16 text-center text-[#666]">No traders found</td></tr>
                ) : filtered.map((t, i) => (
                  <tr key={t.wallet + i} className="table-row cursor-pointer" onClick={() => openProfile(t)}>
                    <td className="px-4 py-3">
                      {t.rank <= 3 ? (
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${t.rank === 1 ? 'rank-1' : t.rank === 2 ? 'rank-2' : 'rank-3'}`}>
                          {t.rank}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-[#666] text-sm font-medium">{t.rank}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.username}</span>
                        {t.verified && <span className="verified">✓</span>}
                      </div>
                      <span className="text-xs text-[#666] font-mono">{t.wallet.slice(0, 8)}...</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatPnl(t.pnl)}</span>
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0]">{formatMoney(t.volume)}</td>
                    <td className="px-4 py-3 text-[#a0a0a0]">{t.positions}</td>
                    <td className="px-4 py-3">
                      <span className={t.roi >= 0 ? 'text-profit' : 'text-loss'}>{t.roi.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="btn btn-secondary text-xs py-2">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 py-6 border-t border-[#2a2a2a] text-center">
          <p className="text-[#666] text-sm">
            Data from <a href="https://polymarket.com" target="_blank" className="text-blue-400 hover:underline">Polymarket</a> · 
            Trading involves risk · Not financial advice
          </p>
        </div>
      </main>

      {/* Modal */}
      {selectedTrader && (
        <div className="fixed inset-0 modal-overlay z-50 flex items-start justify-center p-4 pt-[10vh] overflow-y-auto" onClick={() => setSelectedTrader(null)}>
          <div className="modal-content w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-[#2a2a2a] flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold">{selectedTrader.username}</h2>
                  {selectedTrader.verified && <span className="verified">✓</span>}
                </div>
                <p className="text-sm text-[#666] font-mono">{selectedTrader.wallet}</p>
                <div className="flex gap-2 mt-3">
                  <a href={`https://polymarket.com/profile/${selectedTrader.wallet}`} target="_blank" className="btn btn-secondary text-xs py-2">
                    Polymarket ↗
                  </a>
                  <a href={`https://polygonscan.com/address/${selectedTrader.wallet}`} target="_blank" className="btn btn-secondary text-xs py-2">
                    Polygonscan ↗
                  </a>
                </div>
              </div>
              <button onClick={() => setSelectedTrader(null)} className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center hover:bg-[#252525] text-[#666] hover:text-white">✕</button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 p-6 border-b border-[#2a2a2a] bg-[#141414]">
              <div className="text-center">
                <p className={`text-xl font-semibold ${selectedTrader.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatPnl(selectedTrader.pnl)}</p>
                <p className="text-xs text-[#666]">Total PnL</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold">{formatMoney(selectedTrader.volume)}</p>
                <p className="text-xs text-[#666]">Volume</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold">{selectedTrader.positions}</p>
                <p className="text-xs text-[#666]">Trades</p>
              </div>
              <div className="text-center">
                <p className={`text-xl font-semibold ${selectedTrader.roi >= 0 ? 'text-profit' : 'text-loss'}`}>{selectedTrader.roi.toFixed(1)}%</p>
                <p className="text-xs text-[#666]">ROI</p>
              </div>
            </div>

            {/* Positions */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Open Positions</h3>
                <div className="flex gap-1">
                  {(['all', 'YES', 'NO'] as const).map(f => (
                    <button key={f} onClick={() => setPosFilter(f)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${posFilter === f ? 'bg-blue-500 text-white' : 'bg-[#1a1a1a] text-[#666] hover:text-white'}`}>
                      {f === 'all' ? 'All' : f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {posLoading ? (
                  <div className="py-8 text-center text-[#666]"><span className="loading mr-2"></span> Loading...</div>
                ) : filteredPos.length === 0 ? (
                  <div className="py-8 text-center text-[#666]">No positions</div>
                ) : filteredPos.map((p, i) => (
                  <a key={i} href={`https://polymarket.com/event/${p.slug}`} target="_blank" className={`position-card block p-4 ${p.side === 'YES' ? 'position-yes' : 'position-no'}`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{p.market}</p>
                        <p className="text-xs text-[#666]">Avg: {p.avgPrice}¢</p>
                      </div>
                      <span className={`badge ${p.side === 'YES' ? 'badge-green' : 'badge-red'}`}>{p.side}</span>
                      <div className="text-right min-w-[80px]">
                        <p className="font-medium">${p.size.toLocaleString()}</p>
                        <p className={`text-xs ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatPnl(p.pnl)}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
