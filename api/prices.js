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
    
    // Parse clobTokenIds - could be string or array
    let clobTokenIds = [];
    if (marketData.clobTokenIds) {
      if (typeof marketData.clobTokenIds === 'string') {
        try {
          clobTokenIds = JSON.parse(marketData.clobTokenIds);
        } catch {
          clobTokenIds = [marketData.clobTokenIds];
        }
      } else if (Array.isArray(marketData.clobTokenIds)) {
        clobTokenIds = marketData.clobTokenIds;
      }
    }
    
    // Get current price from market data
    let currentPrice = 50;
    if (marketData.outcomePrices) {
      try {
        let prices = marketData.outcomePrices;
        if (typeof prices === 'string') {
          prices = JSON.parse(prices);
        }
        if (Array.isArray(prices) && prices.length > 0) {
          currentPrice = parseFloat(prices[0]) * 100;
        }
      } catch (e) {
        console.log('Price parse error:', e.message);
      }
    }

    let priceHistory = [];
    let apiUsed = 'none';
    
    // Try multiple APIs to get price history
    if (clobTokenIds.length > 0) {
      const yesTokenId = clobTokenIds[0];
      
      // Method 1: CLOB prices-history API
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
          if (priceData && priceData.history && Array.isArray(priceData.history) && priceData.history.length > 0) {
            priceHistory = priceData.history.map(p => ({
              timestamp: p.t * 1000,
              price: parseFloat(p.p) * 100,
            }));
            apiUsed = 'clob';
          }
        }
      } catch (e) {
        console.log('CLOB API error:', e.message);
      }
      
      // Method 2: Try data-api prices endpoint if CLOB failed
      if (priceHistory.length === 0) {
        try {
          const dataUrl = `https://data-api.polymarket.com/prices?market=${market}`;
          const dataRes = await fetch(dataUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
          });
          
          if (dataRes.ok) {
            const priceData = await dataRes.json();
            if (Array.isArray(priceData) && priceData.length > 0) {
              priceHistory = priceData.map(p => ({
                timestamp: new Date(p.t || p.timestamp || p.date).getTime(),
                price: parseFloat(p.p || p.price || p.yes_price || 0) * 100,
              })).filter(p => !isNaN(p.timestamp) && !isNaN(p.price) && p.price > 0);
              apiUsed = 'data-api';
            }
          }
        } catch (e) {
          console.log('Data API error:', e.message);
        }
      }
      
      // Method 3: Try gamma API timeseries if both failed
      if (priceHistory.length === 0) {
        try {
          const tsUrl = `https://gamma-api.polymarket.com/markets/${marketData.id}/timeseries`;
          const tsRes = await fetch(tsUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
          });
          
          if (tsRes.ok) {
            const tsData = await tsRes.json();
            if (Array.isArray(tsData) && tsData.length > 0) {
              priceHistory = tsData.map(p => ({
                timestamp: new Date(p.timestamp || p.t || p.date).getTime(),
                price: parseFloat(p.price || p.p || p.yes_price || 0) * 100,
              })).filter(p => !isNaN(p.timestamp) && !isNaN(p.price) && p.price > 0);
              apiUsed = 'gamma-timeseries';
            }
          }
        } catch (e) {
          console.log('Gamma timeseries error:', e.message);
        }
      }
    }

    // Sort by timestamp
    priceHistory.sort((a, b) => a.timestamp - b.timestamp);
    
    // Filter based on interval time range
    if (priceHistory.length > 0 && interval !== 'max') {
      const now = Date.now();
      const intervalMs = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
        '1w': 7 * 24 * 60 * 60 * 1000,
      };
      const cutoff = now - (intervalMs[interval] || intervalMs['1d']);
      priceHistory = priceHistory.filter(p => p.timestamp >= cutoff);
    }

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
      apiUsed,
      debug: {
        rawTokenIds: marketData.clobTokenIds,
        parsedTokenIds: clobTokenIds,
        rawPrices: marketData.outcomePrices,
      },
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
