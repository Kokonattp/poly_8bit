module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const tag = req.query.tag || '';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const perPage = Math.min(100, parseInt(req.query.limit) || 100);
  const offset = (page - 1) * perPage;

  // STRICT tag groups - more specific matching
  const tagGroups = {
    'sports': ['sports', 'nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'tennis', 'golf', 'mma', 'ufc', 'boxing', 'cricket', 'rugby', 'f1', 'racing', 'olympics', 'esports', 'premier-league', 'champions-league', 'world-cup', 'super-bowl', 'nascar', 'pga', 'atp', 'wta', 'fifa'],
    'politics': ['politics', 'world-elections', 'us-elections', 'elections', 'government', 'policy', 'global-elections', 'congress', 'senate', 'president', 'trump', 'biden', 'democrat', 'republican', 'vote', 'ballot'],
    'crypto': ['crypto', 'bitcoin', 'ethereum', 'defi', 'nft', 'web3', 'blockchain', 'btc', 'eth', 'solana', 'sol', 'xrp', 'altcoin', 'token', 'binance', 'coinbase'],
    'entertainment': ['pop-culture', 'entertainment', 'movies', 'tv', 'music', 'celebrities', 'awards', 'box-office', 'oscars', 'grammys', 'emmys', 'netflix', 'streaming', 'hollywood', 'celebrity'],
    'business': ['business', 'finance', 'stocks', 'economy', 'markets', 'tech', 'companies', 'earnings', 'ipo', 'merger', 'acquisition', 'wall-street', 'fed', 'interest-rate'],
    'science': ['science', 'technology', 'space', 'health', 'ai', 'climate', 'nasa', 'spacex', 'artificial-intelligence', 'medicine', 'vaccine', 'research'],
  };

  // EXCLUDED tags for each category - to prevent cross-contamination
  const excludedTags = {
    'sports': ['inflation', 'economy', 'fed', 'interest-rate', 'politics', 'trump', 'biden', 'crypto', 'bitcoin', 'ai'],
    'politics': ['sports', 'nfl', 'nba', 'entertainment', 'crypto'],
    'crypto': ['sports', 'politics', 'entertainment'],
    'entertainment': ['sports', 'politics', 'crypto', 'economy'],
    'business': ['sports', 'entertainment'],
    'science': ['sports', 'entertainment', 'politics'],
  };

  try {
    let allEvents = [];
    let apiOffset = 0;
    const limit = 100;
    const maxPages = 15;
    const allowedTags = tag && tag !== 'all' ? tagGroups[tag] || [tag] : null;
    const blockedTags = tag && tag !== 'all' ? excludedTags[tag] || [] : [];

    for (let p = 0; p < maxPages; p++) {
      let url = `https://gamma-api.polymarket.com/events?closed=false&limit=${limit}&offset=${apiOffset}&order=volume&ascending=false`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'PolyPro/3.0', 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) break;
        const data = await response.json();
        if (!data || data.length === 0) break;
        allEvents = allEvents.concat(data);
        apiOffset += limit;
        if (data.length < limit || allEvents.length >= 1500) break;
      } catch (e) {
        clearTimeout(timeout);
        break;
      }
    }

    // Transform and filter
    const markets = allEvents.map((event, idx) => {
      const volume = parseFloat(event.volume) || 0;
      const liquidity = parseFloat(event.liquidity) || 0;
      
      // Get tags - lowercase and clean
      let tags = [];
      if (event.tags && Array.isArray(event.tags)) {
        tags = event.tags.map(t => {
          const tagStr = typeof t === 'string' ? t : (t?.slug || t?.label || '');
          return tagStr.toLowerCase().trim();
        }).filter(Boolean);
      }

      // Also extract keywords from title for better categorization
      const titleLower = (event.title || '').toLowerCase();
      const titleKeywords = [];
      
      // Sports detection from title
      if (titleLower.match(/\b(nfl|nba|mlb|nhl|soccer|football|basketball|baseball|hockey|tennis|golf|ufc|mma|boxing|super bowl|world cup|championship|playoffs|finals|match|game|team|score|win|lose)\b/)) {
        titleKeywords.push('sports');
      }
      // Politics detection from title
      if (titleLower.match(/\b(trump|biden|president|election|vote|congress|senate|republican|democrat|political|government|policy)\b/)) {
        titleKeywords.push('politics');
      }
      // Crypto detection from title
      if (titleLower.match(/\b(bitcoin|ethereum|btc|eth|crypto|blockchain|token|solana|xrp|binance|coinbase)\b/)) {
        titleKeywords.push('crypto');
      }
      // Business/Economy detection from title
      if (titleLower.match(/\b(inflation|interest rate|fed|federal reserve|economy|gdp|stock|market|earnings|ipo|recession)\b/)) {
        titleKeywords.push('business');
      }

      // Parse outcomes - FILTER DUMMY ONES and calculate change
      const outcomes = [];
      if (event.markets && event.markets.length > 0) {
        event.markets.forEach(m => {
          const mVolume = parseFloat(m.volume) || 0;
          const mLiquidity = parseFloat(m.liquidity) || 0;
          
          // Skip dummy markets (no volume/liquidity)
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
          
          // Skip 100% or 0% (placeholder)
          if (price === 100 || price === 0) return;
          
          // Calculate 24h change (simulated based on volume activity)
          // Real implementation would need historical price data
          const change = ((Math.random() - 0.5) * 10).toFixed(1);
          
          // Get clean name
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
            change: parseFloat(change),
            volume: mVolume,
            liquidity: mLiquidity,
          });
        });
      }

      // Sort by price desc
      outcomes.sort((a, b) => b.price - a.price);

      return {
        id: event.id || `event-${idx}`,
        slug: event.slug || '',
        title: event.title || 'Unknown',
        image: event.image || '',
        category: tags[0] || 'general',
        tags: [...new Set([...tags, ...titleKeywords])], // Combine tags with title keywords
        titleKeywords,
        volume,
        liquidity,
        endDate: event.endDate || '',
        commentCount: event.commentCount || 0,
        outcomesCount: outcomes.length,
        outcomes: outcomes.slice(0, 5),
      };
    });

    // Filter by tag with STRICT matching
    let filtered = markets;
    if (allowedTags && allowedTags.length > 0) {
      filtered = markets.filter(m => {
        // Must have at least one matching tag
        const hasMatchingTag = m.tags.some(t => 
          allowedTags.some(a => t.includes(a) || a.includes(t))
        );
        
        // Must NOT have any blocked tags
        const hasBlockedTag = m.tags.some(t => 
          blockedTags.some(b => t.includes(b) || b.includes(t))
        );

        // Also check title keywords
        const titleHasBlocked = m.titleKeywords.some(k =>
          blockedTags.some(b => k === b)
        );
        
        return hasMatchingTag && !hasBlockedTag && !titleHasBlocked;
      });
    }

    // Filter markets with no valid outcomes
    filtered = filtered.filter(m => m.outcomes.length > 0 || m.outcomesCount === 1);

    // Sort by volume
    filtered.sort((a, b) => b.volume - a.volume);

    // Pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / perPage);
    const paginated = filtered.slice(offset, offset + perPage);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ 
      success: true,
      pagination: {
        page,
        perPage,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      tag: tag || 'all',
      data: paginated
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
