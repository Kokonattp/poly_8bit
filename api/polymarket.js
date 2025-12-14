// api/polymarket.js
// Vercel Serverless Function - Polymarket API Proxy
// This bypasses CORS by making server-side requests

export default async function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint } = req.query;
    
    // Default to events endpoint
    const apiEndpoint = endpoint || 'events';
    
    // Build Polymarket API URL
    let url = `https://gamma-api.polymarket.com/${apiEndpoint}`;
    
    // Forward query parameters (except 'endpoint')
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'endpoint') {
        queryParams.append(key, value);
      }
    }
    
    // Add default params for events
    if (apiEndpoint === 'events' && !req.query.closed) {
      queryParams.append('closed', 'false');
    }
    if (apiEndpoint === 'events' && !req.query.limit) {
      queryParams.append('limit', '100');
    }
    
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    console.log(`Fetching: ${url}`);

    // Fetch from Polymarket
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PolyTrader/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Polymarket API returned ${response.status}`);
    }

    const data = await response.json();

    // Cache for 30 seconds
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    
    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch from Polymarket',
      message: error.message 
    });
  }
}
