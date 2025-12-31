module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const slug = req.query.slug;
  if (!slug) return res.status(400).json({ success: false, error: 'slug required' });

  try {
    const url = `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PolyPro/2.0', 'Accept': 'application/json' }
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    if (!data || data.length === 0) throw new Error('Event not found');

    const event = data[0];
    const outcomes = [];

    if (event.markets && event.markets.length > 0) {
      event.markets.forEach((m, idx) => {
        const mVolume = parseFloat(m.volume) || 0;
        const mLiquidity = parseFloat(m.liquidity) || 0;
        
        let yesPrice = 0, noPrice = 100;
        if (m.outcomePrices) {
          try {
            const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
            if (Array.isArray(prices) && prices.length >= 1) {
              yesPrice = Math.round(parseFloat(prices[0]) * 100);
              noPrice = prices.length > 1 ? Math.round(parseFloat(prices[1]) * 100) : (100 - yesPrice);
            }
          } catch {}
        }

        // Get name
        let name = m.groupItemTitle || '';
        if (!name && m.question) {
          const match = m.question.match(/^Will (.+?) win/i);
          name = match ? match[1] : m.question;
        }
        if (!name) name = m.outcome || `Option ${idx + 1}`;

        outcomes.push({
          id: m.id,
          conditionId: m.conditionId || '',
          name,
          fullQuestion: m.question || '',
          yesPrice,
          noPrice,
          volume: mVolume,
          liquidity: mLiquidity,
          image: m.image || '',
          // Flag if dummy
          isDummy: (mVolume === 0 && mLiquidity === 0) || yesPrice === 100 || yesPrice === 0,
        });
      });
    }

    // Separate valid and dummy
    const validOutcomes = outcomes.filter(o => !o.isDummy);
    const dummyOutcomes = outcomes.filter(o => o.isDummy);

    // Sort valid by volume then price
    validOutcomes.sort((a, b) => b.volume - a.volume || b.yesPrice - a.yesPrice);

    // Get category
    let category = 'general';
    if (event.tags && Array.isArray(event.tags) && event.tags.length > 0) {
      const firstTag = event.tags[0];
      category = typeof firstTag === 'string' ? firstTag : (firstTag?.slug || firstTag?.label || 'general');
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({
      success: true,
      data: {
        id: event.id,
        slug: event.slug,
        title: event.title || 'Unknown',
        description: event.description || '',
        image: event.image || '',
        category: String(category),
        volume: parseFloat(event.volume) || 0,
        liquidity: parseFloat(event.liquidity) || 0,
        endDate: event.endDate || '',
        startDate: event.startDate || '',
        commentCount: event.commentCount || 0,
        outcomes: validOutcomes,
        dummyCount: dummyOutcomes.length,
      }
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
