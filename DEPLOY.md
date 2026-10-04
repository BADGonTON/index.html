# Botni to'xtovsiz ishlatish

## Hozirgi xato: `EADDRINUSE :::8080`

```
Error: listen EADDRINUSE: address already in use :::8080
```

**Sabab:** botning eski nusxasi hali ishlab turibdi va 8080-portni band
qilgan. Ikkinchi nusxa o'sha portni ololmaydi.

**Nima uchun bu jiddiy:** ikkita nusxa bir vaqtda ishlasa, ikkalasi ham
Telegram'dan yangilanish oladi va bitta buyurtma ikki marta bajarilishi
mumkin. Shuning uchun port band bo'lsa bot ataylab ishga tushmaydi.

### Darhol hal qilish

Kim portni band qilganini ko'ring:

```bash
sudo lsof -i :8080
```

Keyin eski nusxani to'xtating:

```bash
# Xizmat sifatida ishlayotgan bo'lsa
sudo systemctl stop hozirol

# yoki qo'lda ishga tushirilgan bo'lsa
sudo fuser -k 8080/tcp
```

Endi ishga tushiring. Lekin `npm start` bilan emas — quyidagini o'qing.

---

## To'g'ri yo'l: systemd xizmati

`npm start` bilan ishga tushirilgan bot **SSH oynasini yopsangiz o'ladi**,
server qayta yuklansa ko'tarilmaydi va yiqilsa qayta tiklanmaydi.
systemd bularning uchalasini ham hal qiladi.

### Bir martalik o'rnatish

```bash
cd /root/hozirol

# DIQQAT: `--omit=dev` QO'YMANG. `npm run build` TypeScript bilan
# kompilyatsiya qiladi, typescript esa devDependency — dev paketlarsiz
# "tsc: not found" bo'ladi.
#
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 — playwright faqat testlar uchun,
# brauzerlari ~100 MB va serverda kerak emas.
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

npm run build          # TypeScript → dist/
npm prune --omit=dev   # build tugadi — dev paketlar endi kerak emas (93 MB → 34 MB)

sudo cp deploy/hozirol.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hozirol
```

Tamom. Bot endi:

- **yiqilsa** — 3 soniyada o'zi qayta ishga tushadi
- **server qayta yuklansa** — o'zi ko'tariladi
- **SSH yopilsa** — ishlayveradi

### Kundalik buyruqlar

```bash
sudo systemctl status hozirol      # holati
sudo systemctl restart hozirol     # qayta ishga tushirish
sudo systemctl stop hozirol        # to'xtatish
journalctl -u hozirol -f           # loglar (jonli)
journalctl -u hozirol -n 200       # oxirgi 200 qator
```

### Kodni yangilaganda (git pull)

```bash
cd /root/hozirol
git pull
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci
npm run build
npm prune --omit=dev
sudo systemctl restart hozirol
```

### Kodni yangilaganda (yangi zip)

Yangi zip'ni ESKI papka USTIGA `unzip -o` qilib YOYMANG.
`unzip` faqat arxivdagi fayllarni yozadi, arxivda YO'Q fayllarni esa
joyida qoldiradi — ya'ni o'chirilgan eski `.ts` fayllar diskda qolib
ketadi. `tsconfig.json` butun `src/**/*.ts` ni kompilyatsiya qiladi,
shuning uchun o'sha qoldiq fayllar `npm run build` ni YIQITADI
(olib tashlangan funksiyalarga murojaat qiladi).

Butun papkani `rm -rf` qilish ham to'g'ri emas: u bilan birga `.env`
(bot tokeni, TON mnemonikasi) va `miniapp/media/guide.mp4` ham ketadi.
`.env` yo'qolsa xizmat ishga ham tushmaydi — `hozirol.service` dagi
`EnvironmentFile=/root/hozirol/.env` topilmaydi.

To'g'ri yo'l — eski papkani CHETGA SURIB, yangisini toza yoyish va
faqat o'z fayllaringizni qaytarish:

```bash
sudo systemctl stop hozirol

cd /root
cp hozirol/.env /root/env-zaxira          # zaxira, har ehtimolga
mv hozirol hozirol-eski                   # o'chirmaymiz — chetga suramiz

mkdir hozirol
unzip -q hozirol.zip -d hozirol

cp hozirol-eski/.env hozirol/.env
cp hozirol-eski/miniapp/media/guide.mp4 hozirol/miniapp/media/ 2>/dev/null

cd hozirol
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci
npm run build
npm prune --omit=dev

sudo systemctl start hozirol
sudo systemctl status hozirol --no-pager
journalctl -u hozirol -n 50 --no-pager
```

Bot ko'tarilib, ishlayotganiga ishonch hosil qilgandan keyin eski
papkani o'chirsangiz bo'ladi:

```bash
rm -rf /root/hozirol-eski
```

Migratsiyalar ishga tushishda **o'zi** qo'llanadi — qo'lda hech narsa
qilish shart emas. Allaqachon qo'llangan migratsiyalar `schema_migrations`
jadvalida qayd etilgan, shuning uchun fayli o'chirilgan eski
migratsiyalar bazaga qayta urinmaydi va xato bermaydi.

---

## Xizmat sog'ligini tekshirish

```bash
curl -s localhost:8080/healthz | head -c 300
```

Javob `{"ok":true,...}` bo'lsa — baza ham, katalog ham joyida.

Tashqaridan:

```bash
curl -s https://jettonify.xyz/healthz
```

---

## Nima qachon qayta ishga tushadi

| Holat | Nima bo'ladi |
|---|---|
| Ushlanmagan xato | Bot logga yozadi va **chiqadi**, systemd 3 soniyada qayta ko'taradi |
| Xotira oshib ketsa | Yadro to'xtatadi, systemd qayta ko'taradi |
| Server qayta yuklansa | `enable` qilingani uchun o'zi ko'tariladi |
| PostgreSQL o'chsa | Bot ishga tushmaydi va qayta urinadi (baza ko'tarilguncha) |
| 5 daqiqada 10 martadan ko'p yiqilsa | To'xtaydi — bu sozlama xatosini bildiradi, loglarni ko'ring |

Oxirgi qatordan keyin qayta ishga tushirish:

```bash
sudo systemctl reset-failed hozirol
sudo systemctl start hozirol
```

---

## Ma'lumotlar yo'qolmaydi

Bot to'xtaganda navbatdagi ishlar **bazada** qoladi:

- Stars/Premium buyurtmalari — `pending_txs`
- Gift Arenda ijaralari — `rent_jobs`
- FSM bosqichlari — `bot_sessions`
- To'lov oynalari — `payments`

Qayta ishga tushganda ular joyidan davom etadi. Yarim qolgan ish
`recoverStuckTxs()` orqali navbatga qaytariladi.

Shu sabab botni istalgan vaqtda to'xtatib, qayta ishga tushirish
xavfsiz — hech narsa yo'qolmaydi va pul ikki marta yechilmaydi.

---

## PM2 (muqobil)

systemd o'rniga PM2 ishlatmoqchi bo'lsangiz, `ecosystem.config.cjs`
tayyor:

```bash
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup            # chiqqan buyruqni nusxalab bajaring
```

**Ikkalasini birga ishlatmang** — ikkita nusxa bir vaqtda ishlaydi va
aynan `EADDRINUSE` xatosi qaytadi.

---

## Ko'p yuk bo'lganda

Bitta nusxa 100-200 ming foydalanuvchiga yetadi. Yana kerak bo'lsa:

1. `.env` da `BOT_MODE=webhook` bo'lsin (polling'da bitta nusxa ishlaydi)
2. Har bir nusxaga boshqa `PORT` bering
3. nginx orqali balanslang

Sessiya, navbat va qulflar PostgreSQL'da bo'lgani uchun nusxalar
bir-biriga xalaqit bermaydi: `FOR UPDATE SKIP LOCKED` tufayli bitta ish
faqat bitta nusxa tomonidan bajariladi.
