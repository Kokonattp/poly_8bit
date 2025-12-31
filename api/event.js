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
        
        // Parse outcomePrices - handle multiple formats
        if (m.outcomePrices) {
          try {
            const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
            if (Array.isArray(prices) && prices.length >= 1) {
              const p1 = parseFloat(prices[0]);
              yesPrice = Math.round((isNaN(p1) ? 0.5 : p1) * 100);
              if (prices.length >= 2) {
                const p2 = parseFloat(prices[1]);
                noPrice = Math.round((isNaN(p2) ? (1 - p1) : p2) * 100);
              } else {
                noPrice = 100 - yesPrice;
              }
            }
          } catch (e) {
            console.error('Parse price error:', e);
          }
        }
        
        // Also try bestAsk/bestBid as fallback
        if (yesPrice === 50 && m.bestAsk) {
          yesPrice = Math.round(parseFloat(m.bestAsk) * 100);
          noPrice = 100 - yesPrice;
        }

        // Get the best name for the outcome
        // Priority: groupItemTitle > question (cleaned) > outcome
        let outcomeName = m.groupItemTitle || '';
        if (!outcomeName && m.question) {
          // Try to extract name from question like "Will X win the 2026..."
          const match = m.question.match(/^Will (.+?) win/i);
          if (match) {
            outcomeName = match[1];
          } else {
            outcomeName = m.question;
          }
        }
        if (!outcomeName) {
          outcomeName = m.outcome || `Outcome ${idx + 1}`;
        }

        outcomes.push({
          id: m.id || `outcome-${idx}`,
          conditionId: m.conditionId || '',
          tokenId: m.clobTokenIds?.[0] || '',
          question: outcomeName,
          fullQuestion: m.question || '',
          yesPrice,
          noPrice,
          volume: parseFloat(m.volume) || 0,
          liquidity: parseFloat(m.liquidity) || 0,
          active: !m.closed,
          image: m.image || '',
        });
      });
    }

    // Sort by yesPrice descending (highest chance first) - like Polymarket
    // But first, filter out dummy/placeholder markets (no volume, 100% or 0% price)
    const validOutcomes = outcomes.filter(o => {
      // Keep if has volume
      if (o.volume > 0) return true;
      // Keep if has liquidity
      if (o.liquidity > 0) return true;
      // Filter out 100% or 0% with no activity (placeholder markets)
      if ((o.yesPrice === 100 || o.yesPrice === 0) && o.volume === 0) return false;
      return true;
    });
    
    // Sort: first by volume (active markets first), then by price
    validOutcomes.sort((a, b) => {
      // Markets with volume come first
      if (a.volume > 0 && b.volume === 0) return -1;
      if (b.volume > 0 && a.volume === 0) return 1;
      // Then sort by price descending
      return b.yesPrice - a.yesPrice;
    });

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
      outcomesCount: validOutcomes.length,
      totalOutcomes: outcomes.length,
      outcomes: validOutcomes,
    };

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ success: true, data: result });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
