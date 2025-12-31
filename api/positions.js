module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const wallet = req.query.wallet;
  
  if (!wallet) {
    return res.status(400).json({ success: false, error: 'wallet parameter required' });
  }

  const url = `https://data-api.polymarket.com/positions?user=${wallet}&sizeThreshold=0.1`;

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

    const positions = (Array.isArray(data) ? data : []).map(p => ({
      market: p.title || p.question || 'Unknown Market',
      slug: p.slug || p.conditionId || '',
      side: p.outcome === 'Yes' || p.side === 'long' ? 'YES' : 'NO',
      size: parseFloat(p.size) || parseFloat(p.currentValue) || 0,
      avgPrice: Math.round((parseFloat(p.avgPrice) || 0.5) * 100),
      pnl: parseFloat(p.pnl) || 0,
    }));

    positions.sort((a, b) => b.size - a.size);

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({ success: true, data: positions });

  } catch (error) {
    console.error('Positions error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};
