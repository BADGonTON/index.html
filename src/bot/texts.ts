/**
 * BARCHA MATNLAR VA TUGMA YOZUVLARI SHU FAYLDA.
 *
 * Botning "tili"ni o'zgartirmoqchi bo'lsangiz yoki matnni chiroyliroq qilmoqchi
 * bo'lsangiz — faqat shu faylni tahrirlang, boshqa hech qayerni o'zgartirish
 * shart emas. Placeholder'lar {shunday} ko'rinishida yozilgan, ularni fmt()
 * funksiyasi orqali to'ldiramiz.
 *
 * Premium (tg-premium) custom-emoji'lar Telegram Bot API HTML parse-mode'ida
 * <tg-emoji emoji-id="..."> tegi bilan ishlaydi — bu Premium foydalanuvchilar
 * uchun rangli/animatsion emoji ko'rsatadi, oddiy foydalanuvchilarga esa
 * tegdagi fallback emoji (masalan ⭐️) ko'rinadi. Shu sabab bot matnlari juda
 * "premium" va professional ko'rinadi.
 */

// --- CUSTOM EMOJI ID'LAR ---
export const I = {
  WAVE: "5472055112702629499", // 👋
  MONEY: "5375296873982604963", // 💰
  ROBOT: "5258093637450866522", // 🤖
  STAR: "5985305474101155474", // ⭐
  CROWN: "6008060777771045457", // 👑
  DOWN: "5231102735817918643", // 👇
  CASH: "5283232570660634549", // 💵
  PEOPLE: "5258513401784573443", // 👥
  CARD: "5377477003677015260", // 💳
  LINK: "5271604874419647061", // 🔗
  FLYMONEY: "5472030678633684592", // 💸
  CHART: "5028746137645876535", // 📊
  USER: "5256143829672672750", // 👤
  WARN: "5274099962655816924", // ❗️
  RIGHT: "5260450573768990626", // ➡️
  TIME: "5451732530048802485", // ⏳
  TIMER: "5382194935057372936", // ⏱
  CLOCK: "5440621591387980068", // 🕒
  CROSS: "5465665476971471368", // ❌
  PHOTO: "5258205968025525531", // 📸
  CHECK: "5258057130228849960", // ✅
  PARTY: "5436040291507247633", // 🎉
  PLUS: "5258108352008823107", // ➕
  MINUS: "5255775038010829248", // ➖
  BAN: "5017122105011995219", // ⛔
  SEARCH: "5429571366384842791", // 🔍
  TARGET: "5310278924616356636", // 🎯
  CALENDAR: "5258105663359294787", // 📆
  ADMIN: "5321271807511110931", // 👨‍💼
  CHAIN: "5388748063013614096", // ⛓
  GIFT: "6039550576042184651", // 🎁
} as const;

function e(id: string, emoji: string): string {
  return `<tg-emoji emoji-id="${id}">${emoji}</tg-emoji>`;
}

/** {placeholder} larni values obyektidagi qiymatlar bilan almashtiradi. */
export function fmt(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    return key in values ? String(values[key]) : `{${key}}`;
  });
}

// --- ASOSIY MATNLAR ---

/**
 * OFERTA — botdan birinchi marta foydalanilganda.
 *
 * Telegram Stars va akkaunt savdosida foydalanuvchining roziligi bo'lishi
 * kerak; bo'lmasa bot cheklanishi mumkin. Shuning uchun rozilik bermaguncha
 * bot boshqa hech qanday bo'limni ochmaydi.
 */
export const OFFER_MESSAGE = `🎉 Assalomu alaykum <b>{name}</b>

<b>HozirOL</b> botidan foydalanish uchun ommaviy ofertani o'qib rozilik bering

📚 Yuqoridagi <b>Ommaviy oferta</b> tugmasi hujjatni ochadi
✅ O'qib chiqqach pastdagi <b>Roziman</b> tugmasini bosing

<blockquote>Rozilik berish orqali siz oferta shartlarini qabul qilasiz</blockquote>`;

/** Rozilik berilmagan holda boshqa tugma bosilsa. */
export const OFFER_REQUIRED = `❗️ Avval ommaviy ofertaga rozilik bering

/start buyrug'ini yuboring`;

/** Stars bo'limi (Stars olish / Premium olish). */
export const STARS_SECTION = `⭐ <b>Stars va Premium</b>

⭐ <b>Stars olish</b> — istalgan Telegram hisobiga Stars yuborish
👑 <b>Premium olish</b> — 3, 6 yoki 12 oylik obuna

Kerakli xizmatni tanlang 👇`;

export const MAIN_MENU_TITLE =
  `${e(I.ROBOT, "🤖")} HozirOLbot orqali ${e(I.STAR, "⭐️")}Stars evaziga ${e(I.GIFT, "🎁")} Gift xarid qiling`;

export const START_MESSAGE = `${e(I.USER, "👤")} Hurmatli <b>{name}</b>

${e(I.MONEY, "💰")} Balansingiz: <b>{balance} so'm</b>

${e(I.ROBOT, "🤖")} <b>HozirOL</b> orqali siz quyidagilarni xarid qilishingiz mumkin:
${e(I.STAR, "⭐")} Telegram Stars  |  ${e(I.GIFT, "🎁")} Telegram Gift  |  ${e(I.CROWN, "👑")} Telegram Premium

Kerakli bo'limni tanlang ${e(I.DOWN, "👇")}`;

export const BALANCE_MESSAGE = `${e(I.MONEY, "💰")} <b>Balansingiz</b>

${e(I.CASH, "💵")} Joriy balans <b>{balance} so'm</b>
${e(I.PEOPLE, "👥")} Referal daromad <b>{ref_earned} so'm</b>

${e(I.CARD, "💳")} To'lov qilish yoki do'stlaringizni taklif qilish orqali balansni to'ldirishingiz mumkin`;

export const REFERRAL_MESSAGE = `${e(I.PEOPLE, "👥")} <b>Referal tizimi</b>

${e(I.LINK, "🔗")} Sizning havola linkingiz
<code>{link}</code>

${e(I.FLYMONEY, "💸")} Har bir do'stingiz to'lagan to'lovdan <b>0.5%</b> bonus olasiz

${e(I.CHART, "📊")} Referal daromadingiz <b>{ref_earned} so'm</b>`;

export const PAYMENT_INSTRUCTION = `${e(I.CARD, "💳")} <b>To'lov qilish</b>

Quyidagi karta raqamiga pul o'tkazing

${e(I.USER, "👤")} Karta egasi <b>{card_owner}</b>
${e(I.CARD, "💳")} Karta raqami <code>{card_number}</code>

${e(I.WARN, "❗️")} <b>DIQQAT</b>
${e(I.RIGHT, "➡️")} Aynan shu summani yuboring <code>{unique_sum} so'm</code>

${e(I.TIME, "⏳")} To'lovni 15 minut ichida amalga oshiring
${e(I.CROSS, "❌")} Boshqa summa qabul qilinmaydi

${e(I.PHOTO, "📸")} To'lovdan keyin chek rasmini yuboring`;

/**
 * Chek keldi, lekin to'lov hali kanalda ko'rinmagan.
 *
 * Odatda ikki sabab: pul hali o'tmagan yoki summa boshqa yuborilgan.
 * Ikkalasida ham foydalanuvchi nima qilishini bilishi kerak.
 */
export const PAYMENT_NOT_FOUND_YET = `⏳ <b>To'lov hali ko'rinmadi</b>

Chekingiz qabul qilindi, lekin bankdan tasdiq hali kelmadi.

📌 Yuborilishi kerak bo'lgan summa: <code>{unique_sum} so'm</code>

❗️ Aynan shu summa yuborilganini tekshiring — bir so'm farq qilsa ham to'lov topilmaydi.

Pul o'tgan bo'lsa 1-2 daqiqada o'zi tasdiqlanadi.`;

export const PAYMENT_CANCELLED = `${e(I.CROSS, "❌")} <b>To'lov bekor qilindi</b>`;

export const PAYMENT_TIMEOUT = `${e(I.CROSS, "❌")} <b>To'lov topilmadi</b>

${e(I.TIMER, "⏱")} 15 minut ichida to'lov amalga oshirilmadi
${e(I.BAN, "⛔")} 1 soatga to'lov imkoniyati yopildi

Iltimos, keyinroq urinib ko'ring`;

/**
 * To'lov kanalida summa topilganda yuboriladi — NAMUNA RASM bilan birga
 * (PAYMENT_RECEIPT_SAMPLE_PHOTO), shuning uchun matn qisqa: rasm o'zi
 * chekni qanday yuborishni ko'rsatib turadi.
 */
export const PAYMENT_FOUND = `🎯 <b>To'lov aniqlandi</b>

📸 Iltimos, to'lov chekini rasmdagi kabi chat bilan yuboring`;

export const PAYMENT_CONFIRMED = `${e(I.PARTY, "🎉")} <b>To'lov tasdiqlandi</b>

${e(I.PLUS, "➕")} Balansingiz to'ldirildi <b>+{amount} so'm</b>
${e(I.MONEY, "💰")} Joriy balans <b>{balance} so'm</b>

Xizmatlardan foydalanishingiz mumkin`;

export const PAYMENT_BANNED = `${e(I.BAN, "⛔")} <b>To'lov vaqtincha yopilgan</b>

${e(I.CLOCK, "🕒")} Qolgan vaqt <b>{minutes} minut</b>

Iltimos, kutib turing`;

export const ENTER_AMOUNT = `${e(I.MONEY, "💰")} <b>To'lov summasini kiriting</b>

Masalan <code>50000</code>

Minimal summa <b>10,000 so'm</b>`;

export const INVALID_AMOUNT = `${e(I.CROSS, "❌")} Noto'g'ri summa

Iltimos, faqat raqam kiriting
Masalan <code>50000</code>`;

export const MIN_AMOUNT_ERROR = `${e(I.CROSS, "❌")} Minimal to'lov summasi <b>10,000 so'm</b>

Iltimos, ko'proq summa kiriting`;

export const STARS_MENU = `${e(I.STAR, "⭐")} <b>Telegram Stars</b>

${e(I.CASH, "💵")} 1 ${e(I.STAR, "⭐")} = {price} so'm

${e(I.CHART, "📊")} Limitlar
• Minimal {min_stars} Stars
• Maksimal {max_stars} Stars

Nechta Stars sotib olmoqchisiz
Masalan <code>100</code>`;

export const STARS_INVALID_QUANTITY = `${e(I.CROSS, "❌")} Noto'g'ri miqdor

Faqat raqam kiriting
Masalan <code>100</code>`;

export const STARS_LIMIT_ERROR = `${e(I.CROSS, "❌")} Limit xatosi

${e(I.CHART, "📊")} Minimal {min_stars} Stars
${e(I.CHART, "📊")} Maksimal {max_stars} Stars

Iltimos, ushbu oraliqda miqdor kiriting`;

export const STARS_ENTER_USERNAME = `${e(I.CASH, "💵")} <b>Hisob</b>
{quantity} ${e(I.STAR, "⭐")} × {price} = <b>{total} so'm</b>

${e(I.TARGET, "🎯")} Qaysi username ga Stars yuborilsin

<b>@ belgisi bilan kiriting</b>
Masalan <code>@HozirOL</code>`;

export const STARS_USERNAME_FORMAT_ERROR = `${e(I.CROSS, "❌")} Username noto'g'ri formatda

<b>@ belgisi bilan boshlang</b>
Masalan <code>@HozirOL</code>`;

export const STARS_INSUFFICIENT_BALANCE = `${e(I.CROSS, "❌")} <b>Balans yetarli emas</b>

${e(I.MONEY, "💰")} Kerak <b>{required} so'm</b>
${e(I.CASH, "💵")} Mavjud <b>{balance} so'm</b>

To'ldirishni xohlaysizmi`;

export const STARS_CHECKING_RECIPIENT = `${e(I.SEARCH, "🔍")} Qabul qiluvchi tekshirilmoqda

Iltimos, kuting`;

export const STARS_RECIPIENT_NOT_FOUND = `${e(I.CROSS, "❌")} <b>Foydalanuvchi topilmadi</b>

Username @{username}

Iltimos, to'g'ri username kiriting va Telegram foydalanuvchi ekanligini tekshiring. Kanal va guruhlarga Stars to'g'ridan-to'g'ri tashlab bo'lmaydi`;

export const STARS_RECIPIENT_INVALID = `${e(I.CROSS, "❌")} <b>Foydalanuvchiga Stars yuborib bo'lmaydi</b>

Bu foydalanuvchi Stars qabul qila olmaydi
Iltimos, boshqa username kiriting`;

export const STARS_CONFIRMING_ORDER = `${e(I.TIME, "⏳")} <b>Buyurtma tasdiqlanmoqda</b>

Iltimos, bir necha soniya kuting`;

export const STARS_QUEUED = `${e(I.TIME, "⏳")} <b>Buyurtma qabul qilindi</b>

${e(I.TARGET, "🎯")} Qabul qiluvchi @{username}
${e(I.STAR, "⭐")} Miqdor {quantity} Stars
${e(I.CASH, "💵")} Summa <b>{uzs} so'm</b>

${e(I.CHART, "📊")} Navbat {position}-o'rin
${e(I.TIMER, "⏱")} Taxminiy kutish ~{wait_time} soniya

Buyurtmangiz tez orada bajariladi`;

export const STARS_SUCCESS = `${e(I.PARTY, "🎉")} <b>Muvaffaqiyatli</b>

${e(I.STAR, "⭐")} <b>{quantity} Stars</b> muvaffaqiyatli yuborildi
${e(I.TARGET, "🎯")} Qabul qiluvchi @{username}

${e(I.CASH, "💵")} Hisoblandi <b>{uzs} so'm</b>
${e(I.MONEY, "💰")} Qolgan balans <b>{balance} so'm</b>

${e(I.CLOCK, "🕒")} {datetime}

Yana xizmatlardan foydalanishingiz mumkin`;

export const PREMIUM_MENU = `${e(I.CROWN, "👑")} <b>Telegram Premium</b>

${e(I.CALENDAR, "📆")} Davomiylik
• 3 oy
• 6 oy
• 12 oy

${e(I.TARGET, "🎯")} Qaysi username ga Premium berilsin

<b>@ belgisi bilan kiriting</b>
Masalan <code>@HozirOL</code>`;

export const PREMIUM_USERNAME_FORMAT_ERROR = `${e(I.CROSS, "❌")} Username noto'g'ri formatda

<b>@ belgisi bilan boshlang</b>
Masalan <code>@HozirOL</code>`;

export const PREMIUM_ENTER_MONTHS = `${e(I.CALENDAR, "📆")} <b>Necha oylik Premium kerak</b>

Variantlardan birini tanlang
• <code>3</code> - 3 oy
• <code>6</code> - 6 oy
• <code>12</code> - 12 oy

Raqam yozing: 3, 6 yoki 12`;

export const PREMIUM_INVALID_MONTHS = `${e(I.CROSS, "❌")} Noto'g'ri tanlov

Faqat quyidagi variantlardan birini tanlang
• <code>3</code> - 3 oy
• <code>6</code> - 6 oy
• <code>12</code> - 12 oy`;

export const PREMIUM_INSUFFICIENT_BALANCE = `${e(I.CROSS, "❌")} <b>Balans yetarli emas</b>

${e(I.MONEY, "💰")} Kerak <b>{required} so'm</b>
${e(I.CASH, "💵")} Mavjud <b>{balance} so'm</b>

To'ldirishni xohlaysizmi`;

export const PREMIUM_CHECKING_RECIPIENT = `${e(I.SEARCH, "🔍")} Qabul qiluvchi tekshirilmoqda

Iltimos, kuting`;

export const PREMIUM_RECIPIENT_NOT_FOUND = `${e(I.CROSS, "❌")} <b>Foydalanuvchi topilmadi</b>

Username @{username}

Iltimos, to'g'ri username kiriting. Premium allaqachon faol bo'lgan foydalanuvchiga Premium sotib olib bo'lmaydi`;

export const PREMIUM_RECIPIENT_INVALID = `${e(I.CROSS, "❌")} <b>Foydalanuvchiga Premium berib bo'lmaydi</b>

Bu foydalanuvchi Premium qabul qila olmaydi
Iltimos, boshqa username kiriting`;

export const PREMIUM_CONFIRMING_ORDER = `${e(I.TIME, "⏳")} <b>Buyurtma tasdiqlanmoqda</b>

Iltimos, bir necha soniya kuting`;

export const PREMIUM_QUEUED = `${e(I.TIME, "⏳")} <b>Premium buyurtmasi qabul qilindi</b>

${e(I.TARGET, "🎯")} Qabul qiluvchi @{username}
${e(I.CROWN, "👑")} Davomiyligi {months} oy
${e(I.CASH, "💵")} Summa <b>{uzs} so'm</b>

${e(I.CHART, "📊")} Navbat {position}-o'rin
${e(I.TIMER, "⏱")} Taxminiy kutish ~{wait_time} soniya

Buyurtmangiz tez orada bajariladi`;

export const PREMIUM_SUCCESS = `${e(I.PARTY, "🎉")} <b>Muvaffaqiyatli</b>

${e(I.CROWN, "👑")} <b>{months} oylik Premium</b> muvaffaqiyatli faollashtirildi
${e(I.TARGET, "🎯")} Qabul qiluvchi @{username}

${e(I.CASH, "💵")} Hisoblandi <b>{uzs} so'm</b>
${e(I.MONEY, "💰")} Qolgan balans <b>{balance} so'm</b>

${e(I.CLOCK, "🕒")} {datetime}

Yana xizmatlardan foydalanishingiz mumkin`;

export const ERROR_NETWORK = `${e(I.CROSS, "❌")} <b>Tarmoq xatosi</b>

Server bilan aloqa o'rnatib bo'lmadi
Iltimos, biroz kutib qaytadan urinib ko'ring`;

export const ERROR_BLOCKCHAIN = `${e(I.CROSS, "❌")} <b>Blockchain xatosi</b>

TON blockchain bilan muammo yuz berdi
Iltimos, biroz kutib qaytadan urinib ko'ring

Balansingiz qaytarildi`;

export const ERROR_API = `${e(I.CROSS, "❌")} <b>API xatosi</b>

Xizmat vaqtincha ishlamayapti
Iltimos, keyinroq qaytadan urinib ko'ring

Balansingiz qaytarildi`;

export const ERROR_INSUFFICIENT_TON = `${e(I.CROSS, "❌")} <b>TON yetarli emas</b>

Bot balansida yetarli TON yo'q
Admin bilan bog'laning {support}

Balansingiz qaytarildi`;

export const ERROR_UNKNOWN = `${e(I.CROSS, "❌")} <b>Kutilmagan xato</b>

Nimadir noto'g'ri ketdi
Iltimos, qaytadan urinib ko'ring

Agar muammo takrorlansa, admin bilan bog'laning {support}`;

export const ADMIN_PANEL = `${e(I.ADMIN, "👨‍💼")} <b>Admin Panel</b>

${e(I.CASH, "💵")} Hozirgi Stars narxi <b>{price} so'm</b>

${e(I.CHART, "📊")} Statistika
• Jami foydalanuvchilar {total_users}
• Jami buyurtmalar (processed) {total_orders}
• Navbatdagi tranzaksiyalar {pending_txs}

Kerakli amalni tanlang`;

export const ADMIN_ADD_BALANCE = `${e(I.PLUS, "➕")} <b>Balans qo'shish</b>

Formatda yuboring
<code>USER_ID SUMMA</code>

Masalan <code>123456789 50000</code>`;

export const ADMIN_SUB_BALANCE = `${e(I.MINUS, "➖")} <b>Balans ayirish</b>

Formatda yuboring
<code>USER_ID SUMMA</code>

Masalan <code>123456789 10000</code>`;

export const ADMIN_BAN_USER = `${e(I.BAN, "⛔")} <b>Ban / Unban</b>

Ban uchun formatda yuboring
<code>USER_ID MINUT</code>

Unban uchun
<code>USER_ID 0</code>

Masalan <code>123456789 60</code>`;

export const ADMIN_SET_PRICE = `${e(I.CASH, "💵")} <b>Stars narxini o'zgartirish</b>

Hozirgi narx <b>{price} so'm</b>

Yangi narxni yuboring (faqat raqam)
Masalan <code>250</code>`;

export const ADMIN_PRICE_UPDATED = `${e(I.CHECK, "✅")} <b>Narx yangilandi</b>

Yangi narx <b>{price} so'm</b>`;

export const ADMIN_BALANCE_ADDED = `${e(I.CHECK, "✅")} <b>Balans qo'shildi</b>

User ID <code>{user_id}</code>
Summa <b>+{amount} so'm</b>`;

export const ADMIN_BALANCE_REMOVED = `${e(I.CHECK, "✅")} <b>Balans ayrildi</b>

User ID <code>{user_id}</code>
Summa <b>-{amount} so'm</b>`;

export const ADMIN_USER_BANNED = `${e(I.CHECK, "✅")} <b>Foydalanuvchi banlandi</b>

User ID <code>{user_id}</code>
Davomiyligi <b>{minutes} minut</b>`;

export const ADMIN_USER_UNBANNED = `${e(I.CHECK, "✅")} <b>Ban olib tashlandi</b>

User ID <code>{user_id}</code>`;

export const ADMIN_INVALID_FORMAT = `${e(I.CROSS, "❌")} Noto'g'ri format

Qaytadan urinib ko'ring`;

export const ADMIN_BROADCAST_PROMPT = `${e(I.ROBOT, "🤖")} <b>Hammaga xabar yuborish</b>

Yubormoqchi bo'lgan xabaringizni yuboring
Matn, rasm, video yoki fayl bo'lishi mumkin (izoh bilan)

Bekor qilish uchun /cancel`;

export const ADMIN_BROADCAST_CANCELLED = `${e(I.CROSS, "❌")} <b>Xabar yuborish bekor qilindi</b>`;

export const ADMIN_BROADCAST_CONFIRM = `${e(I.WARN, "❗️")} <b>Tasdiqlang</b>

Yuqoridagi xabar <b>{total}</b> ta foydalanuvchiga yuboriladi

Davom etasizmi`;

export const ADMIN_BROADCAST_STARTED = `${e(I.TIME, "⏳")} <b>Xabar yuborilmoqda</b>

Jami <b>{total}</b> ta foydalanuvchiga
Iltimos, kuting...`;

export const ADMIN_BROADCAST_DONE = `${e(I.PARTY, "🎉")} <b>Xabar yuborish yakunlandi</b>

${e(I.CHART, "📊")} Jami <b>{total}</b> foydalanuvchi
${e(I.CHECK, "✅")} Yuborildi <b>{success}</b>
${e(I.CROSS, "❌")} Yuborilmadi (bloklagan) <b>{failed}</b>`;

export const LOG_STARS_SUCCESS = `${e(I.STAR, "⭐")} <b>STARS SOTIB OLINDI</b>

${e(I.USER, "👤")} Xaridor @{buyer_username} | <code>{buyer_id}</code>
${e(I.TARGET, "🎯")} Qabul qiluvchi @{recipient_username}
${e(I.STAR, "⭐")} Miqdor {quantity} Stars

${e(I.CASH, "💵")} Hisoblandi <b>{uzs} so'm</b>
${e(I.CHAIN, "⛓")} TON sarflandi {ton}
${e(I.MONEY, "💰")} Wallet {before} → {after} TON

${e(I.CLOCK, "🕒")} {datetime}`;

export const LOG_PREMIUM_SUCCESS = `${e(I.CROWN, "👑")} <b>PREMIUM SOTIB OLINDI</b>

${e(I.USER, "👤")} Xaridor @{buyer_username} | <code>{buyer_id}</code>
${e(I.TARGET, "🎯")} Qabul qiluvchi @{recipient_username}
${e(I.CROWN, "👑")} Davomiyligi {months} oy

${e(I.CASH, "💵")} Hisoblandi <b>{uzs} so'm</b>
${e(I.CHAIN, "⛓")} TON sarflandi {ton}
${e(I.MONEY, "💰")} Wallet {before} → {after} TON

${e(I.CLOCK, "🕒")} {datetime}`;

export const LOG_TX_ERROR = `${e(I.CROSS, "❌")} <b>TRANZAKSIYA XATOSI</b>

Type {tx_type}
Retry {retry}/{max_retry}

Error
<code>{error}</code>

${e(I.CLOCK, "🕒")} {datetime}`;

export const LOG_PAYMENT_CONFIRMED = `${e(I.CHECK, "✅")} <b>TO'LOV TASDIQLANDI</b>

${e(I.USER, "👤")} User ID <code>{user_id}</code>
${e(I.MONEY, "💰")} Summa <b>{amount} so'm</b>
${e(I.LINK, "🔗")} <a href="{post_link}">To'lov posti</a>

${e(I.CLOCK, "🕒")} {datetime}`;

export const LOG_STUCK_TX = `${e(I.WARN, "❗️")} <b>Bot restart — qolib ketgan TX</b>
TX #{tx_id} | {tx_type}
Oluvchi: @{recipient_username}
Miqdor: {uzs} so'm
Holat: <code>sending</code>

${e(I.WARN, "❗️")} Blockchain'da tekshiring!
Agar yetib borgan bo'lsa: /done_{tx_id}
Agar yetib bormagan bo'lsa: /retry_{tx_id}`;

// --- TELEGRAM PROFIL (tayyor akkaunt sotish) ---

export const TG_PROFILE_MENU = `${e(I.USER, "👤")} <b>Telegram tayyor, ishonchli profil</b>

Bu profillar to'liq faol va ishlatishga tayyor.
Sotib olgach, sizga raqam va login kodi taqdim etiladi.

${e(I.CASH, "💵")} Narxi: <b>{price} so'm</b>

Sotib olish uchun pastdagi tugmani bosing ${e(I.DOWN, "👇")}`;

export const TG_PROFILE_NONE_AVAILABLE = `${e(I.WARN, "❗️")} <b>Hozirda aktiv raqamlar yo'q</b>

Iltimos, keyinroq qaytadan urinib ko'ring yoki admin bilan bog'laning.`;

export const TG_PROFILE_INSUFFICIENT_BALANCE = `${e(I.CROSS, "❌")} <b>Balans yetarli emas</b>

${e(I.MONEY, "💰")} Kerak <b>{required} so'm</b>
${e(I.CASH, "💵")} Mavjud <b>{balance} so'm</b>

To'ldirishni xohlaysizmi`;

export const TG_PROFILE_ASSIGNED = `${e(I.CHECK, "✅")} <b>Sizga akkaunt ajratildi</b>

${e(I.USER, "👤")} Raqam: <code>{phone}</code>

Ushbu raqamni Telegram ilovasiga kiriting. Kod yuborilgach, pastdagi <b>"Kod olish"</b> tugmasini bosing.`;

export const TG_PROFILE_CODE_WAITING = `${e(I.WARN, "❗️")} <b>Kod hali kelmadi</b>

Telegramga raqamni kiritganingizga ishonch hosil qiling va birozdan so'ng qayta tekshiring.`;

export const TG_PROFILE_CODE_RESULT = `${e(I.CHECK, "✅")} <b>Telegram kodi</b>: <code>{code}</code>

${e(I.CARD, "🔑")} <b>2-bosqich (2FA) paroli</b>: <code>{two_fa}</code>

${e(I.PARTY, "🎉")} Xaridingiz uchun rahmat!`;

// --- ADMIN: TELEGRAM AKKAUNT QO'SHISH ---

export const ADMIN_TG_ADD_PHONE = `${e(I.PLUS, "➕")} <b>Yangi Telegram akkaunt qo'shish</b>

Akkaunt telefon raqamini kiriting
Masalan <code>+998901234567</code>`;

export const ADMIN_TG_ADD_PRICE = `${e(I.CASH, "💵")} <b>Narxni kiriting</b>

Shu akkaunt uchun narxni so'mda kiriting
Masalan <code>150000</code>`;

export const ADMIN_TG_ADD_TWOFA = `${e(I.CARD, "🔑")} <b>2FA parolini kiriting</b>

Agar akkauntda 2-bosqich (2FA) paroli bo'lmasa — <code>-</code> deb yozing`;

export const ADMIN_TG_ADD_SENDING_CODE = `${e(I.TIME, "⏳")} Telegramga ulanish so'rovi yuborilmoqda...`;

export const ADMIN_TG_ADD_ENTER_CODE = `${e(I.PHOTO, "📩")} Raqamga SMS/Telegram kod yuborildi!

Kodni kiriting (masalan <code>k19261</code> yoki shunchaki <code>19261</code>)`;

export const ADMIN_TG_ADD_SUCCESS = `${e(I.PARTY, "🎉")} <b>Akkaunt muvaffaqiyatli saqlandi!</b>

${e(I.USER, "👤")} Raqam: <code>{phone}</code>
${e(I.CASH, "💵")} Narxi: <b>{price} so'm</b>`;

export const LOG_TG_ACCOUNT_SOLD = `${e(I.USER, "👤")} <b>TELEGRAM PROFIL SOTILDI</b>

${e(I.USER, "👤")} Xaridor: @{buyer_username} | <code>{buyer_id}</code>
📱 Raqam: <code>{phone}</code>
${e(I.CASH, "💵")} Narxi: <b>{price} so'm</b>

${e(I.CLOCK, "🕒")} {datetime}`;


export const BTN = {
  // Yozuvdagi emoji tugmaga PREMIUM IKONKA bo'lib chiqadi (src/bot/emoji.ts),
  // matnda esa qolmaydi — shuning uchun bu yerda odatdagidek yozaverasiz.
  STARS: "⭐ Stars",
  STARS_BUY: "⭐ Stars olish",
  PREMIUM_BUY: "👑 Premium olish",
  GIFTS: "🎁 Gift olish",
  BALANCE: "💰 Balans",
  TG_PROFILE: "📱 Profil olish",
  SUPPORT: "🆘 Support",

  PAY: "💳 To'lov",
  REFERRAL: "👥 Referal",
  CANCEL: "❌ Bekor qilish",
  BACK: "🔙 Orqaga qaytish",
  MENU: "🏠 Bosh menyu",
  PREV: "◀️ Orqaga",
  NEXT: "▶️ Keyingi",

  OFFER_READ: "📚 Ommaviy oferta",
  OFFER_ACCEPT: "✅ Roziman",

  ADMIN_ADD: "➕ Balans qo'shish",
  ADMIN_SUB: "➖ Balans ayirish",
  ADMIN_BAN: "⛔ Ban / Unban",
  ADMIN_PRICE: "💵 Narxni o'zgartirish",
  ADMIN_BROADCAST: "📢 Hammaga xabar",
  ADMIN_GIFT_ADD: "➕ Gift qo'shish",
  ADMIN_GIFT_LIST: "📋 Gift ro'yxati",
  ADMIN_TG_ADD: "➕ Akkount qo'shish",
  ADMIN_TG_STATS: "📊 Akkountlar",
  BROADCAST_CONFIRM: "✅ Yuborish",
  BROADCAST_CANCEL: "❌ Bekor qilish",

  TG_BUY: "🛒 Sotib olish",
  TG_GET_CODE: "🔑 Kod olish",
  TG_RECHECK: "🔄 Qayta tekshirish",

  // --- Gift Arenda (Mini App) ---
  RENT: "🖼 Gift Arenda",
  OPEN_APP: "🖼 Ilovani ochish",
  MY_GIFTS: "🎒 Mening giftlarim",
  ADMIN_TON_RATE: "💱 TON kursi",
  ADMIN_SERVICE_FEE: "🧾 Xizmat haqi",
  ADMIN_RENT_STATS: "🖼 Arenda statistikasi",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  GIFT ARENDA (Mini App) matnlari
// ═══════════════════════════════════════════════════════════════════════════

export const RENT_INTRO = `<b>🖼 Gift Arenda</b>

TON NFT sovg'alarni <b>ijaraga oling</b> va ularni o'z Telegram profilingizda ko'rsating.

<b>Qanday ishlaydi?</b>
1️⃣ Ilovadan gift va muddatni tanlaysiz
2️⃣ Balansingizdan to'lov yechiladi
3️⃣ Fragment orqali profilingizni ulaysiz
4️⃣ Gift profilingizda paydo bo'ladi

💰 Balansingiz: <b>{balance}</b> so'm

Pastdagi tugma orqali ilovani oching 👇`;

export const RENT_PAID = `<b>✅ Ijara to'lovi tasdiqlandi!</b>

🖼 Gift: <b>{gift}</b>
📅 Muddat: <b>{days}</b> kun
💵 To'landi: <b>{uzs}</b> so'm

Endi ilovadagi <b>«Mening giftlarim»</b> bo'limiga o'ting va <b>«Profilga ulash»</b> tugmasini bosing.`;

export const RENT_EXTENDED = `<b>✅ Ijara uzaytirildi!</b>

🖼 Gift: <b>{gift}</b>
📅 Qo'shildi: <b>{days}</b> kun
💵 To'landi: <b>{uzs}</b> so'm`;

export const RENT_FAILED = `<b>❌ Ijara amalga oshmadi</b>

🖼 Gift: <b>{gift}</b>
💵 <b>{uzs}</b> so'm balansingizga to'liq qaytarildi.

{error}

Boshqa giftni tanlab ko'ring. Savol bo'lsa — support bilan bog'laning.`;

export const LOG_RENT_PAID = `🖼 <b>YANGI IJARA</b>

👤 @{buyer_username} (<code>{buyer_id}</code>)
🎁 {gift}
📅 {days} kun
💵 {uzs} so'm
🕒 {datetime}`;

export const LOG_RENT_FAILED = `❌ <b>IJARA XATOSI</b>

👤 <code>{buyer_id}</code>
🎁 {gift}
💵 {uzs} so'm qaytarildi
⚠️ <code>{error}</code>
🕒 {datetime}`;

export const ADMIN_SET_TON_RATE = `💱 <b>TON kursi</b>

Joriy kurs: <b>1 TON = {rate} so'm</b>

Yangi kursni faqat raqam bilan yuboring (masalan <code>21000</code>):`;

export const ADMIN_SET_SERVICE_FEE = `🧾 <b>Xizmat haqi</b>

Joriy: <b>{fee} so'm</b> (har bir yangi ijara uchun bir marta)

Yangi qiymatni raqam bilan yuboring (masalan <code>2000</code>):`;

export const ADMIN_RENT_STATS = `🖼 <b>Arenda statistikasi</b>

🟢 Faol ijaralar: <b>{active}</b>
🟡 Ulanish kutilmoqda: <b>{pending}</b>
📦 Navbatdagi blokcheyn ishlari: <b>{queue}</b>

💱 1 TON = <b>{rate}</b> so'm
🧾 Xizmat haqi: <b>{fee}</b> so'm

📚 Katalogda: <b>{gifts}</b> gift / <b>{collections}</b> kolleksiya
⏳ Yuklanmoqda: <b>{loading}</b> · ⚠️ Xato: <b>{failing}</b>
🕒 Eng eski ma'lumot: <b>{age}</b> soniya oldin
🚦 Marketapp tanaffusi: <b>{interval}</b> ms{limited}`;

