module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const tag = req.query.tag || '';
  const closed = req.query.closed || 'false';
  const targetCount = Math.min(parseInt(req.query.limit) || 200, 500);

  try {
    let allEvents = [];
    let offset = 0;
    const limit = 100;
    const maxPages = 10;

    for (let page = 0; page < maxPages; page++) {
      let url = `https://gamma-api.polymarket.com/events?closed=${closed}&limit=${limit}&offset=${offset}&order=volume&ascending=false`;
      
      if (tag && tag !== 'all') {
        url += `&tag=${encodeURIComponent(tag)}`;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'PolyMarkets/1.0',
            'Accept': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) break;

        const data = await response.json();
        if (!data || data.length === 0) break;

        allEvents = allEvents.concat(data);
        offset += limit;

        if (data.length < limit || allEvents.length >= targetCount) break;
      } catch (fetchErr) {
        clearTimeout(timeout);
        break;
      }
    }

    // Transform to markets
    const markets = [];
    
    allEvents.forEach((event, idx) => {
      const volume = parseFloat(event.volume) || 0;
      const liquidity = parseFloat(event.liquidity) || 0;
      
      let yesPrice = 50;
      let noPrice = 50;
      
      // Get price from first market or event
      if (event.markets && event.markets.length > 0) {
        const m = event.markets[0];
        if (m.outcomePrices) {
          try {
            const prices = typeof m.outcomePrices === 'string' 
              ? JSON.parse(m.outcomePrices) 
              : m.outcomePrices;
            if (Array.isArray(prices) && prices.length >= 2) {
              yesPrice = Math.round(parseFloat(prices[0]) * 100);
              noPrice = Math.round(parseFloat(prices[1]) * 100);
            }
          } catch {}
        }
      }

      markets.push({
        id: event.id || `event-${idx}`,
        slug: event.slug || '',
        title: event.title || 'Unknown',
        image: event.image || '',
        category: event.tags?.[0] || 'general',
        volume,
        liquidity,
        yesPrice,
        noPrice,
        endDate: event.endDate || '',
        active: !event.closed,
        marketsCount: event.markets?.length || 1,
      });
    });

    // Sort by volume
    markets.sort((a, b) => b.volume - a.volume);

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
    return res.status(200).json({ 
      success: true, 
      count: markets.length,
      tag: tag || 'all',
      data: markets.slice(0, targetCount)
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
