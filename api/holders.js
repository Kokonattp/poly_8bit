module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const market = req.query.market || req.query.conditionId;
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);

  if (!market) {
    return res.status(400).json({ success: false, error: 'market (conditionId) required' });
  }

  try {
    const url = `https://data-api.polymarket.com/holders?market=${encodeURIComponent(market)}&limit=${limit}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    const holders = [];
    
    if (Array.isArray(data)) {
      data.forEach(tokenData => {
        const outcomeIndex = tokenData.holders?.[0]?.outcomeIndex;
        if (tokenData.holders && Array.isArray(tokenData.holders)) {
          tokenData.holders.forEach((holder, idx) => {
            holders.push({
              wallet: holder.proxyWallet || '',
              name: holder.name || '',
              pseudonym: holder.pseudonym || '',
              displayName: holder.displayUsernamePublic ? (holder.name || holder.pseudonym) : (holder.pseudonym || `Anon`),
              amount: parseFloat(holder.amount) || 0,
              outcome: holder.outcomeIndex === 0 ? 'YES' : 'NO',
              outcomeIndex: holder.outcomeIndex,
              profileImage: holder.profileImage || '',
              bio: holder.bio || '',
            });
          });
        }
      });
    }

    // Sort by amount and add rank
    holders.sort((a, b) => b.amount - a.amount);
    holders.forEach((h, i) => h.rank = i + 1);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({ 
      success: true, 
      market,
      count: holders.length,
      data: holders.slice(0, limit)
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
