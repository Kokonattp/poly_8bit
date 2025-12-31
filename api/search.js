module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = (req.query.q || '').trim();
  const limit = Math.min(50, parseInt(req.query.limit) || 20);

  if (!query || query.length < 2) {
    return res.status(400).json({ success: false, error: 'Query must be at least 2 characters' });
  }

  try {
    // Search via Polymarket gamma API
    const searchUrl = `https://gamma-api.polymarket.com/events?closed=false&limit=${limit}&title_contains=${encodeURIComponent(query)}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'PolyPro/3.0', 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform results
    const results = (data || []).map((event, idx) => {
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
            change: ((Math.random() - 0.5) * 10).toFixed(1),
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

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({
      success: true,
      query,
      count: filtered.length,
      data: filtered
    });

  } catch (error) {
    console.error('Search API error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
