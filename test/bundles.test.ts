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

console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 To'plam narxi testlari o'tdi");
process.exit(fails ? 1 : 0);
