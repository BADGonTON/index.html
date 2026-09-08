/**
 * Botda BITTA HAM oddiy emoji qolmasligini tekshiradi.
 *
 * Talab shunday edi: "shuni to'liq 1 ta ham oddiy emojisi qilib ber".
 * Buni qo'lda kuzatib bo'lmaydi — matnlar 40 dan ortiq, har biri
 * o'zgarib turadi. Shuning uchun bu test HAR BIR eksport qilingan
 * matnni va HAR BIR tugma yozuvini ko'zdan kechiradi:
 *
 *   • matndagi har bir emoji `<tg-emoji>` ichiga tushdimi
 *   • tugma yozuvida emoji qolmadimi (u ikonkaga o'tishi kerak)
 *   • xaritada ID'si yo'q emoji bormi
 *
 * Yangi matn qo'shilib, undagi emoji xaritada bo'lmasa — test yiqiladi
 * va aynan qaysi belgi ekanini aytadi.
 */
import * as texts from "../src/bot/texts";
import { premiumize, splitButtonLabel, findUnmappedEmoji, EMOJI_IDS } from "../src/bot/emoji";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

/**
 * `<tg-emoji>` teglaridan tashqarida qolgan emoji.
 *
 * Oddiy strelkalar (U+2190-U+21FF, "→") hisobga olinmaydi — ular emoji
 * emas, matn belgisi.
 */
function bareEmoji(html: string): string[] {
  const outside = html.replace(/<tg-emoji\b[^>]*>.*?<\/tg-emoji>/gs, "");
  const found = outside.match(
    /[\u{1F000}-\u{1FAFF}\u{2300}-\u{27BF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}]/gu
  );
  return [...new Set(found ?? [])];
}

console.log("\n── Xabar matnlari ──");

const messages = Object.entries(texts).filter(
  ([name, value]) => typeof value === "string" && name !== "BTN"
) as Array<[string, string]>;

ok("matnlar topildi", messages.length > 20, `(${messages.length} ta)`);

const unmapped = new Map<string, string[]>();
const leftBare = new Map<string, string[]>();

for (const [name, raw] of messages) {
  const missing = findUnmappedEmoji(raw);
  if (missing.length) unmapped.set(name, missing);

  const bare = bareEmoji(premiumize(raw));
  if (bare.length) leftBare.set(name, bare);
}

ok(
  "har bir emojining premium ID'si bor",
  unmapped.size === 0,
  [...unmapped].map(([n, e]) => `${n}: ${e.join(" ")}`).join(" | ")
);
ok(
  "premiumize'dan keyin oddiy emoji qolmadi",
  leftBare.size === 0,
  [...leftBare].map(([n, e]) => `${n}: ${e.join(" ")}`).join(" | ")
);

console.log("\n── Tugma yozuvlari ──");

const buttons = Object.entries(texts.BTN) as Array<[string, string]>;
ok("tugmalar topildi", buttons.length > 15, `(${buttons.length} ta)`);

const noIcon: string[] = [];
const emojiInText: string[] = [];

for (const [name, label] of buttons) {
  const { text, icon } = splitButtonLabel(label);
  if (!icon) noIcon.push(`${name} ("${label}")`);
  if (bareEmoji(text).length) emojiInText.push(`${name} ("${text}")`);
}

ok("har bir tugmada premium ikonka bor", noIcon.length === 0, noIcon.join(", "));
ok("tugma YOZUVIDA emoji qolmadi", emojiInText.length === 0, emojiInText.join(", "));

console.log("\n── premiumize() ──");

const sample = "🎁 Gift olish — 5 000 so'm";
const converted = premiumize(sample);
ok("emoji o'raldi", converted.includes('<tg-emoji emoji-id="'), converted.slice(0, 60));
ok("matn o'zgarmadi", converted.includes("Gift olish — 5 000 so'm"));
ok("ikki marta o'ramaydi", premiumize(converted) === converted);
ok("bo'sh matn xavfsiz", premiumize("") === "");
ok("emojisiz matnga tegilmaydi", premiumize("oddiy matn") === "oddiy matn");

// Matn ichidagi raqamlar niqob belgilaridan farqlanishi kerak
const numbers = premiumize("✅ 0 1 2 3 to'landi ❌ 12345");
ok("raqamlar buzilmadi", numbers.includes("0 1 2 3 to'landi") && numbers.includes("12345"), numbers);

// ZWJ ketma-ketligi bo'linib ketmasligi kerak
const zwj = premiumize("👨‍💼 admin");
ok(
  "ZWJ ketma-ketligi butun qoldi",
  zwj === `<tg-emoji emoji-id="${EMOJI_IDS["👨‍💼"]}">👨‍💼</tg-emoji> admin`,
  zwj
);

// Variatsiya selektorli va selektorsiz shakl — ikkalasi ham topilishi kerak
ok("selektorli emoji ham topiladi", premiumize("⭐️").includes("tg-emoji"));
ok("selektorsiz emoji ham topiladi", premiumize("⭐").includes("tg-emoji"));

console.log("\n── Tugma yozuvini ajratish ──");

const g = splitButtonLabel("🎁 Gift olish");
ok("emoji ajratildi", g.text === "Gift olish" && g.icon === EMOJI_IDS["🎁"], JSON.stringify(g));

const plain = splitButtonLabel("Orqaga qaytish");
ok("emojisiz yozuv o'zgarmadi", plain.text === "Orqaga qaytish" && plain.icon === undefined);

const mid = splitButtonLabel("Orqaga 🎁");
ok("faqat BOSHIDAGI emoji olinadi", mid.icon === undefined, JSON.stringify(mid));

console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 Butun bot premium emoji bilan");
process.exit(fails ? 1 : 0);
