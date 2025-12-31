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
  displayRank?: number
}

interface Position {
  market: string
  slug: string
  side: 'YES' | 'NO'
  size: number
  avgPrice: number
  pnl: number
}

const formatMoney = (v: number): string => {
  const abs = Math.abs(v)
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

const shortWallet = (w: string): string => w ? `${w.slice(0, 6)}...${w.slice(-4)}` : ''

export default function Home() {
  const [traders, setTraders] = useState<Trader[]>([])
  const [filteredTraders, setFilteredTraders] = useState<Trader[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState('all')
  const [minPnl, setMinPnl] = useState(0)
  const [minVolume, setMinVolume] = useState(0)
  const [minRoi, setMinRoi] = useState(0)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<keyof Trader>('pnl')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [selectedTrader, setSelectedTrader] = useState<Trader | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [positionFilter, setPositionFilter] = useState<'all' | 'YES' | 'NO'>('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leaderboard?window=${period}&limit=200`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTraders(data)
    } catch (e: any) {
      setError(e.message)
      setTraders([])
    }
    setLoading(false)
  }, [period])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    let filtered = traders.filter(t => {
      if (t.pnl < minPnl) return false
      if (t.volume < minVolume) return false
      if (t.roi < minRoi) return false
      if (search && !t.username.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

    filtered.sort((a, b) => {
      const va = a[sortField] as number
      const vb = b[sortField] as number
      return sortDir === 'asc' ? va - vb : vb - va
    })

    setFilteredTraders(filtered.map((t, i) => ({ ...t, displayRank: i + 1 })))
  }, [traders, minPnl, minVolume, minRoi, search, sortField, sortDir])

  const openProfile = async (trader: Trader) => {
    setSelectedTrader(trader)
    setPositionsLoading(true)
    setPositionFilter('all')
    
    try {
      const res = await fetch(`/api/positions?wallet=${trader.wallet}`)
      if (res.ok) {
        const data = await res.json()
        setPositions(data.error ? [] : data)
      } else {
        setPositions([])
      }
    } catch (e) {
      setPositions([])
    }
    setPositionsLoading(false)
  }

  const closeModal = () => setSelectedTrader(null)

  const handleSort = (field: keyof Trader) => {
    if (sortField === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const stats = {
    total: filteredTraders.length,
    topPnl: filteredTraders.length > 0 ? Math.max(...filteredTraders.map(t => t.pnl)) : 0,
    totalVolume: filteredTraders.reduce((s, t) => s + t.volume, 0),
    avgRoi: filteredTraders.slice(0, 10).reduce((s, t) => s + t.roi, 0) / Math.min(10, filteredTraders.length) || 0
  }

  const filteredPositions = positions.filter(p => positionFilter === 'all' || p.side === positionFilter)

  const RankBadge = ({ rank }: { rank: number }) => {
    if (rank === 1) return <div className="rank-badge rank-1">👑</div>
    if (rank === 2) return <div className="rank-badge rank-2">🥈</div>
    if (rank === 3) return <div className="rank-badge rank-3">🥉</div>
    return <div className="rank-badge rank-other">{rank}</div>
  }

  return (
    <>
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/30 text-2xl">🏆</div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-[#05050a] flex items-center justify-center text-[10px]">✓</div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">Polymarket Leaderboard</h1>
                <p className="text-gray-400 text-sm">Top 200 Traders <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full ml-2">v2.0</span></p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <a href="https://polymarket.com" target="_blank" rel="noopener" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all text-sm">🔗 Polymarket</a>
              <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-green-500/10 border border-green-500/30">
                <div className="live-dot"></div>
                <span className="text-green-400 font-semibold text-sm">LIVE DATA</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          <div className="glass-card glass-card-hover stat-card stat-card-1 rounded-2xl p-6 animate-in delay-1">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30 text-xl">👥</div>
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-lg">Total</span>
              </div>
              <div className="text-4xl font-bold mb-1">{stats.total}</div>
              <div className="text-gray-400 text-sm">Top Traders</div>
            </div>
          </div>
          <div className="glass-card glass-card-hover stat-card stat-card-2 rounded-2xl p-6 animate-in delay-2">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-xl">💰</div>
                <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">Top</span>
              </div>
              <div className="text-4xl font-bold text-emerald-400 mb-1">{formatMoney(stats.topPnl)}</div>
              <div className="text-gray-400 text-sm">Top PnL</div>
            </div>
          </div>
          <div className="glass-card glass-card-hover stat-card stat-card-3 rounded-2xl p-6 animate-in delay-3">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30 text-xl">📊</div>
                <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-lg">All Time</span>
              </div>
              <div className="text-4xl font-bold mb-1">{formatMoney(stats.totalVolume)}</div>
              <div className="text-gray-400 text-sm">Total Volume</div>
            </div>
          </div>
          <div className="glass-card glass-card-hover stat-card stat-card-4 rounded-2xl p-6 animate-in delay-4">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 text-xl">📈</div>
                <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">Top 10</span>
              </div>
              <div className="text-4xl font-bold text-amber-400 mb-1">{stats.avgRoi.toFixed(1)}%</div>
              <div className="text-gray-400 text-sm">Avg ROI</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-3xl p-8 mb-10 animate-in delay-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-violet-500/30 text-lg">🎯</div>
            <div>
              <h3 className="font-bold text-lg">Filters</h3>
              <p className="text-gray-500 text-sm">กรองข้อมูล Traders</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
            <div>
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Period</label>
              <select value={period} onChange={e => setPeriod(e.target.value)} className="w-full px-4 py-3.5 filter-select rounded-xl text-white">
                <option value="all">All Time</option>
                <option value="monthly">This Month</option>
                <option value="weekly">This Week</option>
                <option value="daily">Today</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Min PnL</label>
              <select value={minPnl} onChange={e => setMinPnl(Number(e.target.value))} className="w-full px-4 py-3.5 filter-select rounded-xl text-white">
                <option value="0">All</option>
                <option value="10000">$10K+</option>
                <option value="50000">$50K+</option>
                <option value="100000">$100K+</option>
                <option value="500000">$500K+</option>
                <option value="1000000">$1M+</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Min Volume</label>
              <select value={minVolume} onChange={e => setMinVolume(Number(e.target.value))} className="w-full px-4 py-3.5 filter-select rounded-xl text-white">
                <option value="0">All</option>
                <option value="100000">$100K+</option>
                <option value="500000">$500K+</option>
                <option value="1000000">$1M+</option>
                <option value="5000000">$5M+</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Min ROI</label>
              <select value={minRoi} onChange={e => setMinRoi(Number(e.target.value))} className="w-full px-4 py-3.5 filter-select rounded-xl text-white">
                <option value="0">All</option>
                <option value="5">5%+</option>
                <option value="10">10%+</option>
                <option value="15">15%+</option>
                <option value="20">20%+</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">Search</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search trader name..." className="w-full pl-12 pr-4 py-3.5 filter-select rounded-xl text-white placeholder-gray-500" />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
            <p className="text-gray-500 text-sm">Showing <span className="text-white font-semibold">{filteredTraders.length}</span> traders</p>
            <button onClick={loadData} disabled={loading} className="btn-primary flex items-center gap-3 px-8 py-3.5 rounded-xl font-semibold text-white shadow-lg shadow-purple-500/25 disabled:opacity-50">
              {loading ? '⏳' : '🔄'} {loading ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="glass-card rounded-2xl p-6 mb-10 border-red-500/30 bg-red-500/10">
            <p className="text-red-400">❌ Error: {error}</p>
            <button onClick={loadData} className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">Retry</button>
          </div>
        )}

        {/* Table */}
        <div className="glass-card rounded-3xl overflow-hidden animate-in delay-4">
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30 text-2xl">🏆</div>
              <div>
                <h2 className="text-xl font-bold">Top 200 Traders</h2>
                <p className="text-gray-500 text-sm">Click to view positions</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Updated just now
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Trader</th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-purple-400 transition-colors" onClick={() => handleSort('pnl')}>
                    PnL {sortField === 'pnl' && <span className="text-purple-400">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-purple-400 transition-colors" onClick={() => handleSort('volume')}>
                    Volume {sortField === 'volume' && <span className="text-purple-400">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-purple-400 transition-colors" onClick={() => handleSort('positions')}>
                    Positions {sortField === 'positions' && <span className="text-purple-400">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-purple-400 transition-colors" onClick={() => handleSort('roi')}>
                    ROI {sortField === 'roi' && <span className="text-purple-400">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                  </th>
                  <th className="px-6 py-5 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-20 text-center text-gray-400">⏳ Loading traders...</td></tr>
                ) : filteredTraders.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-20 text-center text-gray-400">No traders found</td></tr>
                ) : filteredTraders.map(t => (
                  <tr key={t.wallet} className="table-row" onClick={() => openProfile(t)}>
                    <td className="px-6 py-5"><RankBadge rank={t.displayRank || t.rank} /></td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-lg flex items-center gap-2">
                        {t.username}
                        {t.verified && <span className="verified-badge">✓</span>}
                      </div>
                      <div className="text-gray-500 text-sm font-mono">{shortWallet(t.wallet)}</div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`font-bold text-xl ${t.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                        {t.pnl >= 0 ? '+' : ''}{formatMoney(t.pnl)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-gray-300 font-medium">{formatMoney(t.volume)}</td>
                    <td className="px-6 py-5 text-gray-300 font-medium">{t.positions}</td>
                    <td className="px-6 py-5">
                      <span className={`font-bold text-lg ${t.roi >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>{t.roi.toFixed(1)}%</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button className="px-5 py-2.5 bg-purple-500/15 border border-purple-500/30 text-purple-400 rounded-xl text-sm font-semibold hover:bg-purple-500/25 transition-all">View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-gray-400 text-sm">Data from <a href="https://polymarket.com" target="_blank" className="text-purple-400 hover:text-purple-300">Polymarket</a></p>
            <p className="text-gray-600 text-sm">⚠️ Trading involves risk. Do your own research.</p>
          </div>
        </div>
      </footer>

      {/* Modal */}
      {selectedTrader && (
        <div className="fixed inset-0 modal-backdrop z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto" onClick={closeModal}>
          <div className="modal-card rounded-3xl w-full max-w-4xl my-10 animate-in" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b border-white/5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-xl shadow-purple-500/30 text-4xl">👤</div>
                  <div>
                    <h3 className="text-3xl font-bold mb-1 flex items-center gap-2">
                      {selectedTrader.username}
                      {selectedTrader.verified && <span className="verified-badge text-xs">✓ Verified</span>}
                    </h3>
                    <p className="text-gray-500 font-mono text-sm mb-3">{shortWallet(selectedTrader.wallet)}</p>
                    <div className="flex gap-3">
                      <a href={`https://polymarket.com/profile/${selectedTrader.wallet}`} target="_blank" rel="noopener" className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-400 hover:bg-purple-500/20 text-sm font-medium">🔮 Polymarket</a>
                      <a href={`https://polygonscan.com/address/${selectedTrader.wallet}`} target="_blank" rel="noopener" className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-400 hover:bg-blue-500/20 text-sm font-medium">📊 Polygonscan</a>
                    </div>
                  </div>
                </div>
                <button onClick={closeModal} className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 text-xl text-gray-400 hover:text-white">✕</button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6 p-8 border-b border-white/5 bg-white/[0.02]">
              <div className="text-center">
                <div className={`text-3xl font-bold mb-1 ${selectedTrader.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>{selectedTrader.pnl >= 0 ? '+' : ''}{formatMoney(selectedTrader.pnl)}</div>
                <div className="text-gray-500 text-sm">Total PnL</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">{formatMoney(selectedTrader.volume)}</div>
                <div className="text-gray-500 text-sm">Volume</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold mb-1">{selectedTrader.positions}</div>
                <div className="text-gray-500 text-sm">Positions</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold mb-1 ${selectedTrader.roi >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>{selectedTrader.roi.toFixed(1)}%</div>
                <div className="text-gray-500 text-sm">ROI</div>
              </div>
            </div>

            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📋</span>
                  <h4 className="text-lg font-bold">Positions</h4>
                  <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg">กดเพื่อไป Polymarket</span>
                </div>
                <div className="flex gap-2">
                  {(['all', 'YES', 'NO'] as const).map(f => (
                    <button key={f} onClick={() => setPositionFilter(f)} className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${positionFilter === f ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                      {f === 'all' ? 'All' : f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {positionsLoading ? (
                  <div className="py-12 text-center text-gray-400">⏳ Loading positions...</div>
                ) : filteredPositions.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">No positions found</div>
                ) : filteredPositions.map((p, i) => (
                  <a key={i} href={`https://polymarket.com/event/${p.slug}`} target="_blank" rel="noopener" className={`position-card block p-5 rounded-2xl border border-white/5 ${p.side === 'YES' ? 'position-yes' : 'position-no'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-semibold text-lg mb-1 flex items-center gap-2">
                          {p.market}
                          <span className="external-icon text-purple-400">↗</span>
                        </p>
                        <p className="text-gray-500 text-sm">Avg Price: {p.avgPrice}¢</p>
                      </div>
                      <div className={`px-4 py-2 rounded-xl text-sm font-bold ${p.side === 'YES' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>{p.side}</div>
                      <div className="text-right ml-6 min-w-[100px]">
                        <p className="font-bold text-lg">${p.size.toLocaleString()}</p>
                        <p className={`text-sm font-semibold ${p.pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>{p.pnl >= 0 ? '+' : ''}{formatMoney(p.pnl)}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
