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
  // interval: string like 'max', '1d', '1w'  
  // fidelity: minutes between data points
  const intervalConfig = {
    '1h': { interval: '1h', fidelity: 1 },
    '6h': { interval: '6h', fidelity: 5 },
    '1d': { interval: '1d', fidelity: 30 },
    '1w': { interval: '1w', fidelity: 120 },
    'max': { interval: 'max', fidelity: 720 },
  };
  
  const config = intervalConfig[interval] || intervalConfig['1d'];

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
    
    // Get current price from market data
    let currentPrice = 50;
    if (marketData.outcomePrices) {
      try {
        const prices = JSON.parse(marketData.outcomePrices);
        currentPrice = parseFloat(prices[0]) * 100;
      } catch {}
    }

    let priceHistory = [];
    
    // Try to get price history using correct API format
    if (clobTokenIds.length > 0) {
      const yesTokenId = clobTokenIds[0];
      
      // Correct API: /prices-history?market={token_id}&interval={interval}&fidelity={fidelity}
      try {
        const priceUrl = `https://clob.polymarket.com/prices-history?market=${yesTokenId}&interval=${config.interval}&fidelity=${config.fidelity}`;
        const priceRes = await fetch(priceUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });
        
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          if (priceData && priceData.history && Array.isArray(priceData.history)) {
            priceHistory = priceData.history.map(p => ({
              timestamp: p.t * 1000,
              price: parseFloat(p.p) * 100,
            }));
          }
        }
      } catch (e) {
        console.log('CLOB API error:', e.message);
      }
    }

    // Sort by timestamp
    priceHistory.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate stats
    const firstPrice = priceHistory.length ? priceHistory[0].price : currentPrice;
    const lastPrice = priceHistory.length ? priceHistory[priceHistory.length - 1].price : currentPrice;
    const change = lastPrice - firstPrice;
    const changePercent = firstPrice > 0 ? (change / firstPrice) * 100 : 0;

    // Find high/low
    const high = priceHistory.length ? Math.max(...priceHistory.map(p => p.price)) : currentPrice;
    const low = priceHistory.length ? Math.min(...priceHistory.map(p => p.price)) : currentPrice;

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({
      success: true,
      market,
      tokenId: clobTokenIds[0] || null,
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
      history: priceHistory.slice(-200),
    });

  } catch (error) {
    console.error('Prices API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
