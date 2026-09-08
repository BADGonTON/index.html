/**
 * initData tekshiruvini Telegram'ning RASMIY kutubxonasiga qarshi sinaymiz.
 * `@telegram-apps/init-data-node` — Telegram Mini Apps jamoasining o'z paketi.
 * Ular imzolaydi, biz tekshiramiz: natija bir xil bo'lishi SHART.
 */
import { sign } from "@telegram-apps/init-data-node";
import { verifyInitDataDetailed } from "../src/web/auth";
import { config } from "../src/config";

const TOKEN = config.botToken;
const now = new Date();

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

// 1. Oddiy initData (eski klientlar shunday yuboradi)
const plain = sign(
  { user: { id: 900001, first_name: "Shahboz", username: "shahboz" }, chat_instance: "-123", chat_type: "private" },
  TOKEN,
  now
);
ok("rasmiy imzo qabul qilindi (signature'siz)", verifyInitDataDetailed(plain).user?.id === 900001);

// 2. `signature` maydoni bilan — YANGI Telegram klientlari SHUNDAY yuboradi
const withSig = sign(
  {
    user: { id: 900001, first_name: "Shahboz", username: "shahboz" },
    chat_instance: "-123",
    chat_type: "private",
    signature: "abcDEF123_ed25519_signature_placeholder",
  } as any,
  TOKEN,
  now
);
const r2 = verifyInitDataDetailed(withSig);
ok("rasmiy imzo qabul qilindi (signature BILAN)", r2.user?.id === 900001,
   r2.user ? "" : `→ rad etildi: ${r2.reason}`);

// 3. query_id bilan (inline tugmadan ochilganda)
const withQuery = sign(
  { user: { id: 900001, first_name: "Shahboz" }, query_id: "AAH1234567890" } as any,
  TOKEN, now
);
ok("query_id bilan ishlaydi", verifyInitDataDetailed(withQuery).user?.id === 900001);

// 4. start_param bilan (deep link)
const withStart = sign(
  { user: { id: 900001, first_name: "Shahboz" }, start_param: "ref_12345" } as any,
  TOKEN, now
);
ok("start_param bilan ishlaydi", verifyInitDataDetailed(withStart).user?.id === 900001);

// 5. Buzilgan ma'lumot rad etilishi kerak
const tampered = plain.replace(/first_name%22%3A%22Shahboz/, "first_name%22%3A%22Hacker");
ok("o'zgartirilgan ma'lumot rad etildi",
   tampered !== plain && verifyInitDataDetailed(tampered).user === null);

// 6. Boshqa bot tokeni bilan imzolangan
const wrongToken = sign({ user: { id: 1, first_name: "X" } }, "999999:BOSHQA_TOKEN_QALBAKI", now);
ok("begona token bilan imzo rad etildi", verifyInitDataDetailed(wrongToken).user === null);

// 7. Eskirgan
const old = sign({ user: { id: 1, first_name: "X" } }, TOKEN, new Date(Date.now() - 30 * 24 * 3600 * 1000));
const r7 = verifyInitDataDetailed(old);
ok("eskirgan initData 'expired' deb belgilandi", r7.user === null && r7.reason === "expired", `(${r7.reason})`);

// 8. Bo'sh
ok("bo'sh initData 'missing'", verifyInitDataDetailed("").reason === "missing");

console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 Rasmiy kutubxona bilan to'liq mos");
process.exit(fails ? 1 : 0);
