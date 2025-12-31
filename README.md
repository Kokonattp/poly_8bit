# 🏆 Polymarket Leaderboard

> Top 200 Traders บน Polymarket พร้อม UI สวยงาม + Data จริง

---

## 🚀 ขั้นตอน Deploy บน Vercel (Production)

### ขั้นตอนที่ 1: สร้าง GitHub Repository

```bash
# 1.1 แตก zip และเข้าโฟลเดอร์
unzip polymarket-leaderboard.zip
cd polymarket-leaderboard

# 1.2 สร้าง git repo
git init
git add .
git commit -m "Initial commit"

# 1.3 สร้าง repo ใหม่บน GitHub แล้ว push
git remote add origin https://github.com/YOUR_USERNAME/polymarket-leaderboard.git
git branch -M main
git push -u origin main
```

### ขั้นตอนที่ 2: Deploy บน Vercel

```
1. ไปที่ https://vercel.com
2. Sign up / Login ด้วย GitHub
3. คลิก "Add New..." → "Project"
4. Import repository "polymarket-leaderboard"
5. คลิก "Deploy" (ไม่ต้องตั้งค่าอะไรเพิ่ม)
6. รอ 1-2 นาที ✅
```

### ขั้นตอนที่ 3: เสร็จ! 🎉

```
เว็บจะได้ URL: https://polymarket-leaderboard.vercel.app
(หรือชื่ออื่นที่คุณตั้ง)
```

---

## 💻 ทดสอบในเครื่อง (Development)

```bash
# 1. ติดตั้ง dependencies
npm install

# 2. รัน development server
npm run dev

# 3. เปิด browser
open http://localhost:3000
```

---

## 📁 โครงสร้างไฟล์

```
polymarket-leaderboard/
├── app/
│   ├── api/
│   │   ├── leaderboard/route.ts   ← API ดึง Top 200
│   │   └── positions/route.ts     ← API ดึง positions
│   ├── globals.css                ← Styles + Font Prompt
│   ├── layout.tsx                 ← Layout หลัก
│   └── page.tsx                   ← หน้าหลัก
├── package.json
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── README.md
```

---

## ✨ Features

- ✅ **Top 200 Traders** - Data จริงจาก Polymarket API
- ✅ **Filters** - Period, PnL, Volume, ROI, Search
- ✅ **Sort** - คลิก header เพื่อ sort
- ✅ **Profile Modal** - ดู positions ทั้งหมด
- ✅ **Market Links** - กดไป Polymarket ได้เลย
- ✅ **Font Prompt** - รองรับภาษาไทย
- ✅ **Dark Mode** - UI สวยงาม
- ✅ **Responsive** - ใช้ได้ทุกอุปกรณ์
- ✅ **Edge Runtime** - เร็วมาก
- ✅ **Auto Caching** - 60 วินาที

---

## ⚡ Performance

| API | Response Time | Cache |
|-----|--------------|-------|
| Leaderboard | ~1-2 วินาที | 60s |
| Positions | ~0.5-1 วินาที | 30s |

---

## 🔧 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Runtime:** Edge Functions
- **Styling:** Tailwind CSS
- **Font:** Prompt (Google Fonts)
- **Deploy:** Vercel
- **API:** Polymarket Data API

---

## 📝 License

MIT

---

Made with ❤️ for Polymarket traders
