/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  BOT OQIMI — Telegram'siz, lekin haqiqiy kod bilan
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Bot Telegram API'ga chiqmaydi: `bot.api` ga transformer qo'yiladi va
 * har bir chaqiruv (sendMessage, editMessageText, ...) YOZIB OLINADI.
 * Shundan keyin botga haqiqiy `Update` obyektlari beriladi — ya'ni kod
 * xuddi ishlab chiqarishdagidek bajariladi.
 *
 * Nimani kafolatlaydi:
 *
 *   • birinchi /start OFERTA so'raydi, boshqa hech narsa ochilmaydi
 *   • rozilikdan oldin tugmalar ishlamaydi (Telegram talabi)
 *   • rozilikdan keyin bosh menyu chiqadi va rozilik BAZADA qoladi
 *   • menyu tuzilishi kelishilganidek (Stars / Gift / Arenda / Balans / Profil)
 *   • tugma bosilganda YANGI xabar yuborilmaydi — eskisi TAHRIRLANADI
 *   • tugmalarda premium ikonka bor, yozuvida emoji yo'q
 */
import type { Update } from "grammy/types";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

const USER = { id: 700123, is_bot: false, first_name: "Shahboz", username: "shahboz" };
const CHAT = { id: 700123, type: "private" as const, first_name: "Shahboz" };

const ADMIN = { id: 700999, is_bot: false, first_name: "Admin", username: "admin" };
const ADMIN_CHAT = { id: 700999, type: "private" as const, first_name: "Admin" };

/** Yozib olingan API chaqiruvi. */
interface Call {
  method: string;
  payload: any;
}

let updateId = 1;
let messageId = 100;

function textUpdate(text: string): Update {
  return {
    update_id: updateId++,
    message: {
      message_id: messageId++,
      date: Math.floor(Date.now() / 1000),
      chat: CHAT,
      from: USER,
      text,
      entities: text.startsWith("/")
        ? [{ type: "bot_command" as const, offset: 0, length: text.split(" ")[0].length }]
        : undefined,
    },
  } as Update;
}

function callbackUpdate(data: string, msgId: number): Update {
  return {
    update_id: updateId++,
    callback_query: {
      id: String(updateId),
      from: USER,
      chat_instance: "1",
      data,
      message: {
        message_id: msgId,
        date: Math.floor(Date.now() / 1000),
        chat: CHAT,
        text: "…",
      },
    },
  } as Update;
}

function adminTextUpdate(text: string): Update {
  return {
    update_id: updateId++,
    message: {
      message_id: messageId++,
      date: Math.floor(Date.now() / 1000),
      chat: ADMIN_CHAT,
      from: ADMIN,
      text,
      entities: text.startsWith("/")
        ? [{ type: "bot_command" as const, offset: 0, length: text.split(" ")[0].length }]
        : undefined,
    },
  } as Update;
}

function adminCallbackUpdate(data: string, msgId: number): Update {
  return {
    update_id: updateId++,
    callback_query: {
      id: String(updateId),
      from: ADMIN,
      chat_instance: "1",
      data,
      message: { message_id: msgId, date: Math.floor(Date.now() / 1000), chat: ADMIN_CHAT, text: "…" },
    },
  } as Update;
}

/** Klaviaturadagi barcha tugmalar (bir tekis ro'yxat). */
function buttons(payload: any): any[] {
  return (payload?.reply_markup?.inline_keyboard ?? []).flat();
}

async function main(): Promise<void> {
  // Broadcast bosqichi uchun ALOHIDA admin kerak: asosiy USER oddiy
  // foydalanuvchi bo'lib qolishi shart, aks holda texnik ishlar testi
  // ma'nosini yo'qotadi (adminlarga texnik ishlar ta'sir qilmaydi).
  // `config` import paytida o'qiladi — shuning uchun importlardan OLDIN.
  process.env.ADMIN_IDS = String(ADMIN.id);

  const { runMigrations } = await import("../src/db/migrate");
  const { pool, closePool } = await import("../src/db/pool");
  const { createBot } = await import("../src/bot/bot");
  const pricing = await import("../src/services/pricing");

  await runMigrations();
  await pricing.loadPricing();
  // Oldingi ishga tushirishdan qolgan iz bo'lmasin: foydalanuvchi ham,
  // uning sessiyasi ham tozalanadi. Aks holda bot eski xabarni tahrirlashga
  // urinadi va test "yangi foydalanuvchi" holatini sinamaydi.
  await pool.query("DELETE FROM users WHERE user_id = $1", [USER.id]);
  await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(USER.id)]);
  await pool.query("DELETE FROM users WHERE user_id = $1", [ADMIN.id]);
  await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(ADMIN.id)]);

  const bot = createBot();

  // Telegram'ga chiqmaymiz: har bir chaqiruvni yozib olamiz va soxta
  // javob qaytaramiz.
  const calls: Call[] = [];
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload });
    if (method === "sendMessage" || method === "editMessageText") {
      return {
        ok: true,
        result: { message_id: messageId++, date: 0, chat: CHAT, text: (payload as any).text },
      } as any;
    }
    return { ok: true, result: true } as any;
  });

  // `bot.init()` Telegram'ga getMe qiladi — o'rniga o'zimiz to'ldiramiz.
  bot.botInfo = {
    id: 1,
    is_bot: true,
    first_name: "HozirOL",
    username: "hozirol_test_bot",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
  };

  const take = (): Call[] => calls.splice(0, calls.length);

  // ── 1. Birinchi /start: oferta ──
  console.log("\n── Birinchi /start ──");
  await bot.handleUpdate(textUpdate("/start"));
  let sent = take();

  // Yangi foydalanuvchida tahrirlanadigan xabar yo'q — yangisi yuboriladi.
  const offerMsg = sent.find((c) => c.method === "sendMessage");
  ok("javob yuborildi", Boolean(offerMsg), sent.map((c) => c.method).join(", "));
  ok("oferta so'raldi", /oferta/i.test(offerMsg?.payload.text ?? ""),
     (offerMsg?.payload.text ?? "").split("\n")[0]);
  ok("bosh menyu chiqmadi", !/Kerakli bo'limni tanlang/.test(offerMsg?.payload.text ?? ""));

  const offerBtns = buttons(offerMsg?.payload);
  ok("«Roziman» tugmasi bor",
     offerBtns.some((b) => b.callback_data === "offer_accept" && /Roziman/.test(b.text)),
     offerBtns.map((b) => b.text).join(" | "));
  ok("oferta havolasi tugmasi bor", offerBtns.some((b) => typeof b.url === "string"),
     offerBtns.map((b) => b.url ?? "-").join(" | "));

  const offerMsgId = (offerMsg?.payload as any)?.__id ?? 500;

  // ── 2. Rozilikdan OLDIN boshqa tugma ──
  console.log("\n── Rozilikdan oldin ──");
  await bot.handleUpdate(callbackUpdate("stars", offerMsgId));
  sent = take();

  const alert = sent.find((c) => c.method === "answerCallbackQuery");
  ok("ogohlantirish chiqdi", Boolean(alert?.payload.show_alert), alert?.payload.text ?? "");
  ok("Stars bo'limi OCHILMADI",
     !sent.some((c) => /Stars va Premium/.test(c.payload?.text ?? "")),
     sent.map((c) => c.method).join(", "));

  // Bazada ham rozilik yo'q
  const before = await pool.query("SELECT offer_accepted_at FROM users WHERE user_id = $1", [USER.id]);
  ok("bazada rozilik yo'q", before.rows[0]?.offer_accepted_at === null);

  // ── 3. Roziman ──
  console.log("\n── Roziman ──");
  await bot.handleUpdate(callbackUpdate("offer_accept", offerMsgId));
  sent = take();

  ok("xabar TAHRIRLANDI (yangisi emas)",
     sent.some((c) => c.method === "editMessageText") && !sent.some((c) => c.method === "sendMessage"),
     sent.map((c) => c.method).join(", "));

  const menu = sent.find((c) => c.method === "editMessageText");
  ok("bosh menyu chiqdi", /Kerakli bo'limni tanlang/.test(menu?.payload.text ?? ""),
     (menu?.payload.text ?? "").split("\n")[0]);

  const after = await pool.query("SELECT offer_accepted_at FROM users WHERE user_id = $1", [USER.id]);
  ok("rozilik bazaga yozildi", Number(after.rows[0]?.offer_accepted_at) > 0);

  // ── 4. Menyu tuzilishi ──
  console.log("\n── Bosh menyu ──");
  const main = buttons(menu?.payload);
  const labels = main.map((b) => b.text);
  console.log("   tugmalar:", labels.join(" | "));

  for (const want of ["Stars", "Gift olish", "Balans", "Profil olish", "Support"]) {
    ok(`«${want}» bor`, labels.includes(want));
  }
  ok("Gift Arenda Mini App tugmasi", main.some((b) => b.web_app), "");

  ok("HAR BIR tugmada premium ikonka",
     main.every((b) => typeof b.icon_custom_emoji_id === "string"),
     main.filter((b) => !b.icon_custom_emoji_id).map((b) => b.text).join(", ") || "hammasida bor");

  ok("tugma yozuvlarida emoji YO'Q",
     !labels.some((t: string) => /[\u{1F000}-\u{1FAFF}\u{2300}-\u{27BF}\u{25A0}-\u{25FF}]/u.test(t)),
     labels.join(" | "));

  ok("matnda premium emoji ishlatilgan",
     (menu?.payload.text ?? "").includes("<tg-emoji emoji-id="));

  // ── 5. Stars bo'limi ──
  console.log("\n── Stars bo'limi ──");
  await bot.handleUpdate(callbackUpdate("stars", offerMsgId));
  sent = take();

  const stars = sent.find((c) => c.method === "editMessageText");
  ok("tahrirlandi, yangi xabar yo'q", Boolean(stars) && !sent.some((c) => c.method === "sendMessage"),
     sent.map((c) => c.method).join(", "));

  const starsBtns = buttons(stars?.payload).map((b) => b.text);
  console.log("   tugmalar:", starsBtns.join(" | "));
  ok("«Stars olish» bor", starsBtns.includes("Stars olish"));
  ok("«Premium olish» bor", starsBtns.includes("Premium olish"));
  ok("«Orqaga qaytish» bor", starsBtns.includes("Orqaga qaytish"));

  // ── 6. Balans ──
  console.log("\n── Balans ──");
  await bot.handleUpdate(callbackUpdate("balance", offerMsgId));
  sent = take();
  const bal = sent.find((c) => c.method === "editMessageText");
  const balBtns = buttons(bal?.payload).map((b) => b.text);
  console.log("   tugmalar:", balBtns.join(" | "));
  ok("«To'lov» bor", balBtns.includes("To'lov"));
  ok("«Referal» bor", balBtns.includes("Referal"));
  ok("yangi xabar yuborilmadi", !sent.some((c) => c.method === "sendMessage"));

  // ── 7. Ikkinchi /start — oferta qayta so'ralmaydi ──
  console.log("\n── Ikkinchi /start ──");
  await bot.handleUpdate(textUpdate("/start"));
  sent = take();
  const second = sent.find((c) => c.method === "editMessageText" || c.method === "sendMessage");
  ok("oferta QAYTA so'ralmadi", !/oferta/i.test(second?.payload.text ?? ""),
     (second?.payload.text ?? "").split("\n")[0]);
  ok("bosh menyu chiqdi", /Kerakli bo'limni tanlang/.test(second?.payload.text ?? ""));

  // ── 8. /start CHATNING OXIRIDA chiqishi kerak ──
  //
  // Oraliqda fon xabari tushgan bo'lsa (buyurtma bajarildi va h.k.),
  // menyu uning YUQORISIDA paydo bo'lmasligi kerak — aks holda chat
  // chalkash ko'rinadi.
  console.log("\n── /start fon xabaridan keyin ──");
  const { notifyUser } = await import("../src/services/logger");
  await notifyUser(USER.id, "Buyurtmangiz bajarildi");
  take();

  await bot.handleUpdate(textUpdate("/start"));
  sent = take();
  console.log("   chaqiruvlar:", sent.map((c) => c.method).join(", "));
  ok("menyu YANGI xabar bo'lib pastda chiqdi",
     sent.some((c) => c.method === "sendMessage") &&
       !sent.some((c) => c.method === "editMessageText"),
     sent.map((c) => c.method).join(", "));

  // ── 9. Texnik ishlar rejimi ──
  console.log("\n── Texnik ishlar ──");
  const { toggleMaintenance } = await import("../src/services/maintenance");
  await toggleMaintenance();

  await bot.handleUpdate(callbackUpdate("stars", offerMsgId));
  sent = take();
  // Ogohlantirish `answerCallbackQuery` da ham chiqadi — bizga CHATDAGI
  // xabar kerak, shuning uchun metodni ham tekshiramiz.
  const notice = sent.find(
    (c) => c.method === "sendMessage" && /Texnik ishlar bormoqda/.test(c.payload?.text ?? "")
  );
  ok("oddiy foydalanuvchi to'xtatildi", Boolean(notice),
     (notice?.payload?.text ?? sent.map((c) => c.method).join(", ")).split("\n")[0]);
  ok("Stars bo'limi ochilmadi",
     !sent.some((c) => /Stars va Premium/.test(c.payload?.text ?? "")));
  ok("support tugmasi bor",
     buttons(notice?.payload).some((b) => typeof b.url === "string"),
     buttons(notice?.payload).map((b) => b.text).join(" | "));

  await bot.handleUpdate(textUpdate("/start"));
  sent = take();
  ok("/start ham to'xtatildi",
     sent.some((c) => /Texnik ishlar bormoqda/.test(c.payload?.text ?? "")));

  await toggleMaintenance();
  await bot.handleUpdate(callbackUpdate("stars", offerMsgId));
  sent = take();
  ok("o'chirilgach yana ishladi",
     sent.some((c) => /Stars va Premium/.test(c.payload?.text ?? "")),
     sent.map((c) => c.method).join(", "));

  // ── 10. Broadcast: ASL XABAR CHATDA QOLISHI SHART ──
  //
  // Broadcast xabarni `copyMessage` bilan ko'chiradi. Matn bosqichlarida
  // bot foydalanuvchi xabarini odatda o'chiradi — lekin bu yerda
  // o'chirsa, "Yuborish" bosilganda Telegram har bir foydalanuvchi uchun
  // `400: message to copy not found` qaytaradi va xabar HECH KIMGA
  // yetib bormaydi. Aynan shu nosozlik bo'lgan edi: 155 dan 0 ta yetdi.
  console.log("\n── Broadcast ──");

  // Admin ham ofertadan o'tadi — darvoza hamma uchun bir xil.
  await bot.handleUpdate(adminTextUpdate("/start"));
  let adminMsgId = (take().find((c) => c.method === "sendMessage")?.result as any)?.message_id ?? 1;
  await bot.handleUpdate(adminCallbackUpdate("offer_accept", adminMsgId));
  take();

  await bot.handleUpdate(adminCallbackUpdate("admin_broadcast", adminMsgId));
  take();

  const draft = adminTextUpdate("Assalomu alaykum, yangilik bor!");
  const draftId = draft.message!.message_id;
  await bot.handleUpdate(draft);
  sent = take();

  ok("asl xabar O'CHIRILMADI",
     !sent.some((c) => c.method === "deleteMessage" && c.payload?.message_id === draftId),
     sent.map((c) => c.method).join(", "));
  ok("tasdiq so'raldi",
     sent.some((c) => /Davom etasizmi/.test(c.payload?.text ?? "")),
     sent.map((c) => c.method).join(", "));

  // Boshqa bosqichlarda esa o'chirish AVVALGIDEK ishlaydi.
  await bot.handleUpdate(adminCallbackUpdate("broadcast_cancel", adminMsgId));
  take();
  await bot.handleUpdate(adminCallbackUpdate("pay", adminMsgId));
  take();
  const amount = adminTextUpdate("50000");
  const amountId = amount.message!.message_id;
  await bot.handleUpdate(amount);
  sent = take();
  ok("boshqa bosqichda xabar avvalgidek o'chiriladi",
     sent.some((c) => c.method === "deleteMessage" && c.payload?.message_id === amountId),
     sent.map((c) => c.method).join(", "));

  await pool.query("DELETE FROM users WHERE user_id = $1", [ADMIN.id]);
  await pool.query("DELETE FROM users WHERE user_id = $1", [USER.id]);
  await closePool();

  console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 Bot oqimi testlari o'tdi");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
