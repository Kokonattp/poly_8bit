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
          headers: { 'User-Agent': 'PolyPro/1.0', 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) break;
        const data = await response.json();
        if (!data || data.length === 0) break;
        allEvents = allEvents.concat(data);
        offset += limit;
        if (data.length < limit || allEvents.length >= targetCount) break;
      } catch (e) {
        clearTimeout(timeout);
        break;
      }
    }

    const markets = allEvents.map((event, idx) => {
      const volume = parseFloat(event.volume) || 0;
      const liquidity = parseFloat(event.liquidity) || 0;
      
      // Get category
      let category = 'general';
      if (event.tags && Array.isArray(event.tags) && event.tags.length > 0) {
        const firstTag = event.tags[0];
        category = typeof firstTag === 'string' ? firstTag : (firstTag?.slug || firstTag?.label || 'general');
      }

      // Parse outcomes
      const outcomes = [];
      if (event.markets && event.markets.length > 0) {
        event.markets.forEach(m => {
          let price = 50;
          if (m.outcomePrices) {
            try {
              const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
              if (Array.isArray(prices) && prices.length > 0) {
                price = Math.round(parseFloat(prices[0]) * 100);
              }
            } catch {}
          }
          outcomes.push({
            id: m.id,
            conditionId: m.conditionId || '',
            question: m.question || m.groupItemTitle || event.title,
            price,
            volume: parseFloat(m.volume) || 0,
          });
        });
      }

      // Sort outcomes by price descending
      outcomes.sort((a, b) => b.price - a.price);

      return {
        id: event.id || `event-${idx}`,
        slug: event.slug || '',
        title: event.title || 'Unknown',
        description: event.description || '',
        image: event.image || '',
        category: String(category),
        volume,
        liquidity,
        endDate: event.endDate || '',
        active: !event.closed,
        outcomesCount: outcomes.length,
        topOutcome: outcomes[0] || null,
        outcomes: outcomes.slice(0, 10), // Top 10 outcomes
      };
    });

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
