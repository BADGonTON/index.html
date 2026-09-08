# HozirOL Platform

Telegram **Stars**, **Premium**, **Gift** va **Gift Arenda** — bitta bot, bitta Mini App,
bitta PostgreSQL bazasi, bitta balans.

Avval bu ikkita alohida loyiha edi (`hozirol-bot` va `gift-arenda-bot`, ikkinchisi SQLite'da).
Endi ular to'liq birlashtirildi.

---

## Nimalar bor

| Bo'lim | Qayerda | Tavsif |
|---|---|---|
| ⭐ Stars | Bot | Fragment orqali Stars sotib olish |
| 👑 Premium | Bot | 3/6/12 oylik Premium |
| 🎁 Gift | Bot | Telegram sovg'alarini Stars bilan sotib olish |
| 📱 Telegram profil | Bot | Tayyor akkaunt sotish (GramJS) |
| 🖼 **Gift Arenda** | **Mini App** | TON NFT giftlarni ijaraga olish, profilga ulash, uzaytirish |
| 💰 Balans | Ikkalasi | Karta orqali to'ldirish, referal — **barcha bo'limlar uchun umumiy** |

---

## Tez boshlash

```bash
# 1. PostgreSQL (Docker bilan eng oson)
docker run -d --name hozirol-pg \
  -e POSTGRES_USER=hozirol -e POSTGRES_PASSWORD=hozirol -e POSTGRES_DB=hozirol \
  -p 5432:5432 postgres:16

# 2. Sozlash
npm install
cp .env.example .env      # va to'ldiring

# 3. Ishga tushirish
npm run dev               # ishlab chiqish (auto-reload)
```

Ishlab chiqarish uchun:

```bash
npm run build
npm start
# yoki: pm2 start ecosystem.config.cjs
```

Docker bilan hamma narsa birdaniga:

```bash
docker compose up -d
```

Mini App manzili: `<PUBLIC_URL>/app` — bot uni avtomatik tugma qilib qo'yadi.

---

## Loyiha tuzilishi

```
src/
  config.ts               barcha .env sozlamalari + tekshiruv
  index.ts                kirish nuqtasi (bot + server + workerlar)

  bot/
    bot.ts                botni yig'ish
    texts.ts              BARCHA matnlar (tilni shu yerdan o'zgartiring)
    keyboards.ts          BARCHA tugmalar
    ui.ts                 "eski xabar o'chib, yangisi kiradi" mantiqi
    session.ts, steps.ts  FSM
    handlers/             start, payment, stars, premium, gifts,
                          tgProfile, admin, adminAccounts, textRouter

  db/
    pool.ts               PostgreSQL pool + tranzaksiya yordamchisi
    migrate.ts            migratsiya tizimi
    migrations/*.sql      sxema (001…005)
    repo/                 har bir jadval uchun funksiyalar

  services/
    catalog.ts            ⭐ Marketapp katalogi keshi (tezlikning kaliti)
    marketapp.ts          Marketapp API klienti
    pricing.ts            TON → so'm hisob-kitobi
    wallet.ts             TON hamyon (global qulf bilan)
    toncenter.ts          blokcheyn RPC
    telegramAccount.ts    GramJS (akkaunt sotish)
    starPrice.ts          Stars narxi keshi
    logger.ts             kanalga log

  web/
    server.ts             Express: Mini App + API + webhook
    routes.ts             Mini App API
    auth.ts               initData imzosini tekshirish + rate limit

  worker/
    txWorker.ts           Stars/Premium blokcheyn navbati
    rentWorker.ts         Gift Arenda blokcheyn navbati
    sweeper.ts            muddati o'tganlarni tozalash

miniapp/                  Mini App (build kerak emas — sof HTML/CSS/JS)
  index.html                ikonka sprite'i shu faylga joylashtirilgan
  styles.css  app.js
```

**Ikonkalar:** [Solar](https://www.figma.com/community/file/1166831539721848736)
(480 Design), CC BY 4.0 — svgrepo.com aynan shu to'plamni tarqatadi. Barchasi
`index.html` ichiga SVG sprite sifatida joylashtirilgan, ya'ni ikonkalar uchun
alohida so'rov ketmaydi.

---

## Telegram bilan bog'lanish

Mini App ochilmasligining sabablari deyarli har doim sozlamada bo'ladi, kodda
emas. Shuning uchun bot **ishga tushganda avtomatik tekshiradi** va aniq xabar
beradi; istalgan vaqtda botda `/diag` buyrug'i bilan qayta tekshirasiz.

| Tekshiruv | Nega muhim |
|---|---|
| `PUBLIC_URL` https ekanligi | Telegram http:// manzilni umuman ochmaydi |
| Webhook holati va oxirgi xatosi | Telegram serveringizga ulana olyaptimi |
| Navbatdagi xabarlar soni | 50 dan oshsa — bot to'xtagan yoki sekin |
| **Mini App sahifasi tashqaridan ochiladimi** | nginx, SSL va marshrutni birdaniga tekshiradi |
| **`X-Frame-Options` yo'qligi** | Bu sarlavha bo'lsa Telegram **Web/Desktop**'da ilova ochilmaydi, telefonda esa ishlayveradi — shuning uchun sezish qiyin |
| CSP `frame-ancestors` | yuqoridagining ikkinchi ko'rinishi |
| `/api/bootstrap` javob beradimi | nginx `/api/` ni ham uzatyaptimi |
| Menyu tugmasi | xabar maydoni yonidagi doimiy tugma |

Bot ishga tushganda menyu tugmasini o'zi o'rnatadi (`setChatMenuButton`) — ya'ni
foydalanuvchi Mini App'ni ikki joydan ocha oladi: `/start` dagi tugmadan va
xabar maydoni yonidagi doimiy tugmadan.

Mini App tomonida ham:

- Telegramdan tashqarida ochilsa — "Avtorizatsiya xatosi" o'rniga
  **"Ilovani Telegram orqali oching"** deb tushuntiradi.
- Seans muddati tugasa (`INITDATA_MAX_AGE_SEC`) — qayta ochishni taklif qiladi.

---

## Tezlik: nima o'zgardi

Eski Gift-bot Mini App **har ochilganda** Marketapp'ga `1 + N` ta so'rov yuborardi
(N = kolleksiyalar soni). 20 ta kolleksiyada bu 5–15 soniyalik "oq ekran" degani edi.

Haqiqiy hajm: **~120 kolleksiya, ~8 000 gift**. Yechim:

1. **Aylanma fon yangilash.** Har `MARKET_CYCLE_SEC` (default 60 s) da faqat
   `MARKET_BATCH` (default 12) ta eng eski kolleksiya yangilanadi — to'liq
   aylanish ~10 daqiqa. So'rovlar **ketma-ket**, orasida tanaffus bilan.
2. **Moslashuvchan tezlik.** 429 kelsa tanaffus oshadi va `Retry-After`
   hurmat qilinadi; barqarorlashgach o'zi qaytadi. Ya'ni tizim Marketapp'ning
   haqiqiy chegarasini o'zi topib oladi.
3. **Har bir kolleksiya mustaqil saqlanadi** (`market_collections`). Bittasi
   yiqilsa — u faqat eski holatida qoladi, boshqalarga ta'sir qilmaydi va
   ishlaydigan ma'lumot hech qachon bo'shga almashmaydi.
4. **Bootstrap yengil.** Ochilishda giftlar yuborilmaydi — faqat foydalanuvchi,
   balans, ijaralar va kolleksiyalar ro'yxati (~13 KB). 8 000 giftni bitta
   javobda yuborish ~2 MB bo'lardi.
5. **Giftlar sahifalab keladi** — `/api/gifts` dan 60 tadan (~14 KB). Qidiruv,
   saralash va kolleksiya filtri ham serverda, xotiradagi indeks ustidan.
6. **Narx klientda hisoblanadi** — slayder tortilganda so'rov ketmaydi.
   (Server to'lovda narxni baribir qayta hisoblaydi — xavfsizlik uchun.)
7. **TON tranzaksiyasi** (15–60 s) HTTP so'rovni bloklamaydi — navbatga
   qo'yiladi, natija botdan xabar sifatida keladi.

Marketapp butunlay yiqilsa ham katalog joyida qoladi — Mini App ishlashda davom etadi.

---

## 100–200 ming foydalanuvchi

| Nima | Qanday hal qilingan |
|---|---|
| Sessiya | PostgreSQL'da (`bot_sessions`) — RAM emas, shuning uchun ko'p instance mumkin |
| Gorizontal skeyl | `BOT_MODE=webhook` → nginx orqasida istalgancha nusxa |
| Navbatlar | `FOR UPDATE SKIP LOCKED` — bitta ish ikki marta bajarilmaydi |
| TON hamyon | `pg_advisory_lock` — butun klaster bo'ylab ketma-ket yuborish |
| Balans | Atomik `UPDATE … WHERE balance >= …` — hech qachon manfiy bo'lmaydi |
| Pul auditi | `balance_ledger` — har bir tiyin qayerdan kelib qayerga ketgani |
| Broadcast | Sahifalab o'qiydi (200k ID RAMga yuklanmaydi), sekundiga 25 ta xabar |
| Telegram limitlari | `apiThrottler()` — 429 xatosi umuman bo'lmaydi |
| API suiiste'moli | Foydalanuvchi boshiga daqiqasiga `API_RATE_LIMIT_PER_MIN` so'rov |
| Baza ulanishlari | Poolda cheklangan + `statement_timeout` |

Bitta 2 vCPU / 4 GB server bunday yukni bemalol ko'taradi. Yetmay qolsa:
`PG_POOL_MAX` ni sozlab, PM2 `instances` ni oshiring (webhook rejimida).

---

## Yangilash va kengaytirish

- **Matn yoki tugma o'zgartirish** → faqat `src/bot/texts.ts` / `src/bot/keyboards.ts`
- **Yangi bosqichli funksiya** → `steps.ts` ga nom, `handlers/` ga funksiya,
  `textRouter.ts` ga bitta qator
- **Bazaga yangi jadval** → `src/db/migrations/006_….sql` yarating; bot keyingi
  ishga tushishida avtomatik qo'llaydi (eski ma'lumot yo'qolmaydi)
- **Mini App dizayni** → `miniapp/styles.css` dagi `:root` o'zgaruvchilari

---

## Admin

Botda `/admin`:

- ➕/➖ Balans qo'shish / ayirish
- ⛔ Ban / Unban
- 💵 Stars narxi
- 💱 **TON kursi** (1 TON = X so'm) — Gift Arenda narxlariga ta'sir qiladi
- 🧾 **Xizmat haqi** — har bir yangi ijara uchun bir martalik
- 🎁 Gift qo'shish / ro'yxati
- 📱 Telegram akkaunt qo'shish / statistikasi
- 🖼 **Arenda statistikasi** (faol ijaralar, navbat, katalog holati)
- 📢 Broadcast

Alohida buyruq: `/diag` — Telegram bog'lanishi diagnostikasi.

---

## Sog'liq tekshiruvi

```
GET /healthz
```

Baza ulanishi, ishlash vaqti va katalog holatini qaytaradi. Monitoring
(UptimeRobot, Grafana) shu manzilni kuzatishi mumkin.

---

## Eslatmalar

- `.github/workflows/static.yml` — eski GitHub Pages workflow'i. Bu loyiha
  endi Node.js serveri, statik sayt emas; Pages deploy'i hech narsa bermaydi.
  Kerak bo'lmasa o'chirib tashlash mumkin.
- `Display on Telegram` avtomatlashtirilmagan — foydalanuvchi buni Fragment
  ilovasida qo'lda yoqadi (Mini App'dagi qadamlar shuni tushuntiradi).
