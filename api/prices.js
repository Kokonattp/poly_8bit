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
    '1h': { interval: '1h', fidelity: 1 },
    '6h': { interval: '6h', fidelity: 5 },
    '1d': { interval: '1d', fidelity: 15 },
    '1w': { interval: '1w', fidelity: 60 },
    'max': { interval: 'max', fidelity: 360 },
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
    
    // Get current price from market data
    let currentPrice = 50;
    if (marketData.outcomePrices) {
      try {
        const prices = JSON.parse(marketData.outcomePrices);
        currentPrice = parseFloat(prices[0]) * 100;
      } catch {}
    }

    let priceHistory = [];
    
    // Try multiple approaches to get price history
    if (clobTokenIds.length > 0) {
      const yesTokenId = clobTokenIds[0];
      
      // Approach 1: CLOB prices-history API
      try {
        const priceUrl = `https://clob.polymarket.com/prices-history?market=${yesTokenId}&interval=${params.interval}&fidelity=${params.fidelity}`;
        const priceRes = await fetch(priceUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
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
        console.log('CLOB API failed:', e.message);
      }
      
      // Approach 2: Try data-api timeseries if CLOB failed
      if (priceHistory.length === 0) {
        try {
          const tsUrl = `https://data-api.polymarket.com/timeseries?market=${market}&fidelity=${params.fidelity * 60}`;
          const tsRes = await fetch(tsUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
          });
          
          if (tsRes.ok) {
            const tsData = await tsRes.json();
            if (Array.isArray(tsData) && tsData.length > 0) {
              priceHistory = tsData.map(p => ({
                timestamp: new Date(p.t || p.timestamp).getTime(),
                price: parseFloat(p.p || p.price) * 100,
              }));
            }
          }
        } catch (e) {
          console.log('Data API timeseries failed:', e.message);
        }
      }
    }

    // Sort by timestamp
    priceHistory.sort((a, b) => a.timestamp - b.timestamp);
    
    // Filter based on interval
    if (priceHistory.length > 0) {
      const now = Date.now();
      const intervalMs = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000,
        'max': Infinity,
      };
      const cutoff = now - (intervalMs[interval] || intervalMs['1d']);
      if (interval !== 'max') {
        priceHistory = priceHistory.filter(p => p.timestamp >= cutoff);
      }
    }

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
      history: priceHistory.slice(-100),
    });

  } catch (error) {
    console.error('Prices API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
