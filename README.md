# PolyTrader 8bitcn Edition

## Deploy to Vercel

1. Upload ไฟล์ทั้งหมดไป GitHub repo
2. ไปที่ vercel.com แล้ว Import repo
3. กด Deploy (ไม่ต้องตั้งค่าอะไร)
4. รอ 1-2 นาที เสร็จ!

## โครงสร้างไฟล์

```
/api/polymarket.js   - Serverless API proxy
/public/index.html   - Frontend UI
/vercel.json         - Vercel config
/package.json        - Project info
```

## การใช้งาน

1. เปิดเว็บที่ deploy แล้ว
2. รอ markets โหลด
3. ใส่ Model% จาก FanDuel
4. กด CALC ดู Edge/EV
5. ถ้า Edge ≥ 5% = เทรดได้!
