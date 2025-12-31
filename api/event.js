module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const slug = req.query.slug;
  
  if (!slug) {
    return res.status(400).json({ success: false, error: 'slug parameter required' });
  }

  try {
    const url = `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'PolyPro/1.0', 'Accept': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error('Event not found');
    }

    const event = data[0];

    // Parse all outcomes/markets
    const outcomes = [];
    if (event.markets && event.markets.length > 0) {
      event.markets.forEach((m, idx) => {
        let yesPrice = 50;
        let noPrice = 50;
        
        if (m.outcomePrices) {
          try {
            const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
            if (Array.isArray(prices)) {
              yesPrice = Math.round(parseFloat(prices[0] || 0.5) * 100);
              noPrice = Math.round(parseFloat(prices[1] || 0.5) * 100);
            }
          } catch {}
        }

        outcomes.push({
          id: m.id || `outcome-${idx}`,
          conditionId: m.conditionId || '',
          tokenId: m.clobTokenIds?.[0] || '',
          question: m.question || m.groupItemTitle || `Outcome ${idx + 1}`,
          yesPrice,
          noPrice,
          volume: parseFloat(m.volume) || 0,
          liquidity: parseFloat(m.liquidity) || 0,
          active: !m.closed,
          image: m.image || event.image || '',
        });
      });
    }

    // Sort by volume or price
    outcomes.sort((a, b) => b.volume - a.volume || b.yesPrice - a.yesPrice);

    // Get category
    let category = 'general';
    if (event.tags && Array.isArray(event.tags) && event.tags.length > 0) {
      const firstTag = event.tags[0];
      category = typeof firstTag === 'string' ? firstTag : (firstTag?.slug || firstTag?.label || 'general');
    }

    const result = {
      id: event.id,
      slug: event.slug,
      title: event.title || 'Unknown Event',
      description: event.description || '',
      image: event.image || '',
      category: String(category),
      volume: parseFloat(event.volume) || 0,
      liquidity: parseFloat(event.liquidity) || 0,
      endDate: event.endDate || '',
      startDate: event.startDate || '',
      active: !event.closed,
      commentCount: event.commentCount || 0,
      outcomesCount: outcomes.length,
      outcomes,
    };

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ success: true, data: result });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
