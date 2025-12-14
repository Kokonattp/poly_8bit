module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const endpoint = req.query.endpoint || 'events';
  const closed = req.query.closed || 'false';
  const limit = req.query.limit || '100';
  
  const url = `https://gamma-api.polymarket.com/${endpoint}?closed=${closed}&limit=${limit}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PolyTrader/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'API Error' });
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=30');
    return res.status(200).json(data);
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
