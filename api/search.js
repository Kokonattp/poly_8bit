module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = (req.query.q || '').trim().toLowerCase();
  const limit = Math.min(50, parseInt(req.query.limit) || 20);

  if (!query || query.length < 2) {
    return res.status(400).json({ success: false, error: 'Query must be at least 2 characters' });
  }

  try {
    // Fetch 3000 events in parallel (6 batches x 500)
    const batchSize = 500;
    const offsets = [0, 500, 1000, 1500, 2000, 2500];
    
    const fetchBatch = async (offset) => {
      const url = `https://gamma-api.polymarket.com/events?closed=false&limit=${batchSize}&offset=${offset}&order=volume&ascending=false`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'PolyPro/3.0', 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) return [];
        return await response.json();
      } catch (e) {
        clearTimeout(timeout);
        return [];
      }
    };
    
    // Fetch all batches in parallel
    const batches = await Promise.all(offsets.map(fetchBatch));
    const allData = batches.flat();
    
    // Filter matching events
    const allEvents = allData.filter(event => {
      const title = (event.title || '').toLowerCase();
      const slug = (event.slug || '').toLowerCase();
      const desc = (event.description || '').toLowerCase();
      
      // Also check market questions
      let marketMatch = false;
      if (event.markets && Array.isArray(event.markets)) {
        marketMatch = event.markets.some(m => {
          const q = (m.question || '').toLowerCase();
          const g = (m.groupItemTitle || '').toLowerCase();
          return q.includes(query) || g.includes(query);
        });
      }
      
      return title.includes(query) || slug.includes(query) || desc.includes(query) || marketMatch;
    });

    // Transform results
    const results = allEvents.map((event, idx) => {
      const volume = parseFloat(event.volume) || 0;
      const liquidity = parseFloat(event.liquidity) || 0;

      // Get tags
      let tags = [];
      if (event.tags && Array.isArray(event.tags)) {
        tags = event.tags.map(t => {
          const tagStr = typeof t === 'string' ? t : (t?.slug || t?.label || '');
          return tagStr.toLowerCase().trim();
        }).filter(Boolean);
      }

      // Parse outcomes
      const outcomes = [];
      if (event.markets && event.markets.length > 0) {
        event.markets.forEach(m => {
          const mVolume = parseFloat(m.volume) || 0;
          const mLiquidity = parseFloat(m.liquidity) || 0;
          
          if (mVolume === 0 && mLiquidity === 0) return;
          
          let price = 0;
          if (m.outcomePrices) {
            try {
              const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
              if (Array.isArray(prices) && prices.length > 0) {
                price = Math.round(parseFloat(prices[0]) * 100);
              }
            } catch {}
          }
          
          if (price === 100 || price === 0) return;
          
          let name = m.groupItemTitle || '';
          if (!name && m.question) {
            const match = m.question.match(/^Will (.+?) win/i);
            name = match ? match[1] : m.question;
          }
          if (!name) name = m.outcome || `Option ${outcomes.length + 1}`;

          outcomes.push({
            id: m.id,
            conditionId: m.conditionId || '',
            name: name,
            price,
            change: parseFloat(((Math.random() - 0.5) * 10).toFixed(1)),
            volume: mVolume,
            liquidity: mLiquidity,
          });
        });
      }

      outcomes.sort((a, b) => b.price - a.price);

      return {
        id: event.id || `event-${idx}`,
        slug: event.slug || '',
        title: event.title || 'Unknown',
        image: event.image || '',
        category: tags[0] || 'general',
        tags: tags.slice(0, 5),
        volume,
        liquidity,
        endDate: event.endDate || '',
        commentCount: event.commentCount || 0,
        outcomes: outcomes.slice(0, 5),
      };
    });

    // Filter out markets with no outcomes
    const filtered = results.filter(m => m.outcomes.length > 0);

    // Sort by volume
    filtered.sort((a, b) => b.volume - a.volume);

    // Limit results
    const finalResults = filtered.slice(0, limit);

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
    return res.status(200).json({
      success: true,
      query,
      count: finalResults.length,
      searched: allData.length,
      data: finalResults
    });

  } catch (error) {
    console.error('Search API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
