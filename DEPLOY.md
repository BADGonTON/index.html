# Serverga o'rnatish (domen bilan)

Sizda domen bor — quyidagi qadamlar bilan Mini App to'liq ishlaydi.
Butun jarayon ~20 daqiqa.

---

## 0. Avval: eski maxfiy ma'lumotlarni almashtiring ⚠️

Eski `.env.example` fayllarida haqiqiy kalitlar bor edi. Ular endi
xavfsiz emas — **hoziroq almashtiring**:

| Nima | Qayerdan |
|---|---|
| 🔴 **TON mnemonic** | Yangi hamyon yarating, pulni ko'chiring. Eski hamyonni tashlab yuboring. |
| 🔴 Bot tokeni | @BotFather → `/revoke` → yangi token |
| 🔴 MarketApp tokeni | MarketApp kabinetidan qayta generatsiya |
| 🟡 Toncenter kaliti | toncenter.com dan yangisi |
| 🟡 Karta raqami | Zarur bo'lsa boshqasiga almashtiring |

Mnemonic eng muhimi: uni bilgan odam hamyondagi hamma pulni oladi.

---

## 1. Server tayyorlash

Ubuntu 22.04+ / Debian 12+, 2 vCPU / 4 GB yetarli.

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql nginx certbot python3-certbot-nginx git
sudo npm install -g pm2
```

## 2. Baza

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE hozirol;
CREATE USER hozirol WITH PASSWORD 'KUCHLI_PAROL_QOYING';
GRANT ALL PRIVILEGES ON DATABASE hozirol TO hozirol;
\c hozirol
GRANT ALL ON SCHEMA public TO hozirol;
SQL
```

## 3. Loyihani o'rnatish

```bash
cd /opt
sudo git clone https://github.com/BADGonTON/index.html.git hozirol
sudo chown -R $USER:$USER hozirol
cd hozirol

npm ci
cp .env.example .env
nano .env          # to'ldiring (pastdagi jadvalga qarang)

npm run build
npm run migrate
```

### `.env` da eng muhim qatorlar

```ini
BOT_TOKEN=<yangi token>
ADMIN_IDS=<sizning Telegram ID>

PUBLIC_URL=https://sizning-domen.uz
BOT_MODE=webhook
WEBHOOK_SECRET=<openssl rand -hex 32 natijasi>

DATABASE_URL=postgresql://hozirol:KUCHLI_PAROL_QOYING@localhost:5432/hozirol

MARKETAPP_API_TOKEN=<yangi token>
TON_MNEMONIC="<yangi hamyonning 24 so'zi>"
```

## 4. Domen va SSL

DNS'da `A` yozuvini serveringiz IP'siga yo'naltiring, keyin:

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/hozirol
sudo nano /etc/nginx/sites-available/hozirol      # domenni almashtiring
sudo ln -s /etc/nginx/sites-available/hozirol /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo certbot --nginx -d sizning-domen.uz          # bepul SSL
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Ishga tushirish

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup          # chiqqan buyruqni nusxalab bajaring
pm2 logs hozirol
```

Loglarda quyidagilarni ko'rishingiz kerak:

```
✅ PostgreSQL ulanishi tayyor
✅ Bot: @sizning_bot
💎 TON hamyon: EQ…
💾 Katalog bazadan tiklandi / 🔄 Katalog yangilandi: 24 kolleksiya, 812 gift
✅ Server 8080-portda
✅ Mini App: https://sizning-domen.uz/app
✅ Webhook o'rnatildi
🎉 Hammasi tayyor!
```

## 6. Tekshirish

```bash
curl https://sizning-domen.uz/healthz
# {"ok":true,...,"catalog":{"gifts":812,...}}
```

Botda `/start` bosing → **«🖼 Gift Arenda»** tugmasi chiqishi kerak.

---

## Yangilash

```bash
cd /opt/hozirol
git pull
npm ci
npm run build
pm2 reload hozirol
```

Migratsiyalar ishga tushishda avtomatik qo'llanadi — ma'lumot yo'qolmaydi.

---

## Zaxira nusxa (majburiy)

```bash
# Kunlik zaxira (crontab -e ga qo'shing)
0 3 * * * pg_dump -U hozirol hozirol | gzip > /var/backups/hozirol-$(date +\%F).sql.gz
```

`.env` faylini ham alohida, xavfsiz joyda saqlang.

---

## Yuk oshganda

`BOT_MODE=webhook` bo'lgani uchun bir nechta nusxa ishlatish mumkin:

```js
// ecosystem.config.cjs
instances: 4,
exec_mode: "cluster",
```

va `.env` da `PG_POOL_MAX=15` (4 × 15 = 60 ulanish, PostgreSQL default
`max_connections=100` ichida).

nginx allaqachon `upstream` orqali balanslaydi. Sessiya, navbat va TON
hamyon qulfi bazada bo'lgani uchun nusxalar bir-biriga xalaqit bermaydi.

---

## Muammolarni hal qilish

| Belgi | Sabab / yechim |
|---|---|
| Mini App ochilmaydi | `PUBLIC_URL` `https://` bilan boshlanishi shart; SSL sertifikat haqiqiy bo'lsin |
| Bot javob bermaydi | `pm2 logs`; webhook o'rnatilganini tekshiring: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo` |
| Katalog bo'sh | `MARKETAPP_API_TOKEN` noto'g'ri yoki Marketapp yiqilgan — loglarda `❌ Katalogni yangilab bo'lmadi` |
| `TX_EXPIRED` | Hamyonda TON yetarli emas yoki tarmoq band; `MAX_RETRIES` dan keyin pul avtomatik qaytariladi |
| `too many connections` | `PG_POOL_MAX` × instance soni > `max_connections` — kamaytiring |
