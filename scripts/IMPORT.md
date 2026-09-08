# Eski botdan foydalanuvchilarni ko'chirish

`users.json` — eski `bot.db` dan olingan **78 ta foydalanuvchi**:
user ID, username, balans, referal ma'lumotlari va ro'yxatdan o'tgan sana.

Jami balans: **201 880 so'm** (7 ta foydalanuvchida).

## Ishga tushirish

Bir marta, bot ishga tushishidan **oldin**:

```bash
npm run import:sqlite -- data/import/users.json
```

Yoki to'g'ridan-to'g'ri eski baza fayli bilan:

```bash
npm run import:sqlite -- /yo'l/bot.db
```

Avval nima bo'lishini ko'rish uchun:

```bash
npm run import:sqlite -- data/import/users.json --dry-run
```

Balanslarni saqlamasdan, hammani noldan boshlash uchun:

```bash
npm run import:sqlite -- data/import/users.json --zero-balance
```

## Muhim

- Skriptni **bir necha marta** ishga tushirish xavfsiz: mavjud
  foydalanuvchining balansiga tegilmaydi, ya'ni pul ikkilanmaydi.
- To'lovlar, buyurtmalar va navbatdagi tranzaksiyalar **ko'chmaydi** —
  ular eski botning tugallanmagan ishlari.
- Ko'chirilgan foydalanuvchilar botga birinchi kirganda **ofertaga
  rozilik** beradi (bu huquqiy jihatdan to'g'ri yo'l).
- Ko'chirilgan balanslar `balance_ledger` ga `import:sqlite` izohi bilan
  yoziladi — keyinchalik "bu pul qayerdan keldi?" degan savolga javob bor.

## Fayl git'ga tushmaydi

`users.json` `data/` papkasida turadi, u esa `.gitignore` da — ichida
haqiqiy foydalanuvchi ma'lumotlari bor. Ko'chirishdan keyin faylni
o'chirib tashlashingiz mumkin.
