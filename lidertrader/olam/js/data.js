/* ============================================================
   KRIPTO OLAMI — dunyo ma'lumotlari (kontent)
   Hech qanday tashqi kutubxona ishlatilmaydi: sayt file:// dan
   ham to'liq ishlaydi.
   ============================================================ */
window.LT = window.LT || {};

LT.DATA = {

  /* ---------- Darajalar ---------- */
  levels: [
    { lvl: 1,  xp: 0,    title: "Yangi kelgan",      note: "Olamga birinchi qadam" },
    { lvl: 2,  xp: 120,  title: "Kashfiyotchi",      note: "Blok va zanjirni bilasiz" },
    { lvl: 3,  xp: 300,  title: "Hamyon egasi",      note: "Kalitlarni o'zingiz saqlaysiz" },
    { lvl: 4,  xp: 550,  title: "Savdogar",          note: "Bank va bozor farqini bilasiz" },
    { lvl: 5,  xp: 850,  title: "Tahlilchi",         note: "Raqamlar ortini ko'rasiz" },
    { lvl: 6,  xp: 1200, title: "Ko'prikchi",        note: "Zanjirlar orasida yurasiz" },
    { lvl: 7,  xp: 1600, title: "Xavfsizlik nozirisi", note: "Tuzoqlarni uzoqdan tanidingiz" },
    { lvl: 8,  xp: 2100, title: "Zanjir ustasi",     note: "Texnologiyani tushunasiz" },
    { lvl: 9,  xp: 2700, title: "Lider",             note: "Boshqalarga o'rgata olasiz" },
    { lvl: 10, xp: 3400, title: "LIDER TRADER",      note: "Olamning to'liq kartasi qo'lingizda" }
  ],

  /* ---------- Ittifoqlar (bir xil "til"dagi zanjirlar) ---------- */
  unions: [
    {
      id: "evm",
      name: "EVM Ittifoqi",
      short: "EVM",
      color: "#7C8CFF",
      members: ["eth", "bsc", "polygon"],
      blurb: "Bir xil pasport, bir xil til, uchta alohida davlat.",
      lesson: [
        "EVM Ittifoqi — bu Yevropa Ittifoqiga o'xshaydi. Ichidagi davlatlar (Ethereum, BNB Chain, Polygon) alohida, o'z bayrog'i, o'z bojxona narxi (gas) va o'z tezligi bor. Lekin ular bitta <b>til</b>da gapiradi: Solidity, va bitta xil <b>pasport</b> ishlatadi — <span class=\"mono\">0x</span> bilan boshlanadigan manzil.",
        "Shuning uchun MetaMask hamyoningiz uchtasida ham ishlaydi va bitta manzilingiz uchtasida ham bir xil ko'rinadi. <b>Lekin diqqat:</b> bir xil manzil — bir xil hisob degani emas. Ethereum'dagi 100 dollaringiz BNB Chain'da avtomatik paydo bo'lmaydi; buning uchun <b>ko'prik</b> kerak.",
        "Eng ko'p uchraydigan xato shu: odam tokenni Ethereum tarmog'idan BNB Chain manziliga yuboradi. Manzil bir xil ko'ringani uchun \"to'g'ri yubordim\" deb o'ylaydi, lekin pul boshqa davlatning ichida qolib ketadi."
      ]
    }
  ],

  /* ---------- Zanjirlar = o'lkalar/shaharlar ---------- */
  chains: [
    {
      id: "eth", union: "evm",
      name: "Etheria", coin: "ETH", real: "Ethereum",
      role: "Ittifoq poytaxti — qonun va shartnomalar shahri",
      color: "#8A92FF", glow: "#B4B9FF",
      x: 400, y: 430, r: 98,
      stats: { consensus: "Proof of Stake", tps: "~15 (L1)", fee: "$0.5 – $20", block: "12 sek", final: "~13 daqiqa" },
      addr: "0x71C4...9B3F",
      story: [
        "Etheria — olamning huquq shahri. Uning ko'chalarida <b>smart-kontrakt</b> degan avtomatik notariuslar ishlaydi: shartni bir marta yozib qo'yasiz, keyin hech kim (yozgan odam ham) uni o'zgartira olmaydi.",
        "Shahar sekin va qimmat, chunki har bir qog'oz mingdan ortiq notarius tomonidan tekshiriladi. Buning evaziga bu yerda yozilgan shartnomani buzib bo'lmaydi. Dunyodagi eng ko'p DeFi va NFT shu shaharda tug'ilgan."
      ],
      pros: ["Eng ko'p dastur va likvidlik", "Juda katta xavfsizlik zaxirasi", "Qoidalar ochiq, kod tekshirilgan"],
      cons: ["Band paytda komissiya qimmat", "Sekin tasdiqlash", "Yangi boshlovchi uchun qimmat mashq maydoni"]
    },
    {
      id: "bsc", union: "evm",
      name: "Binansgrad", coin: "BNB", real: "BNB Chain",
      role: "Savdo-sanoat shahri — arzon, tez, gavjum",
      color: "#F0B90B", glow: "#FFD75E",
      x: 660, y: 296, r: 84,
      stats: { consensus: "Proof of Staked Authority", tps: "~100+", fee: "$0.05 – $0.50", block: "3 sek", final: "~7 sek" },
      addr: "0x71C4...9B3F",
      story: [
        "Binansgrad — bozor shahri. Hamma narsa arzon va tez: bir tranzaksiya bir piyola choy narxida. Shu sababli bu yerda yangi tokenlar har kuni yuzlab paydo bo'ladi.",
        "Lekin arzonlikning narxi bor: shaharni nazorat qiluvchi validatorlar soni kam va ular bir-biriga yaqin. Ya'ni bu yerda \"hamma qarshi bo'lsa to'xtatib bo'lmaydi\" degan gap Etheriaga qaraganda ancha kuchsiz."
      ],
      pros: ["Juda arzon komissiya", "Tez tasdiqlash", "Mashq qilish uchun qulay"],
      cons: ["Markazlashuv darajasi yuqori", "Firibgar tokenlar soni juda ko'p", "\"Arzon\" degani \"xavfsiz\" degani emas"]
    },
    {
      id: "polygon", union: "evm",
      name: "Poligonsk", coin: "POL", real: "Polygon",
      role: "Ittifoqning tashqi tumani — L2 ustaxonasi",
      color: "#A36CF5", glow: "#C9A3FF",
      x: 505, y: 688, r: 76,
      stats: { consensus: "PoS + rollup", tps: "~2 000", fee: "$0.001 – $0.05", block: "2 sek", final: "L1'ga bog'liq" },
      addr: "0x71C4...9B3F",
      story: [
        "Poligonsk — Etheriaga yopishib turgan sanoat tumani. U ishni o'zida qiladi, keyin kunlik hisobotni poytaxtga (Etheriaga) bitta paket qilib topshiradi.",
        "Shu sababli bu yerda komissiya tiyinlarda. Bu \"scaling\" (kengaytirish) degan g'oyaning eng sodda ta'rifi: <b>ishni pastda qil, isbotni yuqoriga yubor</b>."
      ],
      pros: ["Juda arzon", "Ethereum xavfsizligiga tayanadi", "O'yin va mikro-to'lovlar uchun qulay"],
      cons: ["Ko'prik orqali kirish-chiqish kerak", "Ba'zi yechimlarda chiqish muddati uzoq", "Texnik jihatdan murakkabroq"]
    },
    {
      id: "ton",
      name: "Telegramgrad", coin: "TON", real: "TON",
      role: "Messenjer respublikasi — telefondagi shahar",
      color: "#3BA3F0", glow: "#8FD2FF",
      x: 985, y: 232, r: 88,
      stats: { consensus: "Proof of Stake (sharding)", tps: "yuqori (shardlar)", fee: "$0.005 atrofida", block: "~5 sek", final: "tez" },
      addr: "UQBk...7dK2",
      story: [
        "Telegramgrad — messenjer ichiga qurilgan shahar. Bu yerda hamyon alohida ilova emas, chatning bir qismi: pul yuborish xabar yuborishdan deyarli farq qilmaydi.",
        "Manzillar <span class=\"mono\">0x</span> bilan emas, boshqa shaklda yoziladi — demak bu EVM Ittifoqi emas, alohida davlat. Tokenlar ham boshqacha ataladi: <b>Jetton</b>.",
        "Qulaylik yaxshi, lekin bir xavfi bor: bu yerda firibgarlik chatda, tanish odam ovozi bilan keladi. Bitta tugma bosish — bitta tranzaksiya."
      ],
      pros: ["Telefon uchun juda qulay", "Arzon va tez", "Mini-ilovalar ekosistemasi katta"],
      cons: ["Chat orqali firibgarlik ko'p", "EVM bilan mos emas (boshqa manzil, boshqa til)", "Yosh ekosistema"]
    },
    {
      id: "btc",
      name: "Satoshi qal'asi", coin: "BTC", real: "Bitcoin",
      role: "Oltin qal'a — sekin, qimmat, buzilmas",
      color: "#F7931A", glow: "#FFC46B",
      x: 1235, y: 630, r: 100,
      stats: { consensus: "Proof of Work", tps: "~7", fee: "$1 – $30", block: "10 daqiqa", final: "~60 daqiqa (6 blok)" },
      addr: "bc1q...84fk",
      story: [
        "Satoshi qal'asi — olamning eng qadimgi va eng qattiq qo'rg'oni. Uning devorini elektr energiyasi bilan qurilgan <b>Kon</b> (mining) ushlab turadi: har blokni yozish uchun haqiqiy quvvat sarflanadi.",
        "Bu yerda smart-kontrakt shahri yo'q, DeFi yo'q, NFT bozori deyarli yo'q. Qal'aning bitta ishi bor va u shu ishni dunyoda eng ishonchli qiladi: <b>qiymatni saqlash va uzatish</b>.",
        "Qal'aning oltin zaxirasi cheklangan: hammasi bo'lib 21 million tanga. Har to'rt yilda yangi tanga chiqishi ikki barobar kamayadi — buni <b>halving</b> deydi."
      ],
      pros: ["Eng yuqori xavfsizlik tarixi", "Cheklangan emissiya (21 mln)", "Hamma joyda tan olinadi"],
      cons: ["Sekin (blok 10 daqiqa)", "Dastur imkoniyati kam", "Kichik to'lov uchun noqulay"]
    },
    {
      id: "zec",
      name: "Soya shahri", coin: "ZEC", real: "Zcash",
      role: "Maxfiylik shahri — ko'rinmas pochta",
      color: "#5FD6C4", glow: "#A8FFF0",
      x: 845, y: 700, r: 78,
      stats: { consensus: "Proof of Work + zk-SNARK", tps: "~7", fee: "juda arzon", block: "~75 sek", final: "tez" },
      addr: "t1Kd... / u1qz...",
      story: [
        "Soya shahri — pochtasi ikki xil bo'lgan yagona shahar. Oddiy pochta (<b>t-manzil</b>) hammaga ko'rinadi: kim kimga qancha yuborganini har qanday odam o'qiy oladi. Ikkinchisi — <b>ekranlangan pochta</b> (z/u-manzil): xat yopiq konvertda ketadi.",
        "Bu sehr emas, matematika: <b>zk-SNARK</b> deb ataladigan isbot. U \"menda pul bor va qoidani buzmadim\" deganini <em>pulni ko'rsatmasdan</em> isbotlaydi.",
        "Nega muhim? Chunki oddiy blokcheynda maoshingiz, qarzingiz va xaridlaringiz umumiy ko'chada osilgan e'londek turadi. Maxfiylik — yashirinish emas, oddiy insoniy huquq. Shu bilan birga qonun talablari ham bor: shahar <b>ko'rish kaliti</b> (viewing key) degan yechim beradi — kerak bo'lsa faqat siz tanlagan odamga hisobingizni ochib ko'rsatasiz."
      ],
      pros: ["Haqiqiy maxfiylik imkoniyati", "Ko'rish kaliti bilan tekshiruvga ochiqlik", "Kuchli kriptografiya (zk)"],
      cons: ["Ekranlangan tranzaksiya ko'proq resurs oladi", "Ba'zi birjalar maxfiy aktivlarni cheklaydi", "Foydalanuvchi xatosi maxfiylikni buzadi (t-manzilga qaytish)"]
    },
    {
      id: "sol",
      name: "Tezlik vodiysi", coin: "SOL", real: "Solana",
      role: "Magistral — sekundda minglab mashina",
      color: "#59F0A8", glow: "#A8FFD4",
      x: 1315, y: 330, r: 82,
      stats: { consensus: "PoS + Proof of History", tps: "1 000 – 3 000+", fee: "$0.001 dan kam", block: "~0.4 sek", final: "~13 sek" },
      addr: "7xKX...gAsU",
      story: [
        "Tezlik vodiysi — sakkiz qatorli magistral. Boshqa shaharlarda mashinalar navbatda turadi, bu yerda ular yonma-yon, bir vaqtda ketadi (parallel ishlov).",
        "Tezlikning narxi: yo'l murakkab, uni ushlab turish qiyin. Vodiy tarixida bir necha marta \"tirbandlik\" — tarmoq to'xtab qolgan kunlar bo'lgan.",
        "Bu yerda savdo arzon va tez, lekin firibgar tokenlar ham xuddi shunday tez tarqaladi: sekundda o'ylab qaror qabul qilishga majbur qiladigan muhit — tuzoq uchun eng qulay muhit."
      ],
      pros: ["Juda tez va arzon", "Savdo va o'yinlar uchun qulay", "Katta foydalanuvchi bazasi"],
      cons: ["Tarixda uzilishlar bo'lgan", "Validator uchun qimmat uskuna", "Scam tokenlar oqimi juda katta"]
    }
  ],

  /* ---------- Ko'priklar (yo'llar) ---------- */
  bridges: [
    { a: "eth", b: "bsc", kind: "internal", label: "Ittifoq yo'li" },
    { a: "eth", b: "polygon", kind: "native", label: "Rasmiy ko'prik" },
    { a: "bsc", b: "polygon", kind: "internal", label: "Ittifoq yo'li" },
    { a: "eth", b: "ton", kind: "bridge", label: "Xalqaro ko'prik" },
    { a: "eth", b: "sol", kind: "bridge", label: "Xalqaro ko'prik" },
    { a: "eth", b: "btc", kind: "wrapped", label: "Wrapped ko'prik" },
    { a: "eth", b: "zec", kind: "bridge", label: "Soya ko'prigi" },
    { a: "ton", b: "sol", kind: "bridge", label: "Xalqaro ko'prik" },
    { a: "btc", b: "zec", kind: "wrapped", label: "Qadimgi yo'l" }
  ],

  /* ---------- Nishonlar ---------- */
  badges: [
    { id: "first",     icon: "star",    name: "Birinchi qadam",     desc: "Birinchi darsni tugatdingiz" },
    { id: "hash",      icon: "cube",     name: "Blok ustasi",        desc: "Hash va zanjir demosini sindirdingiz" },
    { id: "keys",      icon: "key",      name: "Kalit sohibi",       desc: "Seed-fraza darsini o'tdingiz" },
    { id: "trap3",     icon: "shield",   name: "Sezgir",             desc: "3 ta tuzoqdan qutuldingiz" },
    { id: "trap8",     icon: "shield",   name: "Tuzoq buzari",       desc: "8 ta tuzoqdan qutuldingiz" },
    { id: "city3",     icon: "map",      name: "Sayohatchi",         desc: "3 shaharni to'liq tugatdingiz" },
    { id: "cityall",   icon: "crown",    name: "Olam kartasi",       desc: "Barcha shaharlarni tugatdingiz" },
    { id: "bridge",    icon: "bridge",   name: "Ko'prikchi",         desc: "Ko'prik darsini tugatdingiz" },
    { id: "privacy",   icon: "eye",      name: "Soya yo'lovchisi",   desc: "Maxfiylik darsini tugatdingiz" },
    { id: "quizace",   icon: "brain",    name: "Aniq javob",         desc: "10 testni birinchi urinishda yechdingiz" }
  ]
};
