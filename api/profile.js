module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const wallet = req.query.wallet || req.query.user;
  
  if (!wallet) {
    return res.status(400).json({ success: false, error: 'wallet parameter required' });
  }

  try {
    // Fetch positions
    const positionsUrl = `https://data-api.polymarket.com/positions?user=${encodeURIComponent(wallet)}&sizeThreshold=1&limit=100`;
    
    // Fetch activity
    const activityUrl = `https://data-api.polymarket.com/activity?user=${encodeURIComponent(wallet)}&limit=50`;

    // Fetch portfolio value
    const valueUrl = `https://data-api.polymarket.com/value?user=${encodeURIComponent(wallet)}`;

    const [positionsRes, activityRes, valueRes] = await Promise.all([
      fetch(positionsUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }),
      fetch(activityUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }),
      fetch(valueUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }),
    ]);

    let positions = [];
    let activity = [];
    let portfolioValue = 0;
    let totalPnl = 0;
    let totalVolume = 0;

    // Parse positions
    if (positionsRes.ok) {
      const posData = await positionsRes.json();
      if (Array.isArray(posData)) {
        positions = posData.map(p => ({
          market: p.title || p.question || 'Unknown',
          slug: p.slug || p.eventSlug || '',
          eventSlug: p.eventSlug || '',
          outcome: p.outcome || (p.outcomeIndex === 0 ? 'Yes' : 'No'),
          size: parseFloat(p.size) || 0,
          avgPrice: parseFloat(p.avgPrice) || 0,
          currentPrice: parseFloat(p.curPrice) || 0,
          initialValue: parseFloat(p.initialValue) || 0,
          currentValue: parseFloat(p.currentValue) || 0,
          pnl: parseFloat(p.cashPnl) || 0,
          pnlPercent: parseFloat(p.percentPnl) || 0,
          realizedPnl: parseFloat(p.realizedPnl) || 0,
          redeemable: p.redeemable || false,
          image: p.icon || '',
          endDate: p.endDate || '',
        }));
        
        // Calculate totals
        totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
        totalVolume = positions.reduce((sum, p) => sum + p.initialValue, 0);
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
          txHash: a.transactionHash || '',
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

    // Sort positions by current value
    positions.sort((a, b) => b.currentValue - a.currentValue);

    const result = {
      wallet,
      portfolioValue,
      totalPnl,
      totalVolume,
      positionsCount: positions.length,
      tradesCount: activity.filter(a => a.type === 'TRADE').length,
      winRate: positions.length > 0 
        ? Math.round((positions.filter(p => p.pnl > 0).length / positions.length) * 100) 
        : 0,
      avgRoi: totalVolume > 0 ? Math.round((totalPnl / totalVolume) * 10000) / 100 : 0,
      positions: positions.slice(0, 50),
      recentActivity: activity.slice(0, 20),
    };

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({ success: true, data: result });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
