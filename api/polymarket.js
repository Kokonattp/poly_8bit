module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const closed = req.query.closed || 'false';
  const fetchAll = req.query.all === 'true';
  
  try {
    let allEvents = [];
    let offset = 0;
    const limit = 100; // Max per request
    const maxPages = 50; // Safety limit: 50 pages = 5000 events max
    
    if (fetchAll) {
      // Fetch all pages
      for (let page = 0; page < maxPages; page++) {
        const url = `https://gamma-api.polymarket.com/events?closed=${closed}&limit=${limit}&offset=${offset}&order=volume&ascending=false`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'PolyTrader/1.0',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) break;
        
        const data = await response.json();
        if (!data || data.length === 0) break;
        
        allEvents = allEvents.concat(data);
        offset += limit;
        
        // If we got less than limit, we've reached the end
        if (data.length < limit) break;
      }
    } else {
      // Single page for backward compatibility
      const url = `https://gamma-api.polymarket.com/events?closed=${closed}&limit=200&order=volume&ascending=false`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PolyTrader/1.0',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `API Error: ${response.status}` });
      }
      
      allEvents = await response.json();
    }
    
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(allEvents);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
