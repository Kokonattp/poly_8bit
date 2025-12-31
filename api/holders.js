module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const market = req.query.market || req.query.conditionId;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  if (!market) return res.status(400).json({ success: false, error: 'market required' });

  try {
    const url = `https://data-api.polymarket.com/holders?market=${encodeURIComponent(market)}&limit=500`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();

    // Group by UNIQUE wallet address
    const walletMap = new Map();
    
    if (Array.isArray(data)) {
      data.forEach(tokenData => {
        if (tokenData.holders && Array.isArray(tokenData.holders)) {
          tokenData.holders.forEach(holder => {
            const wallet = holder.proxyWallet || '';
            if (!wallet) return;

            const amount = parseFloat(holder.amount) || 0;
            const outcome = holder.outcomeIndex === 0 ? 'YES' : 'NO';
            
            // Get display name - use wallet short if anonymous
            let displayName = '';
            if (holder.displayUsernamePublic && holder.name) {
              displayName = holder.name;
            } else if (holder.pseudonym && holder.pseudonym !== 'Anonymous') {
              displayName = holder.pseudonym;
            } else {
              // Use shortened wallet as name
              displayName = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
            }

            // Check if wallet exists (combine positions)
            if (walletMap.has(wallet)) {
              const existing = walletMap.get(wallet);
              // Add to existing position
              if (outcome === existing.outcome) {
                existing.amount += amount;
              } else {
                // Different outcome - keep larger position
                if (amount > existing.amount) {
                  existing.amount = amount;
                  existing.outcome = outcome;
                }
              }
            } else {
              walletMap.set(wallet, {
                wallet,
                displayName,
                name: holder.name || '',
                pseudonym: holder.pseudonym || '',
                amount,
                outcome,
                profileImage: holder.profileImage || '',
                bio: holder.bio || '',
              });
            }
          });
        }
      });
    }

    // Convert to array and sort by amount
    let holders = Array.from(walletMap.values());
    holders.sort((a, b) => b.amount - a.amount);
    
    // Add ranks
    holders = holders.slice(0, limit).map((h, i) => ({
      rank: i + 1,
      ...h
    }));

    // Calculate stats
    const totalYes = holders.filter(h => h.outcome === 'YES').reduce((s, h) => s + h.amount, 0);
    const totalNo = holders.filter(h => h.outcome === 'NO').reduce((s, h) => s + h.amount, 0);
    const yesHolders = holders.filter(h => h.outcome === 'YES').length;
    const noHolders = holders.filter(h => h.outcome === 'NO').length;

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({
      success: true,
      market,
      stats: {
        totalHolders: holders.length,
        yesHolders,
        noHolders,
        totalYesShares: totalYes,
        totalNoShares: totalNo,
        yesPct: holders.length > 0 ? Math.round((yesHolders / holders.length) * 100) : 50,
      },
      data: holders
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
