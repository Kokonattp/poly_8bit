module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const closed = req.query.closed || 'false';
  
  try {
    let allEvents = [];
    let offset = 0;
    const limit = 100; // Max per request
    const maxPages = 10; // 10 pages = 1000 events (faster load)
    
    // Fetch pages with timeout
    for (let page = 0; page < maxPages; page++) {
      const url = `https://gamma-api.polymarket.com/events?closed=${closed}&limit=${limit}&offset=${offset}&order=volume&ascending=false`;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout per request
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'PolyTrader/1.0',
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) break;
        
        const data = await response.json();
        if (!data || data.length === 0) break;
        
        allEvents = allEvents.concat(data);
        offset += limit;
        
        // If we got less than limit, we've reached the end
        if (data.length < limit) break;
      } catch (fetchErr) {
        clearTimeout(timeout);
        console.log(`Page ${page} failed, stopping`);
        break;
      }
    }
    
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
    return res.status(200).json(allEvents);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
