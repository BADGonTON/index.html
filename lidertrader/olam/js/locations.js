/* ============================================================
   KRIPTO OLAMI — shahar ichidagi joylar (darslar)
   ============================================================ */
LT.DATA.locations = [

  /* ================= ETHERIA (ETH) ================= */
  {
    id: "eth-maktab", chain: "eth", type: "school",
    name: "Blokcheyn maktabi", icon: "school", x: 250, y: 180,
    tagline: "Blok nima, zanjir nima, hash nima",
    analogy: "Blokcheyn — bu shahar arxivi: har sahifa muhrlangan va sahifalar bir-biriga tikilgan.",
    lesson: [
      "<b>Blok</b> — bu daftardagi bitta sahifa. Unga shu daqiqada bo'lgan pul o'tkazmalari yoziladi, ustiga vaqt qo'yiladi va sahifaga <b>muhr</b> bosiladi.",
      "Muhr — <b>hash</b>. Bu sahifadagi matndan hisoblanadigan uzun raqam. Matnda bitta vergul o'zgarsa, muhr butunlay boshqacha chiqadi. Ya'ni muhrga qarab \"bu sahifa tegilganmi?\" deb bilib olish mumkin.",
      "<b>Zanjir</b> (chain) — har sahifaning yuqorisiga <em>oldingi sahifaning muhri</em> ko'chirib yoziladi. Shu sababli 100-sahifani o'zgartirsangiz, uning muhri o'zgaradi va 101-sahifadagi ko'chirma to'g'ri kelmay qoladi. Keyin 102, 103... — hammasini qaytadan yozish kerak bo'ladi.",
      "Va eng muhimi: bu arxivning nusxasi bitta binoda emas, minglab kompyuterda turadi. Sizning sahifangizni o'zgartirish uchun ularning yarmidan ko'pini bir vaqtda aldash kerak. Amalda — imkonsiz."
    ],
    demo: "hash",
    quiz: [
      { q: "Blok ichidagi bitta harf o'zgarsa nima bo'ladi?", a: ["Hech nima, sahifa shundayligicha qoladi", "Hash (muhr) butunlay o'zgaradi va zanjir buziladi", "Faqat vaqt belgisi yangilanadi"], c: 1,
        why: "Hash butun matndan hisoblanadi — bitta belgi o'zgarsa, muhr boshqa chiqadi va keyingi bloklardagi ko'chirma to'g'ri kelmaydi." },
      { q: "Nega blokcheynni \"o'zgarmas\" deyishadi?", a: ["Chunki kod maxfiy", "Chunki bitta yozuvni o'zgartirish uchun keyingi barcha bloklarni qayta hisoblash va tarmoqning yarmini aldash kerak", "Chunki uni hukumat nazorat qiladi"], c: 1,
        why: "Sehr yo'q — shunchaki matematik bog'liqlik va nusxalarning ko'pligi." }
    ],
    xp: 70, coins: 25
  },
  {
    id: "eth-notarius", chain: "eth", type: "tower",
    name: "Smart-kontrakt notariusi", icon: "contract", x: 520, y: 150,
    tagline: "Kodga yozilgan shart — o'zi bajariladi",
    analogy: "Smart-kontrakt — bu avtomat: tanga tashlasangiz, mahsulot chiqaradi. Kayfiyati yo'q, lekin ichiga nima yozilgan bo'lsa, shuni qiladi.",
    lesson: [
      "Smart-kontrakt — blokcheynga joylangan kichik dastur. U \"agar shunday bo'lsa, shuni qil\" degan qoidani odamning ishtirokisiz bajaradi. Bankda bu ishni xodim qiladi; bu yerda — kod.",
      "Kuchli tomoni: kodni hech kim keyin o'zgartira olmaydi va uni har kim o'qib ko'rishi mumkin.",
      "Xavfli tomoni ham <em>aynan shu</em>: ichiga zararli qoida yozilgan bo'lsa ham, u sizni aldab, qoidasini bajaradi. Masalan: \"sotib olish mumkin, sotish faqat egasiga ruxsat\". Bu <b>honeypot</b>.",
      "Shuning uchun olamda bitta oddiy odat bor: pul qo'yishdan oldin kontraktni tekshir. Buni ChainShield idorasida o'rganasiz."
    ],
    demo: "contract",
    quiz: [
      { q: "Kontrakt kodi ochiq bo'lsa, u avtomatik xavfsizmi?", a: ["Ha, ochiq kod = xavfsiz", "Yo'q — ochiq kod ichida ham zararli qoida yozilgan bo'lishi mumkin", "Faqat Ethereum'da xavfsiz"], c: 1,
        why: "Ochiqlik — tekshirish imkoniyati, kafolat emas. Tekshirmagan odam uchun ochiq kod ham yopiq." }
    ],
    xp: 60, coins: 20
  },
  {
    id: "eth-bozor", chain: "eth", type: "market",
    name: "Qora bozor (DEX)", icon: "market", x: 790, y: 230,
    tagline: "Hech kim so'roq qilmaydi — hech kim javob bermaydi",
    analogy: "DEX — bu qora bozor: hech qanday hujjat so'ralmaydi, hamma narsani sotish mumkin, va sizni hech kim himoya qilmaydi.",
    lesson: [
      "<b>DEX</b> (markazlashmagan birja) — bu do'kon emas, maydon. Ro'yxatdan o'tish yo'q, hujjat yo'q, ma'mur yo'q. Hamyoningizni ulaysiz va to'g'ridan-to'g'ri smart-kontrakt bilan savdo qilasiz.",
      "Narx qanday paydo bo'ladi? Do'konda emas — <b>likvidlik pulida</b>. Idishda ikkita aktiv turadi, masalan 10 ETH va 30 000 USDT. Siz ETH sotib olsangiz, idishdan ETH kamayadi, USDT ko'payadi — va narx o'sha zahoti o'zgaradi. Bu <b>slippage</b>.",
      "Kichik idish = katta xavf. Likvidligi 3 000 dollarlik tokenga 1 000 dollar bilan kirsangiz, narxni o'zingiz ko'tarasiz, chiqishda esa o'zingiz tushirasiz.",
      "Eng katta xavf: idishni egasi olib qo'yishi mumkin (<b>rug pull</b>). Shundan keyin tokenni sotib bo'lmaydi — xaridor qolmaydi."
    ],
    demo: "pool",
    quiz: [
      { q: "DEX'da token savdoga chiqishi uchun kim ruxsat beradi?", a: ["Birja ma'muriyati tekshiradi", "Hech kim — har qanday odam istagan tokenini qo'shishi mumkin", "Davlat litsenziya beradi"], c: 1,
        why: "Aynan shuning uchun DEX'da minglab firibgar token bor. Tekshirish — sizning vazifangiz." },
      { q: "Likvidlik puli kichik bo'lsa nima bo'ladi?", a: ["Narx barqaror turadi", "Sizning buyrug'ingiz narxni kuchli siljitadi (slippage)", "Komissiya nolga tushadi"], c: 1,
        why: "Kichik idishda har bir chelak suv sathni o'zgartiradi." }
    ],
    xp: 80, coins: 30
  },
  {
    id: "eth-zavod", chain: "eth", type: "factory",
    name: "Token zavodi", icon: "factory", x: 250, y: 430,
    tagline: "Coin va token — farqi nimada?",
    analogy: "Coin — davlatning o'z valyutasi. Token — shu davlatda chiqarilgan chipta yoki aksiya. Chipta chiqarish uchun davlat qurish shart emas.",
    lesson: [
      "<b>Coin</b> — zanjirning o'z tangasi: ETH Etheriada, BNB Binansgradda, BTC qal'ada, TON Telegramgradda. Komissiya shu tangada to'lanadi.",
      "<b>Token</b> — mavjud zanjir ustida smart-kontrakt bilan chiqarilgan aktiv. Uni chiqarish uchun 10 daqiqa va bir necha dollar kifoya. Zavodda bugun kechqurun \"420 000 000 000 LIDER\" nomli token yasash mumkin.",
      "Demak: <b>\"bizning o'z tangamiz bor\" degan gap hech narsani isbotlamaydi.</b> Qiymat tokenning borligidan emas, ortidagi haqiqiy foydalanishdan keladi.",
      "Diqqat qilinadigan raqamlar: umumiy emissiya, aylanmadagi qism, jamoa qo'lidagi ulush va uning qulflanish muddati. Agar jamoa qo'lida 40% bo'lsa — bir kunda bozorga tushsa nima bo'ladi?"
    ],
    demo: "factory",
    quiz: [
      { q: "Token chiqarish qanchalik qiyin?", a: ["Yillar va katta jamoa kerak", "Bir necha daqiqa va bir necha dollar komissiya", "Faqat bank ruxsati bilan"], c: 1,
        why: "Shuning uchun \"o'z tokeni bor\" degani ishonch belgisi emas." },
      { q: "Market cap nimani ko'rsatadi?", a: ["Loyihaga kirgan haqiqiy pulni", "Narx × aylanmadagi miqdorni — u shishirilishi mumkin", "Jamoaning bank hisobini"], c: 1,
        why: "Likvidligi 5 000 dollarlik tokenning \"kapitalizatsiyasi\" 50 million bo'lishi mumkin. Bu raqam sizga chiqish imkonini bermaydi." }
    ],
    xp: 75, coins: 30
  },
  {
    id: "eth-galereya", chain: "eth", type: "gallery",
    name: "NFT galereyasi", icon: "gallery", x: 540, y: 430,
    tagline: "Rasm zanjirda emas — havola zanjirda",
    analogy: "NFT — muzey kitobidagi yozuv: \"bu asar shu odamga tegishli\". Asarning o'zi esa boshqa binoda osilgan turadi.",
    lesson: [
      "<b>NFT</b> — takrorlanmas raqamli guvohnoma. Odatda uning ichida rasm yo'q: zanjirda faqat <b>metadata</b> — ya'ni rasmga havola turadi.",
      "Agar rasm oddiy serverda saqlanayotgan bo'lsa va server o'chsa — sizda bo'sh guvohnoma qoladi. Shu sababli yaxshi loyihalar rasmni IPFS kabi tarqatilgan saqlashda qo'yadi.",
      "NFT sotib olish avtomatik ravishda mualliflik huquqini bermaydi. Nimaga ega bo'lganingiz kontrakt va litsenziyada yozilgan.",
      "Bozordagi asosiy illyuziya — <b>wash trading</b>: bir odam o'zidan o'ziga sotib, \"savdo hajmi katta\" degan ko'rinish yasaydi."
    ],
    demo: "nft",
    quiz: [
      { q: "NFT sotib olsangiz, rasm qayerda turadi?", a: ["Butunlay blokcheyn ichida", "Ko'pincha tashqi saqlashda; zanjirda faqat havola", "Sizning telefoningizda"], c: 1,
        why: "Shuning uchun \"metadata qayerda saqlanadi?\" — NFT tekshirishning birinchi savoli." }
    ],
    xp: 65, coins: 25
  },
  {
    id: "eth-garov", chain: "eth", type: "vault",
    name: "Garov idorasi (staking)", icon: "stake", x: 790, y: 470,
    tagline: "Tangani garovga qo'yib tarmoqni qo'riqlash",
    analogy: "Staking — tarmoqqa garov qo'yib qo'riqchi bo'lish. Qoidani buzsangiz, garov kesiladi.",
    lesson: [
      "Etheria <b>Proof of Stake</b>da ishlaydi: blok yozish huquqi ko'p elektr sarflagan emas, ko'p <em>garov</em> qo'ygan validatorga tegadi.",
      "Siz tangani garovga qo'yasiz, tarmoq sizga mukofot beradi. Buzsangiz — garovning bir qismi kesiladi (<b>slashing</b>).",
      "Diqqat: \"staking\" so'zi firibgarlikda eng ko'p ishlatiladigan so'zlardan biri. Haqiqiy staking foydasi tarmoq emissiyasi va komissiyalardan keladi — bu odatda yillik bir necha foiz. \"Kuniga 3%\" degan joyda daromad yangi kelganlarning pulidan to'lanadi; bu piramida.",
      "Savol berish odati: <b>daromad qayerdan kelmoqda?</b> Javob bo'lmasa — javob bor: sizning pulingizdan."
    ],
    demo: "stake",
    quiz: [
      { q: "\"Kuniga 3% kafolatlangan staking\" nima?", a: ["Yaxshi imkoniyat", "Deyarli aniq piramida — daromad yangi kelganlarning pulidan", "Oddiy bank depoziti"], c: 1,
        why: "Yillik 3 000%+ hech qanday real emissiyadan chiqmaydi." }
    ],
    xp: 70, coins: 25
  },
  {
    id: "eth-koprik", chain: "eth", type: "bridge",
    name: "Ko'prik stansiyasi", icon: "bridge", x: 250, y: 660,
    tagline: "Bir shahardan boshqasiga qanday o'tiladi",
    analogy: "Ko'prik — chegaradagi bojxona: tangani bu tomonda seyfga qo'yadi, u tomonda o'sha qiymatdagi \"nusxa\" beradi.",
    lesson: [
      "Zanjirlar bir-birini ko'rmaydi. Etheriadagi ETH o'z-o'zidan Telegramgradda paydo bo'lmaydi. O'tish uchun <b>ko'prik</b> kerak.",
      "Ko'prik qanday ishlaydi: aktivingiz birinchi zanjirda <b>qulflanadi</b> (lock), ikkinchi zanjirda esa unga teng <b>o'ram</b> (wrapped) token chiqariladi. Qaytishda teskarisi: o'ram yoqiladi (burn), asl aktiv ochiladi.",
      "Ya'ni qo'lingizdagi <span class=\"mono\">WBTC</span> — Bitcoin emas, Bitcoinning tilxati. Tilxat esa uni chiqargan tizim buzilmaganicha ishlaydi.",
      "Shuning uchun kripto tarixidagi eng katta o'g'irliklarning bir qismi aynan ko'priklarda bo'lgan. Qoida: ko'prikda uzoq turmang, faqat kerakli miqdorni o'tkazing va mashhur, audit qilingan ko'prikni tanlang.",
      "Eng ko'p uchraydigan yo'qotish esa oddiy: <b>noto'g'ri tarmoqqa yuborish</b>. Manzil bir xil ko'rinsa ham, tarmoq boshqa bo'lsa — pul yetib bormaydi."
    ],
    demo: "bridge",
    quiz: [
      { q: "WBTC nima?", a: ["Bitcoinning o'zi", "Bitcoin garovga qo'yilganini bildiruvchi tilxat (wrapped token)", "Yangi coin"], c: 1,
        why: "Tilxat — chiqargan tizimga bog'liq risk. Bu Bitcoin qal'asining xavfsizligi emas." },
      { q: "Tokenni noto'g'ri tarmoqqa yuborsangiz?", a: ["Avtomatik qaytadi", "Ko'p holatda yo'qoladi — tranzaksiyani orqaga qaytarish mumkin emas", "Birja topib beradi"], c: 1,
        why: "Blokcheynda \"bekor qilish\" tugmasi yo'q. Shuning uchun avval kichik summa bilan sinash kerak." }
    ],
    xp: 90, coins: 35, badge: "bridge"
  },

  /* ================= BINANSGRAD (BSC) ================= */
  {
    id: "bsc-bank", chain: "bsc", type: "bank",
    name: "Markaziy bank (CEX)", icon: "bank", x: 300, y: 200,
    tagline: "Qulay, tartibli — lekin kalit sizda emas",
    analogy: "CEX — bu bank: eshigida qorovul, ichida hujjat, hisobingiz esa bankning daftarida yozilgan raqam.",
    lesson: [
      "<b>CEX</b> (markazlashgan birja) — kompaniya. Ro'yxatdan o'tasiz, hujjat topshirasiz (KYC), pul kiritasiz. Savdo kompaniya serverida, buyruqlar kitobida bo'ladi.",
      "Qulay tomoni: qulay interfeys, qo'llab-quvvatlash xizmati, yo'qolgan parolni tiklash, bank kartasi bilan kirish.",
      "Muhim tomoni: aktiv <b>sizning hamyoningizda emas</b>. Birja sizga faqat daftardagi yozuvni ko'rsatadi. Birja to'xtasa, hisobni muzlatsa yoki bankrot bo'lsa — yozuv qoladi, aktiv yo'q. Tarixda bunday yirik holatlar bir necha bor bo'lgan.",
      "Shuning uchun olamning eng qisqa maqoli: <b>\"Kalit sizda bo'lmasa, tanga ham sizda emas\"</b>. Savdo uchun birjada turing, saqlash uchun o'z hamyoningizga chiqaring."
    ],
    demo: "custody",
    quiz: [
      { q: "Birjadagi balansingiz nima?", a: ["Sizning hamyoningizdagi aktiv", "Birja daftaridagi yozuv — kalit birjada", "Bankdagi omonat sug'urtasi"], c: 1,
        why: "Custodial hisob: kalit egasi — birja. Shuning uchun uzoq saqlash uchun o'z hamyoni kerak." },
      { q: "CEX va DEX'ning asosiy farqi?", a: ["CEX'da kalit kompaniyada, DEX'da kalit sizda", "DEX qimmatroq", "CEX'da token ko'proq"], c: 0,
        why: "Qolgan hamma farq shundan kelib chiqadi: KYC, qo'llab-quvvatlash, muzlatish imkoniyati." }
    ],
    xp: 80, coins: 30
  },
  {
    id: "bsc-tungi", chain: "bsc", type: "alley",
    name: "Tungi ko'cha", icon: "warning", x: 640, y: 190,
    tagline: "Olamdagi eng ko'p pul shu ko'chada yo'qoladi",
    analogy: "Tungi ko'cha — chiroqsiz bozor: hamma kulib turadi, hamma shoshiltiradi, hamma \"do'sting\".",
    lesson: [
      "Bu yerda texnologiya emas, <b>odam</b> aldanadi. Sxemalar 5 yildan buyon o'zgarmaydi, faqat nomi almashadi:",
      "<b>1. Seed-fraza o'g'irligi.</b> \"Qo'llab-quvvatlash xizmati\" yozadi va 12 so'zni so'raydi. Haqiqiy xizmat hech qachon so'ramaydi. So'ragan odam — o'g'ri.",
      "<b>2. Soxta airdrop.</b> \"Sovg'a olish uchun hamyonni ulang va ruxsat bering\". Ruxsat (approve) bergan zahoti kontrakt hamyonni bo'shatadi.",
      "<b>3. VIP signal.</b> Yuz odamga bir-biriga qarama-qarshi signal yuboriladi. G'alaba chiqqan yarmiga skrinshot ko'rsatiladi, qolgani o'chiriladi. Kanal daromadi savdodan emas — abonent to'lovidan.",
      "<b>4. P2P \"qotib qolgan balans\".</b> Panelda raqam ko'rinadi, yechishda \"soliq to'lang\" deyiladi. Raqam — shunchaki matn, ortida aktiv yo'q.",
      "Bitta oddiy qoida hammasini yechadi: <b>shoshiltirgan har qanday taklif — tuzoq</b>. Haqiqiy imkoniyat sizni kutadi, firibgarlik esa kuta olmaydi."
    ],
    demo: "traps",
    quiz: [
      { q: "Qo'llab-quvvatlash xizmati seed-frazani so'radi. Nima qilasiz?", a: ["Faqat 6 so'zini yuboraman", "Hech narsa yubormayman — bu 100% firibgarlik", "Skrinshot yuboraman"], c: 1,
        why: "Seed-fraza faqat siz uchun. Uni so'ragan har qanday odam — o'g'ri. Yarmi ham bo'lmaydi." },
      { q: "\"30 daqiqa qoldi, tez kirmasang ketib qolasan\" — bu nima?", a: ["Ehtimol yaxshi imkoniyat", "Shoshiltirish — firibgarlikning asosiy quroli", "Oddiy marketing, xavfsiz"], c: 1,
        why: "Shoshilinch qaror — tahlilsiz qaror. Firibgarga aynan shu kerak." }
    ],
    xp: 100, coins: 40
  },
  {
    id: "bsc-gaz", chain: "bsc", type: "highway",
    name: "Gaz stansiyasi", icon: "fuel", x: 460, y: 470,
    tagline: "Komissiya nimadan tuzilgan va nega turlicha",
    analogy: "Gaz — yo'l bojxonasi. Yo'l qancha tor va gavjum bo'lsa, boj shuncha qimmat.",
    lesson: [
      "Har bir tranzaksiya tarmoqdan joy so'raydi. Joy cheklangan, shuning uchun narx auksionga o'xshaydi: kim ko'p to'lasa, o'shaning ishi tez bajariladi.",
      "Shuning uchun bir xil o'tkazma Etheriada 12 dollar, Binansgradda 15 sent, Poligonskda esa 1 tiyin turishi mumkin.",
      "Lekin arzonlik tekin emas: arzon zanjirlarda odatda validator kamroq yoki talab yengilroq — ya'ni markazlashuv yuqori. \"Arzon\" va \"xavfsiz\" bir narsa emas.",
      "Amaliy maslahat: birinchi tranzaksiyani har doim eng kichik summada, arzon tarmoqda mashq qilib ko'ring."
    ],
    demo: "speed",
    quiz: [
      { q: "Nega bir tarmoqda komissiya qimmat, boshqasida arzon?", a: ["Kompaniya narx belgilaydi", "Joy cheklangan va narx talab-taklifga qarab auksionda shakllanadi", "Valyuta kursi tufayli"], c: 1,
        why: "Blok ichidagi joy — cheklangan resurs. Bandlik oshsa, narx oshadi." }
    ],
    xp: 60, coins: 20
  },

  /* ================= POLIGONSK ================= */
  {
    id: "poly-rollup", chain: "polygon", type: "workshop",
    name: "Rollup ustaxonasi", icon: "layers", x: 420, y: 250,
    tagline: "L1, L2 va \"kengaytirish\" nima degani",
    analogy: "Rollup — marshrutka: 40 odam alohida taksi olmaydi, hammasi bitta mashinada boradi va yo'l pulini bo'lishadi.",
    lesson: [
      "<b>L1</b> — asosiy zanjir (Etheria). U xavfsiz, lekin sekin va qimmat.",
      "<b>L2</b> — ustiga qurilgan qatlam. Minglab tranzaksiyani o'zida bajaradi, keyin hammasini <em>bitta</em> paket qilib L1'ga yozib qo'yadi. Har bir yo'lovchi yo'l pulini bo'lishganidan komissiya tushadi.",
      "Ikki xil rollup bor: <b>optimistik</b> (\"ishonamiz, lekin da'vo qilish muddati bor\") va <b>zk</b> (\"matematik isbot bilan darhol tasdiqlanadi\").",
      "Siz uchun amaliy ma'no: L2'da savdo arzon, lekin pulni kiritish-chiqarish uchun ko'prik kerak va chiqish vaqti ba'zan uzoq bo'ladi."
    ],
    demo: "rollup",
    quiz: [
      { q: "L2 nega arzon?", a: ["Xavfsizlikni butunlay tashlab yuborgani uchun", "Ko'p tranzaksiyani bitta paketga yig'ib L1 narxini bo'lishgani uchun", "Chunki tokeni arzon"], c: 1,
        why: "Marshrutka printsipi: umumiy xarajat yo'lovchilar soniga bo'linadi." }
    ],
    xp: 70, coins: 25
  },
  {
    id: "poly-bojxona", chain: "polygon", type: "gate",
    name: "Ittifoq bojxonasi", icon: "gate", x: 720, y: 380,
    tagline: "Bir xil manzil, boshqa davlat",
    analogy: "Bir xil pasport bilan uch davlatga kirasiz — lekin hisobingiz har birida alohida.",
    lesson: [
      "EVM Ittifoqida manzilingiz uchta zanjirda ham bir xil: <span class=\"mono\">0x71C4...9B3F</span>. Shu sababli yangi boshlovchi \"hisobim hamma joyda bir\" deb o'ylaydi.",
      "Haqiqatda har bir zanjir alohida daftar yuritadi. Etheriadagi 100 USDT Poligonskda ko'rinmaydi.",
      "Shuning uchun har bir o'tkazmada ikki narsa tekshiriladi: <b>manzil</b> va <b>tarmoq</b>. Ikkinchisini tekshirmaslik — eng ko'p uchraydigan qimmat xato.",
      "Hamyonda tarmoqni almashtirish odatini hoziroq shakllantiring: har o'tkazmadan oldin yuqoridagi tarmoq nomiga qarab oling."
    ],
    demo: null,
    quiz: [
      { q: "Bir xil 0x manzil uchta EVM zanjirida bir xil hisobni bildiradimi?", a: ["Ha, hisob umumiy", "Yo'q — har zanjir alohida daftar, faqat manzil shakli bir xil", "Faqat Ethereum va Polygon'da"], c: 1,
        why: "Manzil — eshik raqami. Har shaharda o'sha raqamli eshik bor, lekin ichidagi narsa boshqa." }
    ],
    xp: 60, coins: 20
  },

  /* ================= TELEGRAMGRAD (TON) ================= */
  {
    id: "ton-ustaxona", chain: "ton", type: "workshop",
    name: "Hamyon ustaxonasi", icon: "key", x: 300, y: 200,
    tagline: "12 so'z = butun boyligingiz",
    analogy: "Seed-fraza — uyingizning ustki kaliti. Uni ko'rgan odam qulfni almashtirishga ham hojat sezmaydi.",
    lesson: [
      "Hamyon pul saqlamaydi — <b>kalit</b> saqlaydi. Kalit bo'lsa, zanjirdagi aktivni harakatlantirasiz; kalit yo'q bo'lsa, aktiv abadiy qotib qoladi.",
      "<b>Ochiq manzil</b> — pochta manzilingiz, hammaga bering. <b>Yopiq kalit</b> va undan kelib chiqadigan <b>seed-fraza</b> (12/24 so'z) — hech kimga, hech qachon.",
      "Qoidalar: qog'ozga yozing; skrinshot qilmang; bulutga, galereyaga, chatga saqlamang; \"tekshirish uchun\" so'raganlarga bermang.",
      "Va yana biri: hamyonni birinchi marta yaratganda kichik summa bilan sinab ko'ring. Tiklash ishlashiga ishonch hosil qilgandan keyingina katta summa saqlang."
    ],
    demo: "seed",
    quiz: [
      { q: "Seed-frazani qayerda saqlash to'g'ri?", a: ["Telefon galereyasida skrinshot", "Qog'ozda, offlayn, ikki nusxada turli joyda", "Email o'zimga yuborib"], c: 1,
        why: "Har qanday raqamli nusxa — zaifchilik. Qog'oz zerikarli, lekin ishlaydi." },
      { q: "Hamyonni tiklash uchun nima kerak?", a: ["Parol va email", "Seed-fraza", "Qo'llab-quvvatlash xizmatining ruxsati"], c: 1,
        why: "Non-custodial hamyonda \"parolni tiklash\" tugmasi yo'q — faqat seed." }
    ],
    xp: 90, coins: 35, badge: "keys"
  },
  {
    id: "ton-jetton", chain: "ton", type: "factory",
    name: "Jetton do'koni", icon: "coin", x: 620, y: 200,
    tagline: "TON'dagi token — boshqa standart",
    analogy: "Har davlatning o'z hujjat blankasi bor: EVM'da ERC-20, Telegramgradda Jetton.",
    lesson: [
      "Telegramgradda tokenlar <b>Jetton</b> deb ataladi. Ish printsipi bir xil: smart-kontrakt aktiv chiqaradi va balanslarni yuritadi.",
      "Lekin texnik tuzilishi boshqa: TON'da har bir egaga alohida \"hamyon kontrakti\" tegishli bo'ladi. Shuning uchun EVM'dagi ba'zi vositalar bu yerda ishlamaydi.",
      "Amaliy xulosa: token nomi va logotipi aldamchi. \"USDT\" yozilgan har qanday jetton — haqiqiy USDT emas. Har doim <b>kontrakt manzilini</b> rasmiy manbadan tekshirib oling.",
      "Telegramgradda bitta o'ziga xos xavf ham bor: tanish chatdan kelgan havola. Bosishdan oldin manzilni o'qing — bitta harf farq qilsa, bu klon sayt."
    ],
    demo: null,
    quiz: [
      { q: "Tokenni qanday aniq tanib olish mumkin?", a: ["Nomi va logotipi bo'yicha", "Kontrakt manzili bo'yicha (rasmiy manbadan tekshirib)", "Telegram kanalidagi e'lon bo'yicha"], c: 1,
        why: "Nom va logotipni har kim ko'chiradi. Kontrakt manzili — yagona haqiqiy identifikator." }
    ],
    xp: 65, coins: 25
  },
  {
    id: "ton-maydon", chain: "ton", type: "plaza",
    name: "Mini-ilovalar maydoni", icon: "app", x: 460, y: 450,
    tagline: "Qulaylik va xavf bir tugmada",
    analogy: "Chatdagi o'yin ichida to'lov tugmasi — bu qulaylik. Aynan shu tugma tuzoq ham bo'lishi mumkin.",
    lesson: [
      "Telegramgradning kuchi: ilova o'rnatish shart emas, hamma narsa chat ichida. Bu millionlab odamni kriptoga olib kirdi.",
      "Xavf ham shundan: hamyon har doim yoningizda va tasdiqlash bitta tugma. Firibgar sizga tanish do'st ovozi bilan yozadi va \"o'yinga kiraylik\" deydi.",
      "Har bir tasdiqlashdan oldin ikkita savolni o'qish odatini qiling: <b>qaysi kontraktga</b> va <b>qanday ruxsat</b> berilmoqda?",
      "Va asosiysi: ruxsatlarni vaqti-vaqti bilan tozalab turing. Eski, keraksiz ruxsat — ochiq qolgan eshik."
    ],
    demo: null,
    quiz: [
      { q: "Mini-ilova to'lovni tasdiqlashni so'radi. Birinchi nima qilasiz?", a: ["Tez tasdiqlayman, o'yin kutmaydi", "Qaysi kontrakt va qanday ruxsat so'ralayotganini o'qiyman", "Do'stimdan so'rayman"], c: 1,
        why: "Tasdiqlash oynasi — oxirgi himoya chizig'i. Uni o'qimaslik — uni o'chirish bilan teng." }
    ],
    xp: 60, coins: 20
  },

  /* ================= SATOSHI QAL'ASI (BTC) ================= */
  {
    id: "btc-kon", chain: "btc", type: "mine",
    name: "Kon (mining)", icon: "pickaxe", x: 300, y: 200,
    tagline: "Proof of Work — quvvat bilan yozilgan daftar",
    analogy: "Mining — bu lotereya: har kim sekundda milliard marta raqam sinab ko'radi, kim topsa — blok yozadi.",
    lesson: [
      "Blok yozish uchun mayner shunday raqam (<b>nonce</b>) topishi kerak bo'ladi, natijadagi hash bir nechta nol bilan boshlansin. Formula qisqa, lekin javobni faqat sinab ko'rib topiladi.",
      "Har 10 daqiqada bitta blok chiqishi uchun tarmoq masalaning <b>qiyinligini</b> avtomatik sozlaydi. Mayner ko'paysa — qiyinlik oshadi.",
      "Nega bu xavfsizlik beradi? Chunki eski blokni o'zgartirish uchun o'sha quvvatni qaytadan sarflash kerak — va tarmoqning qolgan qismidan tezroq.",
      "Shuning uchun \"Bitcoinni hakerlar buzdi\" degan xabar odatda yolg'on: buziladigan narsa odatda <em>birja</em> yoki <em>foydalanuvchi hamyoni</em>, tarmoq emas."
    ],
    demo: "pow",
    quiz: [
      { q: "Mayner aslida nima qiladi?", a: ["Tangani \"chop etadi\"", "Hash shartini qondiradigan raqamni sinab topadi va blok yozadi", "Narxni ko'taradi"], c: 1,
        why: "Ish — hisoblash. Mukofot — yangi tanga va komissiya." }
    ],
    xp: 80, coins: 30
  },
  {
    id: "btc-xazina", chain: "btc", type: "vault",
    name: "Xazina va halving", icon: "vault", x: 640, y: 200,
    tagline: "21 million va har 4 yilda ikki barobar kamayish",
    analogy: "Xazinaga har blokda oltin tushadi, lekin har 4 yilda chelak yarimlanadi.",
    lesson: [
      "Bitcoin emissiyasi qat'iy: har blokda mayner ma'lum miqdorda yangi BTC oladi. Har 210 000 blokda (taxminan 4 yil) bu miqdor <b>ikki barobar kamayadi</b> — halving.",
      "Shu sababli umumiy miqdor 21 milliondan oshmaydi va oxirgi tangalar 2140-yillarda chiqadi.",
      "Bu \"narx o'sadi\" degani emas. Bu faqat <em>taklif</em> tomonini aniq qiladi; talab tomoni esa bozorga bog'liq.",
      "Muhim ma'lumot: BTC bo'linadi. Eng kichik birlik — <b>satoshi</b>, ya'ni 0.00000001 BTC. \"Bitcoin qimmat, menga yetmaydi\" degan gap noto'g'ri: 10 dollarga ham satoshi olish mumkin."
    ],
    demo: "halving",
    quiz: [
      { q: "Halving nima?", a: ["Narxning ikki barobar oshishi", "Mayner mukofotining ikki barobar kamayishi", "Komissiyaning tushishi"], c: 1,
        why: "Bu emissiya jadvalidagi qoida, narx kafolati emas." }
    ],
    xp: 70, coins: 25
  },
  {
    id: "btc-pochta", chain: "btc", type: "post",
    name: "Sekin pochta", icon: "mail", x: 460, y: 450,
    tagline: "Tasdiqlash nima va nechta kerak",
    analogy: "Tranzaksiya — pochtaga tashlangan xat. Tasdiq — uning yetib borgani haqidagi muhr.",
    lesson: [
      "Yuborilgan tranzaksiya avval <b>mempool</b>ga — navbatga tushadi. Keyin mayner uni blokka oladi: bu <b>1-tasdiq</b>.",
      "Har yangi blok tasdiqni bittaga oshiradi. Katta summalar uchun odatda 3–6 tasdiq kutiladi, chunki juda kichik ehtimol bilan zanjirning uchi qayta yozilishi mumkin.",
      "Komissiya kam bo'lsa, xat navbatda uzoq qoladi. Shoshilinch bo'lsa — ko'proq to'lanadi.",
      "Muhim: \"yuborildi\" degan yozuv yetib borgani emas. Qabul qiluvchi tomon tasdiqni kutadi."
    ],
    demo: "mempool",
    quiz: [
      { q: "Tranzaksiya 0 tasdiq bilan tursa nima degani?", a: ["Pul yetib bordi", "Navbatda, hali blokka kirmagan", "Bekor qilingan"], c: 1,
        why: "Blokka kirmagan tranzaksiya — hali yozilmagan xat." }
    ],
    xp: 65, coins: 25
  },

  /* ================= SOYA SHAHRI (ZEC) ================= */
  {
    id: "zec-pochta", chain: "zec", type: "post",
    name: "Ekranlangan pochta", icon: "shieldlock", x: 320, y: 200,
    tagline: "zk-isbot: ko'rsatmasdan isbotlash",
    analogy: "Ekranlangan tranzaksiya — yopiq konvert: pochta uni yetkazadi, lekin ichidagini o'qimaydi.",
    lesson: [
      "Oddiy blokcheynda hamma narsa ochiq: kim, kimga, qancha. Bu ko'pincha noqulay — maoshingiz yoki qarzingiz hammaga ko'rinib turishini hech kim xohlamaydi.",
      "Soya shahri <b>zk-SNARK</b> ishlatadi: tranzaksiya \"qoidalarni buzmadim, pulim yetarli\" deganini <em>summani va manzilni oshkor qilmasdan</em> matematik isbotlaydi.",
      "Zanjirda isbot yozilib qoladi, ma'lumot esa yopiq. Tekshirish mumkin, o'qish mumkin emas.",
      "Diqqat: maxfiylik foydalanuvchining o'zi buzadi. Pulni ekranlangan manzilga olib, keyin ochiq t-manzil orqali birjaga yuborsangiz — zanjir bo'g'ini qayta ulanadi."
    ],
    demo: "privacy",
    quiz: [
      { q: "zk-isbot nimani ta'minlaydi?", a: ["Ma'lumotni ko'rsatmasdan uning to'g'riligini isbotlashni", "Tranzaksiyani bekor qilishni", "Komissiyani nolga tushirishni"], c: 0,
        why: "\"Bilaman, lekin aytmayman — va buni isbotlay olaman\" degan g'oya." }
    ],
    xp: 85, coins: 30, badge: "privacy"
  },
  {
    id: "zec-niqob", chain: "zec", type: "workshop",
    name: "Niqob ustaxonasi", icon: "mask", x: 640, y: 200,
    tagline: "t-manzil va z/u-manzil farqi",
    analogy: "Ikki xil konvert: shaffof plastik va qalin qog'oz. Ikkisi ham xat tashiydi, ammo biri hammaga o'qiladi.",
    lesson: [
      "<b>t-manzil</b> (transparent) — Bitcoin uslubida: hamma ko'radi. <b>z/u-manzil</b> (shielded/unified) — ekranlangan: summa va tomonlar yopiq.",
      "Bir hisobda ikkisini aralashtirib ishlatish — eng ko'p uchraydigan xato. Ekranlangan pulni ochiq manzilga chiqarsangiz, kuzatuvchi zanjirni tiklab oladi.",
      "Qoida oddiy: ekranlangan mablag'ni ekranlangan holatda saqlang; birjaga chiqarish kerak bo'lsa, buni ongli ravishda qiling.",
      "Va shuni bilib qo'ying: maxfiylik jinoyat emas. Bank hisobingizni ham hamma ko'rib turmaydi. Bu shunchaki oddiy holat blokcheynga ko'chirilishi."
    ],
    demo: null,
    quiz: [
      { q: "Ekranlangan mablag'ni ochiq t-manzil orqali birjaga yubordingiz. Natija?", a: ["Maxfiylik saqlanadi", "Bog'liqlik oshkor bo'ladi — zanjir tiklanadi", "Tranzaksiya bekor bo'ladi"], c: 1,
        why: "Maxfiylikni kriptografiya beradi, lekin foydalanuvchi xatosi uni bekor qiladi." }
    ],
    xp: 70, coins: 25
  },
  {
    id: "zec-chegara", chain: "zec", type: "gate",
    name: "Ko'rish kaliti idorasi", icon: "eye", x: 480, y: 450,
    tagline: "Maxfiylik va hisobot bir vaqtda",
    analogy: "Ko'rish kaliti — auditorga beriladigan nusxa kalit: u faqat o'qiydi, pulni harakatlantirmaydi.",
    lesson: [
      "Maxfiylik bilan qonun talabi qarama-qarshi tuyuladi. Soya shahrining yechimi — <b>viewing key</b> (ko'rish kaliti).",
      "Bu kalit faqat <em>ko'rish</em> huquqini beradi: buxgalter, auditor yoki soliq organi hisobingizni tekshiradi, lekin pulni harakatlantira olmaydi.",
      "Ya'ni tanlov \"hammaga ochiq\" yoki \"hech kimga ko'rinmas\" emas. To'g'ri javob: <b>kimga ko'rinishini siz tanlaysiz</b>.",
      "Amaliy jihat: birjalar turlicha ishlaydi — ba'zilari ekranlangan depozitni qabul qilmaydi. Oldin qoidani o'qing, keyin yuboring."
    ],
    demo: null,
    quiz: [
      { q: "Ko'rish kaliti nima imkon beradi?", a: ["Pulni o'tkazishga", "Faqat hisobni ko'rishga", "Kontraktni o'zgartirishga"], c: 1,
        why: "Faqat o'qish huquqi. Shuning uchun uni auditorga berish xavfsiz." }
    ],
    xp: 65, coins: 25
  },

  /* ================= TEZLIK VODIYSI (SOL) ================= */
  {
    id: "sol-magistral", chain: "sol", type: "highway",
    name: "Sakkiz qatorli magistral", icon: "speed", x: 320, y: 210,
    tagline: "Tezlik qanday qo'lga kiritiladi",
    analogy: "Bir qatorli yo'lda navbat, sakkiz qatorli yo'lda parallel harakat. Lekin sakkiz qatorni ushlab turish qiyinroq.",
    lesson: [
      "Ko'p zanjirlar tranzaksiyalarni navbatda, birin-ketin bajaradi. Tezlik vodiysi bir-biriga tegmaydigan tranzaksiyalarni <b>parallel</b> bajaradi — shuning uchun sekundda minglab amal chiqadi.",
      "Buning narxi: validator uchun kuchli uskuna talab qiladi va tizim murakkab. Murakkab tizim ko'proq buziladi — tarixda uzilishlar bo'lgan.",
      "Xulosa: <b>uchburchak qoidasi</b> — tezlik, markazlashmaganlik va xavfsizlik. Uchtasini birdan maksimal qilib bo'lmaydi; har zanjir bittasidan qurbon beradi.",
      "Loyihani baholayotganda \"qaysi tomonini qurbon qilgan?\" degan savol sizni reklamadan himoya qiladi."
    ],
    demo: "speed",
    quiz: [
      { q: "Uchburchak qoidasi nimani aytadi?", a: ["Hamma zanjir bir xil", "Tezlik, xavfsizlik va markazlashmaganlik — uchtasi birdan maksimal bo'lmaydi", "Tez zanjir har doim yaxshi"], c: 1,
        why: "Har bir dizayn — murosa. \"Eng yaxshi zanjir\" emas, \"shu ish uchun mos zanjir\" bor." }
    ],
    xp: 75, coins: 28
  },
  {
    id: "sol-muzey", chain: "sol", type: "museum",
    name: "To'xtash muzeyi", icon: "museum", x: 640, y: 210,
    tagline: "Uzilishlar tarixi va nega bu muhim",
    analogy: "Muzeyda to'xtab qolgan magistral fotosuratlari osilgan — har biri bitta dars.",
    lesson: [
      "Vodiy tarixida tarmoq to'xtab qolgan kunlar bo'lgan. O'sha paytda hech kim savdo qila olmagan — ochiq pozitsiyalarni yopish ham mumkin bo'lmagan.",
      "Bu texnik nosozlik tarixi emas, <b>risk darsi</b>: agar strategiyangiz \"kerakli daqiqada chiqaman\" degan taxminga tayansa, tarmoq to'xtashi shu taxminni buzadi.",
      "Shuning uchun professional yondashuv: pozitsiya hajmini oldindan chegaralash va bitta tarmoqqa hammasini bog'lamaslik.",
      "Har bir zanjirning kuchli va zaif tomoni bor. Tanlash — imon masalasi emas, vazifa masalasi."
    ],
    demo: null,
    quiz: [
      { q: "Tarmoq to'xtab qolsa, eng katta risk nima?", a: ["Kalitlar yo'qoladi", "Kerakli paytda pozitsiyani yopa olmaslik", "Tokenlar o'chib ketadi"], c: 1,
        why: "Risk-menejment har doim \"eng yomon holatda nima bo'ladi?\" degan savoldan boshlanadi." }
    ],
    xp: 60, coins: 20
  },

  /* ================= CHAINSHIELD SHTABI ================= */
  {
    id: "hq-shield", chain: "hq", type: "hq",
    name: "ChainShield shtabi", icon: "shield", x: 480, y: 300,
    tagline: "Shartnomani tekshirishni amalda o'rganish",
    analogy: "Shtab — olamning xavfsizlik boshqarmasi. Bu yerda tuzoqlar laboratoriyada, xavfsiz muhitda ochiladi.",
    lesson: [
      "Nazariyani o'qish bilan firibgarlikni tanib olish o'rganilmaydi — buni faqat ko'rib, bosib, sinab o'rganish mumkin.",
      "Shtabda uch simulyator bor: shartnoma auditi (honeypot va yashirin soliqni ko'rsatadi), \"VIP signal va haqiqat\" grafigi, hamda P2P tuzog'ining pul oqimi.",
      "Hammasi to'qima ma'lumotlarda ishlaydi: hech qanday real hamyon, real shartnoma yoki real narx yo'q.",
      "Tekshiruv ro'yxatini yodda tuting: kod tasdiqlanganmi, likvidlik qulflanganmi, egalik kimda, eng katta 10 hamyon necha foiz, sotish tranzaksiyalari bormi, soliq o'zgartiriladimi."
    ],
    demo: "shield",
    quiz: [
      { q: "Tekshiruvda qaysi belgi eng xavfli?", a: ["Loyihaning logotipi chiroyli emas", "Likvidlik qulflanmagan va sotish tranzaksiyalari yo'q", "Telegram kanali yangi"], c: 1,
        why: "Qulflanmagan likvidlik + sotish yo'qligi = honeypot yoki rug pull uchun tayyor sahna." }
    ],
    xp: 80, coins: 30
  }
];
