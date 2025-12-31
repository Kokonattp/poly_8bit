// Debug endpoint to see raw API response
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const slug = req.query.slug || 'portugal-presidential-election';

  try {
    const url = `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PolyPro/1.0', 'Accept': 'application/json' }
    });

    const data = await response.json();
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = data[0];
    
    // Return raw market data for debugging
    const debug = {
      eventTitle: event.title,
      eventSlug: event.slug,
      totalMarkets: event.markets?.length || 0,
      markets: event.markets?.slice(0, 10).map((m, i) => ({
        index: i,
        id: m.id,
        conditionId: m.conditionId,
        question: m.question,
        groupItemTitle: m.groupItemTitle,
        outcome: m.outcome,
        outcomePrices: m.outcomePrices,
        outcomePricesType: typeof m.outcomePrices,
        bestAsk: m.bestAsk,
        bestBid: m.bestBid,
        volume: m.volume,
        // All fields for analysis
        allKeys: Object.keys(m),
      })) || []
    };

    return res.status(200).json(debug);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
