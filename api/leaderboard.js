module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const window = req.query.window || 'all';
  const limit = req.query.limit || '200';
  
  const url = `https://data-api.polymarket.com/leaderboard?window=${window}&limit=${limit}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('No data received');
    }

    const traders = data.map((t, i) => ({
      rank: t.rank || i + 1,
      wallet: t.proxyWallet || t.address || '',
      username: t.userName || t.name || `Trader_${i + 1}`,
      pnl: parseFloat(t.pnl) || 0,
      volume: parseFloat(t.volume) || 0,
      positions: parseInt(t.positions) || parseInt(t.numTrades) || 0,
      verified: t.verifiedBadge || false,
      roi: parseFloat(t.volume) > 0 ? Math.round((parseFloat(t.pnl) / parseFloat(t.volume)) * 10000) / 100 : 0,
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ success: true, data: traders });

  } catch (error) {
    console.error('Leaderboard error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
