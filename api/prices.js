module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { market, interval = '1d' } = req.query;

  if (!market) {
    return res.status(400).json({ success: false, error: 'market (conditionId) required' });
  }

  // Map interval to API parameters
  const intervalMap = {
    '1h': { interval: '1h', fidelity: 1 },      // 1 min intervals
    '6h': { interval: '6h', fidelity: 5 },      // 5 min intervals
    '1d': { interval: '1d', fidelity: 15 },     // 15 min intervals
    '1w': { interval: '1w', fidelity: 60 },     // 1 hour intervals
    'max': { interval: 'max', fidelity: 360 },  // 6 hour intervals
  };
  
  const params = intervalMap[interval] || intervalMap['1d'];

  try {
    // First, get the token IDs for this market from gamma API
    const gammaUrl = `https://gamma-api.polymarket.com/markets?condition_id=${encodeURIComponent(market)}`;
    const gammaRes = await fetch(gammaUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });

    if (!gammaRes.ok) throw new Error(`Gamma API error: ${gammaRes.status}`);
    const gammaData = await gammaRes.json();

    if (!gammaData || !gammaData.length) {
      return res.status(404).json({ success: false, error: 'Market not found' });
    }

    const marketData = gammaData[0];
    const clobTokenIds = marketData.clobTokenIds || [];
    
    if (!clobTokenIds.length) {
      return res.status(404).json({ success: false, error: 'No token IDs found' });
    }

    // Get price history for YES token (first token)
    const yesTokenId = clobTokenIds[0];
    
    // Try CLOB API for price history
    const priceUrl = `https://clob.polymarket.com/prices-history?market=${yesTokenId}&interval=${params.interval}&fidelity=${params.fidelity}`;
    const priceRes = await fetch(priceUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });

    let priceHistory = [];
    
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      if (priceData && priceData.history && Array.isArray(priceData.history)) {
        priceHistory = priceData.history.map(p => ({
          timestamp: p.t * 1000, // Convert to milliseconds
          price: parseFloat(p.p) * 100, // Convert to percentage
        }));
      }
    }

    // Sort by timestamp
    priceHistory.sort((a, b) => a.timestamp - b.timestamp);

    // Get current price
    const currentPrice = marketData.outcomePrices ? 
      parseFloat(JSON.parse(marketData.outcomePrices)[0]) * 100 : 
      (priceHistory.length ? priceHistory[priceHistory.length - 1].price : 50);

    // Calculate stats
    const firstPrice = priceHistory.length ? priceHistory[0].price : currentPrice;
    const lastPrice = priceHistory.length ? priceHistory[priceHistory.length - 1].price : currentPrice;
    const change = lastPrice - firstPrice;
    const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;

    // Find high/low
    const high = priceHistory.length ? Math.max(...priceHistory.map(p => p.price)) : currentPrice;
    const low = priceHistory.length ? Math.min(...priceHistory.map(p => p.price)) : currentPrice;

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({
      success: true,
      market,
      tokenId: yesTokenId,
      outcome: marketData.outcome || 'YES',
      currentPrice: Math.round(currentPrice * 10) / 10,
      interval,
      stats: {
        change: Math.round(change * 10) / 10,
        changePercent: Math.round(changePercent * 10) / 10,
        high: Math.round(high * 10) / 10,
        low: Math.round(low * 10) / 10,
        dataPoints: priceHistory.length,
      },
      history: priceHistory.slice(-100), // Last 100 data points
    });

  } catch (error) {
    console.error('Prices API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
