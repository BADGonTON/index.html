/**
 * TO'LOV OQIMI — "chek tashladim, bot javob bermadi" xatosi.
 *
 * Haqiqiy ketma-ketlik takrorlanadi:
 *   1. foydalanuvchi summani yozadi   → bot karta ma'lumotini yuboradi
 *   2. to'lov kanalida summa topiladi → bot NAMUNA RASM yuboradi
 *   3. foydalanuvchi chek rasmini tashlaydi
 *
 * 3-qadamda bot javobi CHATNING OXIRIDA, yangi xabar bo'lib chiqishi kerak.
 * Eski xabarni tahrirlasa — foydalanuvchi uchun bot "javob bermagan" bo'ladi.
 */
import type { Update } from "grammy/types";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

const USER = { id: 700124, is_bot: false, first_name: "Shahboz", username: "shahboz" };
const CHAT = { id: 700124, type: "private" as const, first_name: "Shahboz" };
const PAY_CHANNEL = -1001234567890;

let updateId = 1;
let messageId = 200;

function msg(extra: Record<string, unknown>): Update {
  return {
    update_id: updateId++,
    message: { message_id: messageId++, date: 0, chat: CHAT, from: USER, ...extra },
  } as Update;
}

interface Call { method: string; payload: any }

async function main(): Promise<void> {
  process.env.PAYMENT_CHANNEL_ID = String(PAY_CHANNEL);
  process.env.ADMIN_CHANNEL_ID = String(PAY_CHANNEL);

  const { runMigrations } = await import("../src/db/migrate");
  const { pool, closePool } = await import("../src/db/pool");
  const { createBot } = await import("../src/bot/bot");
  const pricing = await import("../src/services/pricing");
  const { bindLogger } = await import("../src/services/logger");

  await runMigrations();
  await pricing.loadPricing();
  await pool.query("DELETE FROM payments WHERE user_id = $1", [USER.id]);
  await pool.query("DELETE FROM users WHERE user_id = $1", [USER.id]);
  await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(USER.id)]);
  await pool.query(
    "INSERT INTO users (user_id, balance, offer_accepted_at, created_at) VALUES ($1,0,1,1)",
    [USER.id]
  );

  const bot = createBot();
  bindLogger(bot.api);

  const calls: Call[] = [];
  bot.api.config.use(async (_p, method, payload) => {
    calls.push({ method, payload });
    if (/^(send|edit)/.test(method)) {
      return { ok: true, result: { message_id: messageId++, date: 0, chat: CHAT } } as any;
    }
    return { ok: true, result: true } as any;
  });
  bot.botInfo = { id: 1, is_bot: true, first_name: "H", username: "h_bot",
    can_join_groups: true, can_read_all_group_messages: false,
    supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false };

  const take = () => calls.splice(0, calls.length);

  // 1. To'lov bo'limi va summa
  await bot.handleUpdate({
    update_id: updateId++,
    callback_query: { id: "1", from: USER, chat_instance: "1", data: "pay",
      message: { message_id: messageId++, date: 0, chat: CHAT, text: "…" } },
  } as Update);
  take();

  await bot.handleUpdate(msg({ text: "50000" }));
  const step1 = take();
  const instruction = step1.find((c) => /Karta raqami|karta/i.test(c.payload?.text ?? ""));
  ok("karta ma'lumoti chiqdi", Boolean(instruction), step1.map((c) => c.method).join(", "));

  const { rows } = await pool.query<{ unique_sum: number }>(
    "SELECT unique_sum FROM payments WHERE user_id = $1", [USER.id]
  );
  const unique = rows[0]?.unique_sum;
  ok("unikal summa ajratildi", Boolean(unique), String(unique));

  // 2. To'lov kanalida summa topildi → namuna rasm
  await bot.handleUpdate({
    update_id: updateId++,
    channel_post: { message_id: messageId++, date: 0,
      chat: { id: PAY_CHANNEL, type: "channel", title: "pay" },
      text: `#summa-${unique}` },
  } as Update);
  const step2 = take();
  const found = step2.find((c) => c.method === "sendPhoto" || c.method === "sendMessage");
  ok("to'lov aniqlandi xabari ketdi", Boolean(found), step2.map((c) => c.method).join(", "));
  ok("matn to'g'ri", /To'lov aniqlandi/.test(found?.payload?.caption ?? found?.payload?.text ?? ""),
     (found?.payload?.caption ?? found?.payload?.text ?? "").split("\n")[0]);

  // 3. Chek rasmi
  await bot.handleUpdate(msg({
    photo: [{ file_id: "AgACcheck", file_unique_id: "u", width: 90, height: 90 }],
  }));
  const step3 = take();
  console.log("   chaqiruvlar:", step3.map((c) => c.method).join(", "));

  const reply = step3.find(
    (c) => (c.method === "sendMessage" || c.method === "editMessageText") &&
           /tasdiqlandi|qo'shildi/i.test(c.payload?.text ?? "")
  );
  ok("tasdiq xabari bor", Boolean(reply), reply?.payload?.text?.split("\n")[0] ?? "yo'q");
  ok("YANGI xabar sifatida chiqdi (tahrirlanmadi)",
     reply?.method === "sendMessage", reply?.method ?? "-");

  const toChannel = step3.find((c) => c.method === "sendPhoto");
  ok("chek log kanalga ketdi", Boolean(toChannel), String(toChannel?.payload?.chat_id ?? "-"));

  const balance = await pool.query<{ balance: number }>(
    "SELECT balance FROM users WHERE user_id = $1", [USER.id]
  );
  ok("balans to'ldirildi", balance.rows[0].balance === 50000, String(balance.rows[0].balance));

  // 4. Ikkinchi chek — balans ikkilanmasligi kerak
  await bot.handleUpdate(msg({
    photo: [{ file_id: "AgACcheck2", file_unique_id: "u2", width: 90, height: 90 }],
  }));
  take();
  const again = await pool.query<{ balance: number }>(
    "SELECT balance FROM users WHERE user_id = $1", [USER.id]
  );
  ok("takroriy chek balansni ikkilantirmadi", again.rows[0].balance === 50000,
     String(again.rows[0].balance));

  // 5. To'lov hali topilmaganda chek tashlansa — bot JIM turmasligi kerak
  console.log("\n── Topilmagan to'lovga chek ──");
  await bot.handleUpdate({
    update_id: updateId++,
    callback_query: { id: "2", from: USER, chat_instance: "1", data: "pay",
      message: { message_id: messageId++, date: 0, chat: CHAT, text: "…" } },
  } as Update);
  take();
  await bot.handleUpdate(msg({ text: "30000" }));
  take();

  await bot.handleUpdate(msg({
    photo: [{ file_id: "AgACearly", file_unique_id: "u3", width: 90, height: 90 }],
  }));
  const step5 = take();
  const hint = step5.find((c) => /hali ko'rinmadi/i.test(c.payload?.text ?? ""));
  ok("bot jim qolmadi, tushuntirdi", Boolean(hint),
     (hint?.payload?.text ?? step5.map((c) => c.method).join(", ")).split("\n")[0]);
  ok("balans o'zgarmadi",
     (await pool.query("SELECT balance FROM users WHERE user_id = $1", [USER.id])).rows[0].balance === 50000);

  // 6. Fon xabaridan KEYIN menyu ham to'g'ri joyda chiqishi kerak
  console.log("\n── Fon xabaridan keyin ──");
  const { notifyUser } = await import("../src/services/logger");
  await notifyUser(USER.id, "Buyurtmangiz bajarildi");
  take();

  await bot.handleUpdate({
    update_id: updateId++,
    callback_query: { id: "3", from: USER, chat_instance: "1", data: "balance",
      message: { message_id: messageId++, date: 0, chat: CHAT, text: "…" } },
  } as Update);
  take();

  await bot.handleUpdate(msg({ text: "shunchaki matn" }));
  const step6 = take();
  ok("eski xabar tahrirlanib qolmadi",
     !step6.some((c) => c.method === "editMessageText" && c.payload?.message_id < messageId - 20),
     step6.map((c) => c.method).join(", ") || "javob yo'q");

  await pool.query("DELETE FROM users WHERE user_id = $1", [USER.id]);
  await pool.query("DELETE FROM payments WHERE user_id = $1", [USER.id]);
  await closePool();
  console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 To'lov oqimi testlari o'tdi");
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
