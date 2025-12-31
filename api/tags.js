module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = 'https://gamma-api.polymarket.com/tags';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PolyMarkets/1.0',
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform tags
    const tags = (Array.isArray(data) ? data : []).map(tag => ({
      id: tag.id || tag.slug,
      slug: tag.slug || tag.id,
      label: tag.label || tag.name || tag.slug,
    }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ 
      success: true, 
      data: tags 
    });

  } catch (error) {
    // Return default tags if API fails
    const defaultTags = [
      { id: 'sports', slug: 'sports', label: 'Sports' },
      { id: 'politics', slug: 'politics', label: 'Politics' },
      { id: 'crypto', slug: 'crypto', label: 'Crypto' },
      { id: 'pop-culture', slug: 'pop-culture', label: 'Pop Culture' },
      { id: 'business', slug: 'business', label: 'Business' },
      { id: 'science', slug: 'science', label: 'Science' },
    ];
    
    return res.status(200).json({ 
      success: true, 
      data: defaultTags,
      fallback: true
    });
  }
};
