module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const market = req.query.market || req.query.conditionId;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  if (!market) return res.status(400).json({ success: false, error: 'market required' });

  try {
    // Fetch holders data - try multiple pages to get more data
    let allData = [];
    const pageSize = 500;
    const maxPages = 4; // Max 2000 holders
    
    for (let page = 0; page < maxPages; page++) {
      const offset = page * pageSize;
      const url = `https://data-api.polymarket.com/holders?market=${encodeURIComponent(market)}&limit=${pageSize}&offset=${offset}`;
      
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        
        if (!response.ok) break;
        const data = await response.json();
        
        if (!data || !Array.isArray(data) || data.length === 0) break;
        
        allData = allData.concat(data);
        
        // If we got less than pageSize, we've reached the end
        let totalHoldersInPage = 0;
        data.forEach(tokenData => {
          if (tokenData.holders) totalHoldersInPage += tokenData.holders.length;
        });
        if (totalHoldersInPage < pageSize) break;
        
      } catch (e) {
        break;
      }
    }
    
    if (allData.length === 0) {
      return res.status(200).json({
        success: true,
        market,
        stats: { totalHolders: 0, yesHolders: 0, noHolders: 0, totalYesShares: 0, totalNoShares: 0, yesPct: 50 },
        data: []
      });
    }
    // Process all holder data
    const walletMap = new Map();
    
    // Known bot/contract addresses to filter out
    const knownBots = new Set([
      '0xa5ef0eba2fa70f6c72bc32bd604fffd11e04c966',
      '0x0000000000000000000000000000000000000000',
    ]);
    
    // Check if wallet is a known bot or matches bot patterns
    const isBot = (wallet) => {
      if (!wallet) return true;
      const lower = wallet.toLowerCase();
      if (knownBots.has(lower)) return true;
      if (lower.startsWith('0xa5ef') && lower.endsWith('2966')) return true;
      if (lower === '0x0000000000000000000000000000000000000000') return true;
      return false;
    };
    
    allData.forEach(tokenData => {
      if (tokenData.holders && Array.isArray(tokenData.holders)) {
        tokenData.holders.forEach(holder => {
            const wallet = (holder.proxyWallet || '').toLowerCase();
            if (!wallet) return;
            
            // Skip known bots/contracts using pattern matching
            if (isBot(wallet)) return;

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
            
            // If displayName looks like a long wallet/hex address, shorten it
            if (displayName.length > 20 && /^0x[a-fA-F0-9]/i.test(displayName)) {
              displayName = `${displayName.slice(0, 6)}...${displayName.slice(-4)}`;
            }
            // If displayName contains hyphen with long numbers (like token IDs), shorten
            if (displayName.length > 25 && displayName.includes('-')) {
              const parts = displayName.split('-');
              if (parts[0].length > 10) {
                displayName = `${parts[0].slice(0, 6)}...${parts[0].slice(-4)}`;
              }
            }
            // Final check - if still too long, truncate
            if (displayName.length > 20) {
              displayName = displayName.slice(0, 16) + '...';
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
    
    // Calculate stats from ALL holders before slicing
    const allYesHolders = holders.filter(h => h.outcome === 'YES');
    const allNoHolders = holders.filter(h => h.outcome === 'NO');
    const totalYesShares = allYesHolders.reduce((s, h) => s + h.amount, 0);
    const totalNoShares = allNoHolders.reduce((s, h) => s + h.amount, 0);
    const totalUniqueHolders = new Set(holders.map(h => h.wallet)).size;
    
    // Now slice for display (top holders only)
    const displayHolders = holders.slice(0, limit).map((h, i) => ({
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

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({
      success: true,
      market,
      stats: {
        totalHolders: totalUniqueHolders,
        yesHolders: allYesHolders.length,
        noHolders: allNoHolders.length,
        totalYesShares: Math.round(totalYesShares),
        totalNoShares: Math.round(totalNoShares),
        yesPct: (allYesHolders.length + allNoHolders.length) > 0 
          ? Math.round((allYesHolders.length / (allYesHolders.length + allNoHolders.length)) * 100) 
          : 50,
      },
      data: displayHolders
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
