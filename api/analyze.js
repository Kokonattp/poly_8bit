export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    
    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
    }
    
    try {
        const { title, category, impliedPct } = req.body;
        
        if (!title) {
            return res.status(400).json({ error: 'Missing title' });
        }
        
        const prompt = `วิเคราะห์ตลาด Prediction Market นี้:

ชื่อตลาด: "${title}"
หมวดหมู่: ${category || 'ทั่วไป'}
ราคาปัจจุบัน (Implied Probability): ${impliedPct || 50}%

กรุณาวิเคราะห์สั้นๆ กระชับ:

1. 🎯 โอกาสเกิดจริง: ให้เป็น % และเหตุผลสั้นๆ (1-2 ประโยค)

2. 📰 ปัจจัยสำคัญ 3 ข้อ:
   • ปัจจัยที่ 1
   • ปัจจัยที่ 2  
   • ปัจจัยที่ 3

3. ⚠️ ความเสี่ยง: อะไรที่อาจทำให้ผิดคาด (1 ประโยค)

4. 💡 สรุป: ควรซื้อ YES / ซื้อ NO / ไม่ควรเทรด? เพราะอะไร? (1-2 ประโยค)

ตอบเป็นภาษาไทย กระชับที่สุด ไม่เกิน 150 คำ`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: 'คุณเป็นนักวิเคราะห์ Prediction Market ที่เชี่ยวชาญ ตอบกระชับ ตรงประเด็น ใช้ข้อมูลจริงในการวิเคราะห์'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            console.error('Groq API error:', error);
            return res.status(500).json({ error: 'Groq API error' });
        }
        
        const data = await response.json();
        const analysis = data.choices?.[0]?.message?.content || 'ไม่สามารถวิเคราะห์ได้';
        
        // Generate Google News search URL
        const searchQuery = encodeURIComponent(title.replace(/\?/g, '').substring(0, 100));
        const newsUrl = `https://news.google.com/search?q=${searchQuery}&hl=th&gl=TH`;
        const reutersUrl = `https://www.reuters.com/search/news?query=${searchQuery}`;
        
        return res.status(200).json({ 
            analysis,
            newsLinks: {
                google: newsUrl,
                reuters: reutersUrl
            }
        });
        
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
