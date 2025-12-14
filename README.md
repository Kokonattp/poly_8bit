# PolyTrader Pro - Vercel Deployment

## 🚀 Deploy ใน 3 นาที

### Step 1: สร้าง GitHub Repository

1. ไปที่ [github.com/new](https://github.com/new)
2. สร้าง repo ใหม่ชื่อ `polytrader-pro`
3. อัปโหลดไฟล์ทั้งหมดใน folder นี้

**หรือใช้ Git:**
```bash
cd polytrader-vercel
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/polytrader-pro.git
git push -u origin main
```

### Step 2: Deploy บน Vercel

1. ไปที่ [vercel.com](https://vercel.com) และ Login ด้วย GitHub
2. คลิก **"Add New Project"**
3. เลือก repo `polytrader-pro`
4. คลิก **"Deploy"**
5. รอ 1-2 นาที ✅ Done!

### Step 3: ใช้งาน

เปิด URL ที่ Vercel ให้มา เช่น:
```
https://polytrader-pro.vercel.app
```

---

## 📁 Project Structure

```
polytrader-vercel/
├── api/
│   └── polymarket.js    # Serverless proxy (แก้ CORS)
├── public/
│   └── index.html       # Frontend
├── vercel.json          # Vercel config
├── package.json         # Dependencies
└── README.md            # คำแนะนำ
```

---

## 🔧 How It Works

```
Browser → Your Vercel Function → Polymarket API
         (No CORS!)              (Server-side)
```

**ทำไมถึงไม่มี CORS?**
- CORS เป็น browser security feature
- Vercel Function ทำงานฝั่ง server ไม่ใช่ browser
- Server-to-server request ไม่มี CORS restriction

---

## 📊 API Endpoint

หลัง deploy แล้ว คุณจะได้ API endpoint:

```
GET /api/polymarket?endpoint=events&closed=false&limit=100
```

**Parameters:**
- `endpoint` - Polymarket API endpoint (default: `events`)
- `closed` - Filter closed markets (default: `false`)
- `limit` - Number of results (default: `100`)

---

## 💡 Tips

### Custom Domain
ไปที่ Vercel Dashboard → Settings → Domains → Add

### Auto Refresh
Markets จะ cache 30 วินาที เพื่อลด API calls

### Free Tier Limits
- 100,000 function calls/month
- 100GB bandwidth/month
- ปกติใช้งานไม่เกิน 1,000 calls/day ก็พอ

---

## ❓ Troubleshooting

### "Function timeout"
- Polymarket API อาจช้า ลอง refresh

### "Cannot find module"
- ตรวจสอบว่า `api/polymarket.js` อยู่ถูกที่

### Markets ไม่ขึ้น
- ดู Console (F12) ว่ามี error อะไร
- ตรวจสอบว่า API endpoint ถูกต้อง

---

## 🎯 Next Steps

1. **Custom Domain** - ใช้โดเมนของตัวเอง
2. **Auto Model%** - integrate FanDuel API
3. **Notifications** - แจ้งเตือนเมื่อมี High Edge
4. **Database** - เก็บ bets ใน Vercel KV/Postgres

---

## 📄 License

MIT - ใช้ได้ฟรี แก้ไขได้ตามใจ
