/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  GIFT KATALOGI — dublikat yo'q, hammasi premium
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ikkita muammo tekshiriladi:
 *
 *   1) BIR XIL gift ikki marta ko'rinardi. Katalog ikki manbadan yig'iladi
 *      (baza + Telegram API), va Telegram sovg'alarni yangilaganda bazadagi
 *      eski yozuvlar ro'yxatda qolib ketardi. Ular sotib bo'lmaydigan,
 *      lekin ko'rinadigan "ortiqcha" giftlar edi.
 *
 *   2) Telegram API'dan kelgan giftda premium emoji yo'q edi, shuning uchun
 *      ular oddiy emoji bilan chiqardi.
 *
 * Test botni Telegram'siz yurgizadi: `getAvailableGifts` soxta javob
 * qaytaradi va tugmalar yozib olinadi.
 */
import type { Update } from "grammy/types";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

const USER = { id: 700125, is_bot: false, first_name: "Shahboz", username: "shahboz" };
const CHAT = { id: 700125, type: "private" as const, first_name: "Shahboz" };

/** 009 migratsiyasidagi sovg'alar (yangi to'plam). */
const SEEDED = [
  { id: "6028601630662853006", star_count: 50, emoji: "🍾" },
  { id: "5170521118301225164", star_count: 100, emoji: "💎" },
  { id: "5170690322832818290", star_count: 100, emoji: "💍" },
  { id: "5168043875654172773", star_count: 100, emoji: "🏆" },
  { id: "5170564780938756245", star_count: 50, emoji: "🚀" },
  { id: "5170314324215857265", star_count: 50, emoji: "💐" },
  { id: "5170144170496491616", star_count: 50, emoji: "🎂" },
  { id: "5168103777563050263", star_count: 25, emoji: "🌹" },
  { id: "5170250947678437525", star_count: 25, emoji: "🎁" },
  { id: "5170233102089322756", star_count: 15, emoji: "🧸" },
  { id: "5170145012310081615", star_count: 15, emoji: "💝" },
];

/**
 * 002 + 010 migratsiyasidagi sovg'alar (eski to'plam).
 *
 * Ular Telegram'ning "mavjud sovg'alar" ro'yxatida YO'Q, lekin baribir
 * sotiladi va katalogda ko'rinishi kerak — `sendGift` gift ID bilan
 * ishlaydi, ro'yxat bilan emas.
 */
const OLD_SEEDED = [
  "6046178578163303744", "5974210632977745012", "6026193266406327981",
  "5969796561943660080", "5935895822435615975", "5893356958802511476",
  "5866352046986232958", "5956217000635139069", "5922558454332916696",
  "5801108895304779062", "5800655655995968830",
];

/**
 * Bazada bor, lekin Telegram "mavjud" ro'yxatida YO'Q gift.
 * U baribir sotiladi va ro'yxatda ko'rinishi kerak.
 */
const DB_ONLY = { id: "7777777777777777777", star_count: 30, emoji: "🐉" };

/**
 * Telegram o'z to'plamiga qo'shgan, LEKIN bizda yo'q gift.
 * Bunday gift ro'yxatga TUSHMASLIGI kerak — nima sotilishini biz hal qilamiz.
 */
const TG_ONLY = { id: "9999999999999999999", star_count: 200, emoji: "🦄" };

let updateId = 1;
let messageId = 300;

function callbackUpdate(data: string): Update {
  return {
    update_id: updateId++,
    callback_query: {
      id: String(updateId),
      from: USER,
      chat_instance: "1",
      data,
      message: { message_id: messageId++, date: 0, chat: CHAT, text: "…" },
    },
  } as Update;
}

interface Call {
  method: string;
  payload: any;
}

function buttons(payload: any): any[] {
  return (payload?.reply_markup?.inline_keyboard ?? []).flat();
}

async function main(): Promise<void> {
  const { runMigrations } = await import("../src/db/migrate");
  const { pool, closePool } = await import("../src/db/pool");
  const { createBot } = await import("../src/bot/bot");
  const pricing = await import("../src/services/pricing");
  const { listGifts } = await import("../src/db/repo/gifts");

  await runMigrations();
  await pricing.loadPricing();
  await pool.query("DELETE FROM users WHERE user_id = $1", [USER.id]);
  await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(USER.id)]);
  await pool.query(
    "INSERT INTO users (user_id, balance, offer_accepted_at, created_at) VALUES ($1,0,1,1)",
    [USER.id]
  );

  // Telegram ro'yxatida bo'lmagan, faqat bazadagi gift
  await pool.query(
    `INSERT INTO gifts (id, star_count, emoji, premium_id, active)
     VALUES ($1, $2, $3, NULL, TRUE)
     ON CONFLICT (id) DO UPDATE SET star_count = EXCLUDED.star_count, active = TRUE`,
    [DB_ONLY.id, DB_ONLY.star_count, DB_ONLY.emoji]
  );

  // ── Migratsiya natijasi ──
  console.log("\n── Baza ──");
  const dbGifts = await listGifts(true);
  const byId = new Map(dbGifts.map((g) => [g.id, g]));

  const missingOld = OLD_SEEDED.filter((id) => !byId.has(id));
  ok("eski 11 ta gift joyida", missingOld.length === 0, missingOld.join(" "));

  const missing = SEEDED.filter((s) => !byId.has(s.id));
  ok("yangi 11 ta gift ham bazada", missing.length === 0, missing.map((m) => m.emoji).join(" "));

  ok("bazada jami 22 ta gift", dbGifts.length >= 22, `${dbGifts.length} ta`);

  const oldNoPremium = OLD_SEEDED.filter((id) => !byId.get(id)?.premium_id);
  ok("eski giftlarda ham premium emoji bor", oldNoPremium.length === 0, oldNoPremium.join(" "));

  const noPremium = SEEDED.filter((s) => !byId.get(s.id)?.premium_id);
  ok("har birida premium emoji ID bor", noPremium.length === 0,
     noPremium.map((m) => m.emoji).join(" "));

  const wrongEmoji = SEEDED.filter((s) => byId.get(s.id)?.emoji !== s.emoji);
  ok("emojilar to'g'ri", wrongEmoji.length === 0,
     wrongEmoji.map((m) => `${m.emoji}≠${byId.get(m.id)?.emoji}`).join(" "));

  const wrongPrice = SEEDED.filter((s) => byId.get(s.id)?.star_count !== s.star_count);
  ok("narxlar to'g'ri", wrongPrice.length === 0,
     wrongPrice.map((m) => `${m.emoji} ${m.star_count}≠${byId.get(m.id)?.star_count}`).join(" "));

  const premiumIds = dbGifts.map((g) => g.premium_id).filter(Boolean);
  ok("premium ID'lar takrorlanmaydi", new Set(premiumIds).size === premiumIds.length,
     `${new Set(premiumIds).size}/${premiumIds.length}`);

  // ── Ro'yxat: Telegram API bilan birga ──
  console.log("\n── Katalog ro'yxati ──");

  const bot = createBot();
  const calls: Call[] = [];

  // Telegram API'ni taqlid qilamiz: u O'ZINING sovg'alarini qaytaradi.
  // Ularning ichida bazadagilar ham bor, bittasi esa YANGI (bazada yo'q).
  bot.api.config.use(async (_p, method, payload) => {
    if (method === "getAvailableGifts") {
      return {
        ok: true,
        result: {
          gifts: [
            ...SEEDED.slice(1).map((s) => ({
              id: s.id,
              sticker: { emoji: s.emoji },
              star_count: s.star_count,
            })),
            // Telegram qo'shgan sovg'a — bazada YO'Q, ro'yxatga tushmasligi kerak
            { id: TG_ONLY.id, sticker: { emoji: TG_ONLY.emoji }, star_count: TG_ONLY.star_count },
            // Bazadagi giftning narxi Telegram'da O'ZGARGAN — jonli narx olinishi kerak
            { id: SEEDED[0].id, sticker: { emoji: SEEDED[0].emoji }, star_count: 75 },
          ],
        },
      } as any;
    }
    calls.push({ method, payload });
    if (/^(send|edit)/.test(method)) {
      return { ok: true, result: { message_id: messageId++, date: 0, chat: CHAT } } as any;
    }
    return { ok: true, result: true } as any;
  });

  bot.botInfo = {
    id: 1, is_bot: true, first_name: "H", username: "h_bot",
    can_join_groups: true, can_read_all_group_messages: false,
    supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
  };

  // Barcha sahifalarni aylanib chiqamiz
  const seen: string[] = [];
  const labels: string[] = [];
  let withIcon = 0;

  // Sahifalar sonini xabar matnidan olamiz ("Sahifa: 1/2"). Aks holda
  // oxirgi sahifadan nariga o'tib bo'lmaydi va u qayta-qayta o'qilib,
  // giftlar "takrorlangandek" ko'rinardi.
  let totalPages = 1;

  for (let page = 0; page < 20; page++) {
    calls.length = 0;
    await bot.handleUpdate(callbackUpdate(`page_${page}`));
    const shown = calls.find((c) => /^(send|edit)Message/.test(c.method));
    if (!shown) break;

    const pageInfo = String(shown.payload.text ?? "").match(/Sahifa:\s*(\d+)\/(\d+)/);
    if (pageInfo) totalPages = Number(pageInfo[2]);

    for (const b of buttons(shown.payload)) {
      if (!String(b.callback_data ?? "").startsWith("buy_")) continue;
      seen.push(String(b.callback_data).split("_")[1]);
      labels.push(b.text);
      if (b.icon_custom_emoji_id) withIcon++;
    }

    if (page + 1 >= totalPages) break;
  }

  console.log(`   sahifalar: ${totalPages}`);

  console.log(`   ro'yxatda ${seen.length} ta gift:`, labels.join(" | "));

  ok("bitta gift ikki marta chiqmadi", new Set(seen).size === seen.length,
     `${new Set(seen).size} noyob / ${seen.length} ko'rsatilgan`);

  ok("Telegram'ning bizda YO'Q sovg'asi ro'yxatga tushmadi",
     !seen.includes(TG_ONLY.id),
     `${TG_ONLY.emoji} ${TG_ONLY.star_count} ⭐ — biz sotmaymiz`);

  // ENG MUHIM: bazadagi gift Telegram ro'yxatida bo'lmasa ham sotiladi.
  ok("Telegram ro'yxatida YO'Q gift ham ko'rindi", seen.includes(DB_ONLY.id),
     `${DB_ONLY.emoji} ${DB_ONLY.star_count} ⭐`);
  ok("uning emojisi o'zinikidek qoldi",
     labels.some((t) => t.includes(DB_ONLY.emoji)),
     labels.find((t) => t.includes(DB_ONLY.emoji)) ?? "yo'q");

  ok("yangi 11 ta gift ro'yxatda",
     SEEDED.every((s) => seen.includes(s.id)),
     SEEDED.filter((s) => !seen.includes(s.id)).map((s) => s.emoji).join(" ") || "hammasi");

  ok("eski 11 ta gift ham ro'yxatda",
     OLD_SEEDED.every((id) => seen.includes(id)),
     OLD_SEEDED.filter((id) => !seen.includes(id)).join(" ") || "hammasi");

  ok("katalogda faqat bazadagi giftlar", seen.length === dbGifts.length,
     `${seen.length} ko'rsatilgan / ${dbGifts.length} bazada`);

  // Narx Telegram'dan olinishi kerak: bazada 50 edi, Telegram 75 dedi.
  const livePrice = labels.some((t) => t.includes("75 ⭐️"));
  ok("narx Telegram'dagi jonli qiymatdan olindi", livePrice,
     labels.find((t) => t.includes("75")) ?? "topilmadi");

  // Premium ID'si bor 11 tasi ikonka bilan, bazada yo'q gift esa o'z emojisi bilan
  // 22 ta bazadagi giftning hammasida premium emoji bor
  ok("22 ta giftda ham premium ikonka bor",
     withIcon === SEEDED.length + OLD_SEEDED.length,
     `${withIcon}/${SEEDED.length + OLD_SEEDED.length}`);

  const unicorn = labels.find((t) => t.includes(DB_ONLY.emoji));
  ok("premium ID'siz gift o'z emojisi bilan chiqdi", Boolean(unicorn), unicorn ?? "yo'q");

  ok("premium giftlarning yozuvida emoji yo'q",
     labels.filter((t) => /^\d+ ⭐️$/.test(t)).length === SEEDED.length + OLD_SEEDED.length,
     labels.filter((t) => /^\d+ ⭐️$/.test(t)).length + " ta");

  // ── FILTR: bir xil ID ikkala manbada bo'lsa BITTA yozuvga birlashadi ──
  console.log("\n── Dublikat filtri ──");

  const inBoth = SEEDED.map((s) => s.id); // bular ham bazada, ham Telegram'da
  for (const id of inBoth) {
    const count = seen.filter((x) => x === id).length;
    if (count !== 1) fails++;
  }
  ok("ikkala manbada bor gift BIR MARTA chiqdi",
     inBoth.every((id) => seen.filter((x) => x === id).length === 1),
     `${inBoth.length} ta gift tekshirildi`);

  const dupes = seen.filter((id, i) => seen.indexOf(id) !== i);
  ok("umuman takrorlanish yo'q", dupes.length === 0, dupes.join(" ") || "toza");

  await pool.query("DELETE FROM users WHERE user_id = $1", [USER.id]);
  await pool.query("DELETE FROM gifts WHERE id = $1", [DB_ONLY.id]);
  await closePool();

  console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 Gift katalogi testlari o'tdi");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
