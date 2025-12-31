module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const slug = req.query.slug;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  if (!slug) return res.status(400).json({ success: false, error: 'slug required' });

  try {
    // Try to fetch comments from Polymarket
    // Note: Polymarket's comment API may require authentication or have different endpoints
    // This is a best-effort implementation
    
    const urls = [
      `https://gamma-api.polymarket.com/events/${encodeURIComponent(slug)}/comments?limit=${limit}`,
      `https://gamma-api.polymarket.com/comments?eventSlug=${encodeURIComponent(slug)}&limit=${limit}`,
    ];

    let comments = [];
    
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': 'https://polymarket.com/',
          },
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            comments = data;
            break;
          } else if (data.comments && Array.isArray(data.comments)) {
            comments = data.comments;
            break;
          } else if (data.data && Array.isArray(data.data)) {
            comments = data.data;
            break;
          }
        }
      } catch (e) {
        // Continue to next URL
        continue;
      }
    }

    // Format comments
    const formattedComments = comments.map(c => {
      // Calculate time ago
      let timeAgo = '';
      if (c.createdAt || c.timestamp) {
        const created = new Date(c.createdAt || c.timestamp * 1000);
        const now = new Date();
        const diffMs = now - created;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 60) {
          timeAgo = `${diffMins}m ago`;
        } else if (diffHours < 24) {
          timeAgo = `${diffHours}h ago`;
        } else if (diffDays < 30) {
          timeAgo = `${diffDays}d ago`;
        } else {
          timeAgo = created.toLocaleDateString();
        }
      }

      return {
        id: c.id || c._id || '',
        username: c.username || c.user?.name || c.author?.name || 'Anonymous',
        text: c.text || c.content || c.body || c.message || '',
        timeAgo,
        createdAt: c.createdAt || c.timestamp || '',
        likes: c.likes || c.likesCount || 0,
        replies: c.replies || c.repliesCount || 0,
        userImage: c.userImage || c.user?.image || c.author?.image || '',
      };
    }).filter(c => c.text); // Filter out empty comments

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json({
      success: true,
      slug,
      count: formattedComments.length,
      data: formattedComments,
    });

  } catch (error) {
    // Return empty comments on error (comments are not critical)
    return res.status(200).json({ 
      success: true, 
      slug,
      count: 0,
      data: [],
      note: 'Comments unavailable'
    });
  }
};
