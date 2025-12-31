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

    // Use Map to track unique wallets with their LARGEST position
    const walletMap = new Map();
    
    // Known bot/contract addresses to filter out
    const knownBots = new Set([
      '0xa5ef0eba2fa70f6c72bc32bd604fffd11e04c966', // Common market maker/bot
      '0x0000000000000000000000000000000000000000',
    ]);
    
    if (Array.isArray(data)) {
      data.forEach(tokenData => {
        if (tokenData.holders && Array.isArray(tokenData.holders)) {
          tokenData.holders.forEach(holder => {
            const wallet = (holder.proxyWallet || '').toLowerCase();
            if (!wallet) return;
            
            // Skip known bots/contracts
            if (knownBots.has(wallet)) return;

            const amount = parseFloat(holder.amount) || 0;
            
            // Skip very small positions (likely dust)
            if (amount < 1) return;
            
            const outcome = holder.outcomeIndex === 0 ? 'YES' : 'NO';
            
            // Get display name - prioritize real names
            let displayName = '';
            let isRealName = false;
            
            if (holder.displayUsernamePublic && holder.name && holder.name.trim()) {
              displayName = holder.name.trim();
              isRealName = true;
            } else if (holder.pseudonym && holder.pseudonym !== 'Anonymous' && holder.pseudonym.trim()) {
              displayName = holder.pseudonym.trim();
            } else {
              // Use shortened wallet as name
              displayName = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
            }

            // Create unique key per wallet+outcome to track separate YES/NO positions
            const key = `${wallet}-${outcome}`;
            
            if (walletMap.has(key)) {
              // Same wallet, same outcome - add amounts
              const existing = walletMap.get(key);
              existing.amount += amount;
              // Update name if this one is "better"
              if (isRealName && !existing.isRealName) {
                existing.displayName = displayName;
                existing.isRealName = true;
              }
            } else {
              walletMap.set(key, {
                wallet,
                displayName,
                name: holder.name || '',
                pseudonym: holder.pseudonym || '',
                amount,
                outcome,
                profileImage: holder.profileImage || '',
                bio: holder.bio || '',
                isRealName,
              });
            }
          });
        }
      });
    }

    // Convert to array
    let holders = Array.from(walletMap.values());
    
    // Remove duplicates based on displayName being identical (likely same person)
    const seenNames = new Map();
    holders = holders.filter(h => {
      // If displayName looks like a wallet address, allow duplicates
      if (h.displayName.includes('...')) return true;
      
      const nameKey = `${h.displayName.toLowerCase()}-${h.outcome}`;
      if (seenNames.has(nameKey)) {
        // Keep the one with more shares
        const existing = seenNames.get(nameKey);
        if (h.amount > existing.amount) {
          seenNames.set(nameKey, h);
          return true;
        }
        return false;
      }
      seenNames.set(nameKey, h);
      return true;
    });

    // Sort by amount descending
    holders.sort((a, b) => b.amount - a.amount);
    
    // Add ranks
    holders = holders.slice(0, limit).map((h, i) => ({
      rank: i + 1,
      wallet: h.wallet,
      displayName: h.displayName,
      name: h.name,
      pseudonym: h.pseudonym,
      amount: h.amount,
      outcome: h.outcome,
      profileImage: h.profileImage,
      bio: h.bio,
    }));

    // Calculate stats
    const yesHolders = holders.filter(h => h.outcome === 'YES');
    const noHolders = holders.filter(h => h.outcome === 'NO');
    const totalYes = yesHolders.reduce((s, h) => s + h.amount, 0);
    const totalNo = noHolders.reduce((s, h) => s + h.amount, 0);
    const totalHolders = new Set(holders.map(h => h.wallet)).size;

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({
      success: true,
      market,
      stats: {
        totalHolders,
        yesHolders: yesHolders.length,
        noHolders: noHolders.length,
        totalYesShares: totalYes,
        totalNoShares: totalNo,
        yesPct: holders.length > 0 ? Math.round((yesHolders.length / holders.length) * 100) : 50,
      },
      data: holders
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
