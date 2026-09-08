/**
 * To'plam narxini sinaydi — baza kerak emas.
 *
 * Talab aynan shunday edi: "har bir gift uchun servis xizmati 2000 so'mdan,
 * shu kolleksiya narxiga 10% qo'shilib ketadi — masalan 6 ta gift bo'lsa
 * 100 ming, uni 110 ming deb kolleksiyada ko'rsatadi".
 *
 * Shu sabab bu yerda ASOSAN o'sha misol tekshiriladi: 100 000 → 110 000.
 */
import {
  bundleQuote,
  BUNDLE_MIN_DAYS,
  BUNDLE_SIZES,
  BUNDLE_MARKUP_PCT,
  getServiceFeeUzs,
  getTonRateUzs,
} from "../src/services/pricing";
import {
  userFacingRentError,
  isRetryableRentError,
  sanitizeStoredRentError,
} from "../src/services/rentErrors";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

/** Berilgan kunlik so'm narxini nanoTON ga qaytaradi (kurs bo'yicha). */
function nanoForUzsPerDay(uzs: number): string {
  return String(Math.round((uzs / getTonRateUzs()) * 1e9));
}

console.log("\n── To'plam narxi ──");

ok("eng kam muddat 7 kun", BUNDLE_MIN_DAYS === 7, `(${BUNDLE_MIN_DAYS})`);
ok("o'lchamlar 3/6/9/12", BUNDLE_SIZES.join(",") === "3,6,9,12", BUNDLE_SIZES.join(","));
ok("ustama 10%", BUNDLE_MARKUP_PCT === 10, `(${BUNDLE_MARKUP_PCT}%)`);
ok("xizmat haqi 2000 so'm", getServiceFeeUzs() === 2000, `(${getServiceFeeUzs()})`);

// ── Foydalanuvchi bergan misol ──
//
// "6 ta gift bo'lsa 100 ming, uni 110 ming deb ko'rsatadi."
//
// Aynan 100 000 so'mlik oraliq summani yig'amiz: 6 ta giftning kunlik narxi
// jami 11 000 so'm, muddat 8 kun → ijara 88 000 + xizmat haqi 12 000 = 100 000.
const fee = getServiceFeeUzs();
const six = [
  nanoForUzsPerDay(1833),
  nanoForUzsPerDay(1833),
  nanoForUzsPerDay(1833),
  nanoForUzsPerDay(1833),
  nanoForUzsPerDay(1833),
  nanoForUzsPerDay(1835),
];

const q = bundleQuote(six, 8);
ok("6 ta giftning oralig'i 100 000 so'm", q.subtotal_uzs === 100_000, `(${q.subtotal_uzs})`);
ok("ustama bilan 110 000 so'm", q.total_uzs === 110_000, `(${q.total_uzs})`);
ok("xizmat haqi har bir gift uchun", q.fee_uzs === fee * 6, `(${q.fee_uzs})`);
ok("jami = oraliq + ustama", q.total_uzs === q.subtotal_uzs + q.markup_uzs);
ok("ustama aynan 10 000 so'm", q.markup_uzs === 10_000, `(${q.markup_uzs})`);

// ── Kunlar oshgani sari faqat ijara qismi o'sadi ──
const week = bundleQuote(six, 7);
const twoWeeks = bundleQuote(six, 14);
ok("ikki hafta ijarasi ikki barobar", twoWeeks.rent_uzs === week.rent_uzs * 2,
   `(${week.rent_uzs} → ${twoWeeks.rent_uzs})`);
ok("xizmat haqi kunga bog'liq emas", twoWeeks.fee_uzs === week.fee_uzs);

// ── Mini App slayderi bilan bir xil formula ──
//
// Server har bir giftning narxini yubormaydi, faqat KUNLIK YIG'INDINI beradi.
// Mini App shu bitta son bilan hisoblaydi — natija server hisobi bilan bir xil
// bo'lishi SHART, aks holda "narx boshqacha" degan xato chiqadi.
const perDaySum = six.reduce((n, nano) => n + Math.ceil((Number(nano) / 1e9) * getTonRateUzs()), 0);
for (const days of [7, 9, 13, 30, 90]) {
  const server = bundleQuote(six, days);
  const sub = perDaySum * days + fee * 6;
  const client = sub + Math.ceil((sub * BUNDLE_MARKUP_PCT) / 100);
  ok(`${days} kun: klient va server bir xil hisoblaydi`, client === server.total_uzs,
     `(${client} / ${server.total_uzs})`);
}

// ── O'lchamlar ──
const twelve = [...six, ...six];
const q12 = bundleQuote(twelve, 8);
ok("12 ta gift narxi 6 tanikidan qimmat", q12.total_uzs > q.total_uzs,
   `(${q.total_uzs} → ${q12.total_uzs})`);
ok("12 ta gift = 6 tanikining ikki barobari", q12.total_uzs === q.total_uzs * 2,
   `(${q12.total_uzs})`);

const three = six.slice(0, 3);
ok("3 ta giftda ham 10% ustama bor",
   bundleQuote(three, 7).total_uzs ===
     bundleQuote(three, 7).subtotal_uzs + bundleQuote(three, 7).markup_uzs);


// ── Xatolar foydalanuvchiga XOM ko'rinishda chiqmasligi kerak ──
//
// Foydalanuvchi ekranida aynan shunday matn turgan edi:
//
//   POST /v1/rent/EQBQ6Ymp5QWJLE-.../pay/ [400]: {"detail":{"status":"error",
//   "reason":"Too late. It is not for rent anymore."}}
//
// Bunday matn boshqa hech qachon ko'rinmasligi kerak.

console.log("\n── Xato matnlari ──");

const RAW_TOO_LATE =
  'POST /v1/rent/EQBQ6Ymp5QWJLE-0fKaky0C9M1oljkqn38rWe3ylXAqRIezA/pay/ [400]: ' +
  '{"detail":{"status":"error","reason":"Too late. It is not for rent anymore."}}';

const friendly = userFacingRentError(RAW_TOO_LATE);
ok("xom matn almashtirildi", friendly !== RAW_TOO_LATE, friendly);
ok("manzil ko'rinmaydi", !/\/v1\/|EQBQ|POST|\[400\]|detail/.test(friendly), friendly);
ok("sabab tushunarli", /boshqa kimdir/i.test(friendly), friendly);
ok("band gift uchun qayta urinilmaydi", !isRetryableRentError(RAW_TOO_LATE));

ok("tarmoq xatosida qayta uriniladi", isRetryableRentError("connect ETIMEDOUT 1.2.3.4:443"));
ok("429 da qayta uriniladi", isRetryableRentError("GET /v1/rent/gifts/: 429 Too Many Requests"));
ok("noma'lum xatoda qayta uriniladi", isRetryableRentError("nimadir noto'g'ri ketdi"));

// Har qanday xom matn uchun javob doim sodda jumla bo'lishi kerak
for (const raw of [
  RAW_TOO_LATE,
  'Error: connect ECONNREFUSED 127.0.0.1:443',
  'GET https://api.marketapp.org/v1/rent/gifts/: 502 Bad Gateway',
  '{"detail":"insufficient balance"}',
  'butunlay tanish bo\'lmagan xato',
]) {
  const text = userFacingRentError(raw);
  ok(`sodda jumla: "${text}"`,
     !/https?:\/\/|\/v1\/|[{}]|\[\d{3}\]|Error:/.test(text) && text.length < 120);
}

// Bazada allaqachon yotgan xom matn ham tozalanadi, tayyor jumlaga tegilmaydi
const already = userFacingRentError(RAW_TOO_LATE);
ok("eski yozuv tozalanadi", sanitizeStoredRentError(RAW_TOO_LATE) === already);
ok("tayyor jumlaga tegilmaydi", sanitizeStoredRentError(already) === already, already);
ok("bo'sh xato null qoladi", sanitizeStoredRentError(null) === null);

console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 To'plam va xato testlari o'tdi");
process.exit(fails ? 1 : 0);
