// api/leaderboard.js
// Vercel Serverless Function - Polymarket Leaderboard Proxy

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const window = req.query.window || 'all';
  const limit = Math.min(parseInt(req.query.limit) || 200, 500);
  
  const url = `https://data-api.polymarket.com/leaderboard?window=${window}&limit=${limit}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Polymarket API error:', response.status, text);
      return res.status(response.status).json({ 
        success: false, 
        error: `API Error: ${response.status}` 
      });
    }

    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(500).json({ 
        success: false, 
        error: 'No data received' 
      });
    }

    // Transform data
    const traders = data.map((t, i) => {
      const pnl = parseFloat(t.pnl) || 0;
      const volume = parseFloat(t.volume) || 0;
      
      return {
        rank: t.rank || i + 1,
        wallet: t.proxyWallet || t.address || '',
        username: t.userName || t.name || `Trader_${i + 1}`,
        pnl,
        volume,
        positions: parseInt(t.positions) || parseInt(t.numTrades) || 0,
        verified: t.verifiedBadge || false,
        roi: volume > 0 ? Math.round((pnl / volume) * 10000) / 100 : 0,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ success: true, data: traders });
    
  } catch (error) {
    console.error('Fetch error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
