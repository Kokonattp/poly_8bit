module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const tag = req.query.tag || '';
  const closed = req.query.closed || 'false';
  const targetCount = Math.min(parseInt(req.query.limit) || 500, 1000);
  
  // Tag mappings for strict filtering
  const tagGroups = {
    'sports': ['sports', 'nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'tennis', 'golf', 'mma', 'boxing', 'cricket', 'rugby', 'f1', 'racing', 'olympics', 'esports'],
    'politics': ['politics', 'world-elections', 'us-elections', 'elections', 'government', 'policy'],
    'crypto': ['crypto', 'bitcoin', 'ethereum', 'defi', 'nft', 'web3', 'blockchain'],
    'pop-culture': ['pop-culture', 'entertainment', 'movies', 'tv', 'music', 'celebrities', 'awards', 'box-office'],
    'business': ['business', 'finance', 'stocks', 'economy', 'markets', 'tech', 'companies'],
    'science': ['science', 'technology', 'space', 'health', 'ai', 'climate'],
    'nfl': ['nfl', 'football', 'super-bowl'],
    'nba': ['nba', 'basketball'],
    'soccer': ['soccer', 'football', 'premier-league', 'champions-league', 'world-cup', 'la-liga', 'bundesliga', 'serie-a'],
    'mma': ['mma', 'ufc', 'boxing', 'fighting'],
  };

  try {
    let allEvents = [];
    let offset = 0;
    const limit = 100;
    const maxPages = 15; // More pages for 500 results
    
    // Get allowed tags for filtering
    const allowedTags = tag && tag !== 'all' ? tagGroups[tag] || [tag] : null;

    for (let page = 0; page < maxPages; page++) {
      let url = `https://gamma-api.polymarket.com/events?closed=${closed}&limit=${limit}&offset=${offset}&order=volume&ascending=false`;
      
      // For better accuracy, we query ALL events and filter locally
      // Only use tag parameter for specific sub-categories
      const specificTags = ['nfl', 'nba', 'soccer', 'mma', 'crypto', 'politics'];
      if (tag && specificTags.includes(tag)) {
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
        if (data.length < limit || allEvents.length >= targetCount * 2) break;
      } catch (e) {
        clearTimeout(timeout);
        break;
      }
    }

    const markets = allEvents.map((event, idx) => {
      const volume = parseFloat(event.volume) || 0;
      const liquidity = parseFloat(event.liquidity) || 0;
      
      // Get all tags as array of strings
      let tags = [];
      if (event.tags && Array.isArray(event.tags)) {
        tags = event.tags.map(t => typeof t === 'string' ? t.toLowerCase() : (t?.slug || t?.label || '').toLowerCase()).filter(Boolean);
      }
      
      // Get primary category
      let category = tags[0] || 'general';

      // Parse outcomes
      const outcomes = [];
      if (event.markets && event.markets.length > 0) {
        event.markets.forEach((m, idx) => {
          let price = 50;
          
          // Parse outcomePrices
          if (m.outcomePrices) {
            try {
              const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices;
              if (Array.isArray(prices) && prices.length > 0) {
                const p = parseFloat(prices[0]);
                price = Math.round((isNaN(p) ? 0.5 : p) * 100);
              }
            } catch {}
          }
          
          // Fallback to bestAsk
          if (price === 50 && m.bestAsk) {
            price = Math.round(parseFloat(m.bestAsk) * 100);
          }

          // Get best name for outcome
          let outcomeName = m.groupItemTitle || '';
          if (!outcomeName && m.question) {
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
            id: m.id,
            conditionId: m.conditionId || '',
            question: outcomeName,
            price,
            volume: parseFloat(m.volume) || 0,
          });
        });
      }

      // Sort outcomes by price descending (highest first)
      outcomes.sort((a, b) => b.price - a.price || b.volume - a.volume);

      return {
        id: event.id || `event-${idx}`,
        slug: event.slug || '',
        title: event.title || 'Unknown',
        description: event.description || '',
        image: event.image || '',
        category: String(category),
        tags: tags,
        volume,
        liquidity,
        endDate: event.endDate || '',
        startDate: event.startDate || '',
        active: !event.closed,
        commentCount: event.commentCount || 0,
        outcomesCount: outcomes.length,
        topOutcome: outcomes[0] || null,
        outcomes: outcomes.slice(0, 10),
      };
    });
    
    // STRICT FILTER: Only include markets that match the selected category
    let filteredMarkets = markets;
    if (allowedTags && allowedTags.length > 0) {
      filteredMarkets = markets.filter(m => {
        // Check if any of the market's tags match any allowed tag
        return m.tags.some(t => allowedTags.some(allowed => t.includes(allowed) || allowed.includes(t)));
      });
    }

    filteredMarkets.sort((a, b) => b.volume - a.volume);

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
    return res.status(200).json({ 
      success: true, 
      count: filteredMarkets.length,
      tag: tag || 'all',
      data: filteredMarkets.slice(0, targetCount)
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
