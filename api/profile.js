module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const wallet = req.query.wallet || req.query.user;
  if (!wallet) return res.status(400).json({ success: false, error: 'wallet required' });

  try {
    // Fetch all data in parallel
    const [positionsRes, activityRes, valueRes] = await Promise.all([
      fetch(`https://data-api.polymarket.com/positions?user=${encodeURIComponent(wallet)}&sizeThreshold=0.1&limit=100`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      }),
      fetch(`https://data-api.polymarket.com/activity?user=${encodeURIComponent(wallet)}&limit=100`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      }),
      fetch(`https://data-api.polymarket.com/value?user=${encodeURIComponent(wallet)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      }),
    ]);

    let positions = [];
    let activity = [];
    let portfolioValue = 0;

    // Parse positions
    if (positionsRes.ok) {
      const posData = await positionsRes.json();
      if (Array.isArray(posData)) {
        positions = posData.map(p => ({
          market: p.title || p.question || 'Unknown',
          slug: p.eventSlug || p.slug || '',
          outcome: p.outcome || (p.outcomeIndex === 0 ? 'Yes' : 'No'),
          size: parseFloat(p.size) || 0,
          avgPrice: parseFloat(p.avgPrice) || 0,
          currentPrice: parseFloat(p.curPrice) || 0,
          initialValue: parseFloat(p.initialValue) || 0,
          currentValue: parseFloat(p.currentValue) || 0,
          pnl: parseFloat(p.cashPnl) || 0,
          pnlPercent: parseFloat(p.percentPnl) || 0,
          realizedPnl: parseFloat(p.realizedPnl) || 0,
          image: p.icon || '',
        }));
      }
    }

    // Parse activity
    if (activityRes.ok) {
      const actData = await activityRes.json();
      if (Array.isArray(actData)) {
        activity = actData.map(a => ({
          type: a.type || 'TRADE',
          market: a.title || 'Unknown',
          slug: a.slug || '',
          side: a.side || '',
          outcome: a.outcome || '',
          size: parseFloat(a.size) || 0,
          price: parseFloat(a.price) || 0,
          usdcSize: parseFloat(a.usdcSize) || 0,
          timestamp: a.timestamp || 0,
          date: a.timestamp ? new Date(a.timestamp * 1000).toISOString() : '',
        }));
      }
    }

    // Parse portfolio value
    if (valueRes.ok) {
      const valData = await valueRes.json();
      if (Array.isArray(valData) && valData.length > 0) {
        portfolioValue = parseFloat(valData[0].value) || 0;
      }
    }

    // Calculate stats
    const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
    const totalInvested = positions.reduce((s, p) => s + p.initialValue, 0);
    const totalVolume = activity.filter(a => a.type === 'TRADE').reduce((s, a) => s + a.usdcSize, 0);
    const winningPositions = positions.filter(p => p.pnl > 0).length;
    const losingPositions = positions.filter(p => p.pnl < 0).length;
    const winRate = positions.length > 0 ? Math.round((winningPositions / positions.length) * 100) : 0;
    const roi = totalInvested > 0 ? Math.round((totalPnl / totalInvested) * 10000) / 100 : 0;

    // Unique markets count
    const uniqueMarkets = new Set(positions.map(p => p.slug)).size;

    // Sort positions by current value
    positions.sort((a, b) => b.currentValue - a.currentValue);

    // PnL by day for chart (last 30 days from activity)
    const pnlHistory = [];
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = 29; i >= 0; i--) {
      const dayStart = now - (i * dayMs);
      const dayEnd = dayStart + dayMs;
      const dayActivity = activity.filter(a => {
        const ts = a.timestamp * 1000;
        return ts >= dayStart && ts < dayEnd;
      });
      const dayPnl = dayActivity.reduce((s, a) => {
        // Simplified: assume buy = negative, sell = positive
        if (a.side === 'BUY') return s - a.usdcSize;
        if (a.side === 'SELL') return s + a.usdcSize;
        return s;
      }, 0);
      pnlHistory.push({
        date: new Date(dayStart).toISOString().split('T')[0],
        pnl: dayPnl,
      });
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({
      success: true,
      data: {
        wallet,
        stats: {
          portfolioValue,
          totalPnl,
          totalInvested,
          totalVolume,
          positionsCount: positions.length,
          marketsCount: uniqueMarkets,
          tradesCount: activity.filter(a => a.type === 'TRADE').length,
          winRate,
          roi,
          winningPositions,
          losingPositions,
        },
        positions: positions.slice(0, 50),
        recentActivity: activity.slice(0, 30),
        pnlHistory,
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
