/* ============================================================
   KRIPTO OLAMI — tuzoqlar (tasodifiy hodisalar)
   Har bir tuzoq: to'g'ri tanlov +XP, xato tanlov ball yo'qotadi,
   lekin har ikki holatda ham tushuntirish beriladi.
   ============================================================ */
LT.DATA.traps = [
  {
    id: "t-seed",
    title: "\"Qo'llab-quvvatlash xizmati\" yozdi",
    icon: "warning",
    from: "@Ton_Support_Official",
    text: "Assalomu alaykum! Hamyoningizda texnik xato aniqlandi. Mablag'ni tiklash uchun 12 so'zli tiklash frazangizni yuboring. Bu standart tekshiruv, 10 daqiqa ichida hal qilamiz.",
    choices: [
      { t: "12 so'zni yuboraman — rasmiy xizmat so'rayapti", ok: false },
      { t: "Hech narsa yubormayman, chatni bloklayman", ok: true },
      { t: "Faqat 6 so'zini yuboraman, qolganini bermayman", ok: false }
    ],
    why: "Hech qanday haqiqiy xizmat seed-frazani so'ramaydi — na to'liq, na yarmini. Rasmiy ko'rinishdagi ism, avatar va \"official\" so'zi bir daqiqada yasaladi. Seed so'ralgan payt suhbat tugaydi.",
    xp: 45, coins: 20
  },
  {
    id: "t-airdrop",
    title: "Sovg'a: 500 USDT airdrop",
    icon: "gift",
    from: "airdrop-claim-bonus.site",
    text: "Tabriklaymiz! Hamyoningiz 500 USDT sovg'aga tanlandi. Olish uchun hamyonni ulang va \"Approve\" tugmasini bosing (gas to'lash shart emas).",
    choices: [
      { t: "Ulayman va Approve bosaman — tekin pul", ok: false },
      { t: "Ulamayman. Tekin pul uchun ruxsat so'ramaydi", ok: true },
      { t: "Bo'sh hamyon bilan ulayman va ko'raman", ok: true }
    ],
    why: "\"Approve\" — bu sovg'a olish emas, kontraktga tokenlaringizni sarflash <b>ruxsati</b>. Cheksiz ruxsat berilsa, kontrakt hamyonni istagan paytda bo'shatadi. Bo'sh hamyon bilan tekshirish — professional odat.",
    xp: 45, coins: 20
  },
  {
    id: "t-honeypot",
    title: "Bir kunda +340% ko'tarilgan token",
    icon: "chart",
    from: "DEX skaneri",
    text: "Yangi token: grafik faqat yuqoriga qarab ketmoqda, 1 400 xarid, 0 sotuv. Telegram kanalda \"hozir kirmagan afsuslanadi\" deb yozilgan.",
    choices: [
      { t: "Kiraman — grafik kuchli", ok: false },
      { t: "0 sotuv — bu honeypot belgisi. Kirmayman", ok: true },
      { t: "Kichik summa bilan sinaymanu, sotib ko'raman", ok: true }
    ],
    why: "1 400 xarid va 0 sotuv — bu bozor emas, qopqon. Narx faqat o'sadi, chunki <b>hech kim sota olmaydi</b>. Kirishdan oldin darhol chiqishni sinash — eng arzon test.",
    xp: 50, coins: 25
  },
  {
    id: "t-p2p",
    title: "P2P: xaridor \"to'lovni yubordim\" deydi",
    icon: "swap",
    from: "P2P savdo",
    text: "Xaridor skrinshot yubordi: \"Pul o'tdi, bankda kechikish bor. Tokenni chiqaring, men ishonchli savdogarman, 400+ savdom bor\".",
    choices: [
      { t: "Skrinshot bor — chiqaraman", ok: false },
      { t: "Faqat bank hisobimga pul tushganini ko'rgach chiqaraman", ok: true },
      { t: "Yarmini chiqaraman", ok: false }
    ],
    why: "Skrinshot — rasm, pul emas. To'lov faqat <em>sizning hisobingizda</em> ko'ringanda to'lov bo'ladi. \"Ishonchli savdogar\" reytingi ham sotib olinadi yoki o'g'irlangan hisob bo'ladi.",
    xp: 45, coins: 20
  },
  {
    id: "t-network",
    title: "Tarmoq tanlash",
    icon: "bridge",
    from: "Hamyon",
    text: "Do'stingiz USDT so'radi va Binansgrad (BSC) manzilini berdi. Sizning USDT esa Etheriada turadi. Hamyon \"Yuborish\" oynasini ochdi.",
    choices: [
      { t: "Manzil bir xil ko'rinadi — to'g'ridan-to'g'ri yuboraman", ok: false },
      { t: "Avval ko'prik orqali o'tkazaman yoki do'stdan ETH manzilini so'rayman", ok: true },
      { t: "Birjaga yuboraman, u yerdan BSC'ga chiqaraman", ok: true }
    ],
    why: "EVM Ittifoqida manzil bir xil ko'rinadi, lekin tarmoq boshqa. Noto'g'ri tarmoqqa yuborilgan mablag'ni tiklash ko'p holatda imkonsiz. Ko'prik yoki birja — to'g'ri yo'l.",
    xp: 50, coins: 25
  },
  {
    id: "t-vip",
    title: "VIP signal kanali",
    icon: "megaphone",
    from: "@ProfitKing_VIP",
    text: "Oyiga 149$. Kanalda 12 ta ketma-ket g'alaba skrinshoti, \"92% aniqlik\", \"bugun oxirgi 5 joy\".",
    choices: [
      { t: "To'layman — 12 g'alaba isbot", ok: false },
      { t: "Yo'qotish skrinshotlari qayerda? Kirmayman", ok: true },
      { t: "Signallarni yozib boraman, lekin savdo qilmayman", ok: true }
    ],
    why: "Yuz odamga qarama-qarshi signal yuborilsa, yarmi har doim g'alaba chiqadi — skrinshot shundan tug'iladi. Kanal daromadi savdodan emas, <b>abonentdan</b>. Signalni bir oy yozib borish esa haqiqatni bir kunda ko'rsatadi.",
    xp: 45, coins: 20
  },
  {
    id: "t-clone",
    title: "Klon sayt",
    icon: "copy",
    from: "Google reklamasi",
    text: "Birja saytini qidirdingiz. Eng yuqorida reklama: <span class=\"mono\">binance-login.cc</span>. Dizayn aynan asl saytdek.",
    choices: [
      { t: "Bosaman — birinchi natija ishonchli", ok: false },
      { t: "Domenni tekshiraman, xatcho'pdagi manzildan kiraman", ok: true },
      { t: "Reklamani o'tkazib, pastdagi natijani bosaman", ok: false }
    ],
    why: "Firibgarlar reklama sotib oladi va bitta harf farqli domen qo'yadi. Yechim bitta: birja va hamyon saytlariga faqat <b>o'z xatcho'g'ingiz</b>dan kiring.",
    xp: 45, coins: 20
  },
  {
    id: "t-rug",
    title: "Likvidlik qulfi haqida savol",
    icon: "lock",
    from: "Loyiha admini",
    text: "\"Likvidlik qulflangan, xavotir olmang\" deb yozilgan. Skanerda esa: LP tokenlar jamoa hamyonida, qulf muddati ko'rsatilmagan.",
    choices: [
      { t: "Admin aytdi — ishonaman", ok: false },
      { t: "Qulf isbotini so'rayman; isbot bo'lmasa kirmayman", ok: true },
      { t: "Kichik summa qo'yaman, shundoq ham yo'qotsam bo'ladi", ok: false }
    ],
    why: "Qulf — tekshiriladigan fakt, va'da emas. LP tokenlar jamoa qo'lida bo'lsa, likvidlikni istagan payt olib ketishadi — narx bir daqiqada nolga tushadi (rug pull).",
    xp: 50, coins: 25
  },
  {
    id: "t-leverage",
    title: "Leverage taklifi",
    icon: "fire",
    from: "Birja bildirishnomasi",
    text: "\"x50 leverage bilan savdo qiling! 100$ bilan 5 000$ pozitsiya. Bugun komissiya yo'q!\"",
    choices: [
      { t: "Ochaman — kichik summa, katta imkoniyat", ok: false },
      { t: "x50'da 2% qarshi harakat hisobni nolga tushiradi. Ochmayman", ok: true },
      { t: "Demo hisobda sinab ko'raman", ok: true }
    ],
    why: "x50 leverage — narx 2% teskari ketsa likvidatsiya. Bozorda 2% harakat kunda bir necha marta bo'ladi. Leverage foydani emas, <b>xatoga chidamni</b> kamaytiradi.",
    xp: 50, coins: 25
  },
  {
    id: "t-fomo",
    title: "Do'stlar guruhida FOMO",
    icon: "users",
    from: "Guruh chati",
    text: "\"Men 3 kunda 4x qildim, hozir kirmasang ketib qolasan!\" — deydi tanish. Grafik allaqachon 6 barobar ko'tarilgan.",
    choices: [
      { t: "Kiraman, hamma kirdi", ok: false },
      { t: "Kechikkan poyezd — tushuntirish so'rayman va o'z rejam bo'yicha ishlayman", ok: true },
      { t: "Kuzatuv ro'yxatiga qo'shaman, keyin tahlil qilaman", ok: true }
    ],
    why: "FOMO — reja emas, hissiyot. \"Hamma kirgan\" payt — sotuvchilarga xaridor kerak bo'lgan payt. G'alaba haqida gapiradiganlar yo'qotish haqida jim turadi.",
    xp: 45, coins: 20
  },
  {
    id: "t-signer",
    title: "Imzolash oynasi",
    icon: "pen",
    from: "Hamyon",
    text: "Sayt imzo so'radi. Oynada: <span class=\"mono\">setApprovalForAll(0x9f..21, true)</span> va \"Spending cap: unlimited\".",
    choices: [
      { t: "Imzolayman, tugmalar odatdagidek", ok: false },
      { t: "Rad etaman — cheksiz ruxsat va ApprovalForAll xavfli", ok: true },
      { t: "Faqat kerakli miqdorga ruxsat berishga harakat qilaman", ok: true }
    ],
    why: "<span class=\"mono\">setApprovalForAll</span> — barcha NFT'laringizni boshqarish huquqi. \"Unlimited\" — cheksiz sarflash ruxsati. Imzolash oynasi o'qilmasa, u himoya bo'lmaydi.",
    xp: 50, coins: 25
  },
  {
    id: "t-recovery",
    title: "\"Yo'qotgan pulingizni qaytaramiz\"",
    icon: "lifering",
    from: "@CryptoRecovery_Team",
    text: "\"Oldin firibgarlikka uchragansiz. Biz blokcheyn mutaxassislarimiz, mablag'ni qaytaramiz. Faqat 15% oldindan to'lov.\"",
    choices: [
      { t: "To'layman — bir urinib ko'rsam bo'ladi", ok: false },
      { t: "Bu ikkilamchi firibgarlik. To'lamayman", ok: true },
      { t: "Avval isbot so'rayman, keyin to'layman", ok: false }
    ],
    why: "Tranzaksiyani orqaga qaytarish texnik jihatdan imkonsiz. \"Qaytarib beruvchilar\" — aldangan odamlar ro'yxati bo'yicha ishlaydigan ikkinchi to'lqin firibgarlar. Oldindan to'lov so'ralgan payt javob aniq.",
    xp: 50, coins: 25
  }
];
