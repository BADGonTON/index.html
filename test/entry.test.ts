/**
 * KIRISH OQIMI — oferta va kanal a'zoligi.
 *
 * Bu test uchta HAQIQIY nosozlikni yopadi. Hammasi yangi foydalanuvchining
 * birinchi daqiqasida, ya'ni eng ko'rinadigan joyda sodir bo'lardi:
 *
 *   1) "Roziman" bosilganda rozilik BAZAGA YOZILMASDI. Ikkita alohida
 *      darvoza bor edi: tugma ofertaning darvozasidan o'tardi, keyingi —
 *      kanal darvozasi esa uni to'xtatardi va ushlovchi umuman
 *      ishlamasdi. Odam kanalga a'zo bo'lib qaytgach, bot undan ofertani
 *      QAYTADAN so'rardi.
 *
 *   2) A'zolik tasdiqlangach menyu ochilmasdi — "endi /start bosing"
 *      degan xabar chiqardi.
 *
 *   3) Oferta va kanal ikki alohida ekran edi, ya'ni yangi foydalanuvchi
 *      ikki marta tugma bosishi kerak edi.
 */
import type { Update } from "grammy/types";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

const ADMIN = 700600;
const NEW = 700601;    // yangi foydalanuvchi
const INV = 700602;    // uni taklif qilgan odam
const OLD = 700603;    // ofertaga allaqachon rozi bo'lgan eski foydalanuvchi
const ALL = [ADMIN, NEW, INV, OLD];

const CHANNEL = "@hozirol_test";

let updateId = 1;
let messageId = 700;

const userOf = (id: number) => ({ id, is_bot: false, first_name: "T", username: `u${id}` });
const chatOf = (id: number) => ({ id, type: "private" as const, first_name: "T" });

function cmd(userId: number, text: string): Update {
  return {
    update_id: updateId++,
    message: {
      message_id: messageId++, date: 0,
      chat: chatOf(userId), from: userOf(userId), text,
      entities: text.startsWith("/")
        ? [{ type: "bot_command" as const, offset: 0, length: text.split(" ")[0].length }]
        : undefined,
    },
  } as Update;
}

function tap(userId: number, data: string): Update {
  return {
    update_id: updateId++,
    callback_query: {
      id: String(updateId), from: userOf(userId), chat_instance: "1", data,
      message: { message_id: messageId++, date: 0, chat: chatOf(userId), text: "…" },
    },
  } as Update;
}

interface Call { method: string; payload: any }

async function main(): Promise<void> {
  process.env.ADMIN_IDS = String(ADMIN);
  process.env.OFFER_URL = "https://example.test/offer";

  const { runMigrations } = await import("../src/db/migrate");
  const { pool, closePool } = await import("../src/db/pool");
  const { createBot } = await import("../src/bot/bot");
  const { bindLogger } = await import("../src/services/logger");
  const pricing = await import("../src/services/pricing");
  const sub = await import("../src/services/subscription");
  const contest = await import("../src/db/repo/contest");

  await runMigrations();
  await pricing.loadPricing();

  const clean = async () => {
    await pool.query("DELETE FROM contest_refs WHERE inviter_id = ANY($1) OR invited_id = ANY($1)", [ALL]);
    await pool.query("DELETE FROM contests WHERE title LIKE 'ENTRY:%'");
    await pool.query("DELETE FROM users WHERE user_id = ANY($1)", [ALL]);
    await pool.query("DELETE FROM bot_sessions WHERE key = ANY($1)", [ALL.map(String)]);
  };
  await clean();

  // ADMIN va INV allaqachon kirgan; NEW butunlay yangi.
  for (const id of [ADMIN, INV, OLD]) {
    await pool.query(
      "INSERT INTO users (user_id, username, balance, offer_accepted_at, created_at) VALUES ($1,$2,0,1,1)",
      [id, `u${id}`]
    );
  }

  const bot = createBot();
  bindLogger(bot.api);

  const calls: Call[] = [];
  const members = new Set<number>();
  bot.api.config.use(async (_p, method, payload: any) => {
    calls.push({ method, payload });
    if (method === "getChatMember") {
      return {
        ok: true,
        result: { user: userOf(payload.user_id), status: members.has(payload.user_id) ? "member" : "left" },
      } as any;
    }
    if (/^(send|edit)/.test(method)) {
      return { ok: true, result: { message_id: messageId++, date: 0, chat: chatOf(1) } } as any;
    }
    return { ok: true, result: true } as any;
  });
  bot.botInfo = {
    id: 1, is_bot: true, first_name: "H", username: "h_bot", can_join_groups: true,
    can_read_all_group_messages: false, supports_inline_queries: false,
    can_connect_to_business: false, has_main_web_app: false,
  };

  const take = () => calls.splice(0, calls.length);
  const screens = (list: Call[]) =>
    list.filter((c) => /^(send|edit)/.test(c.method)).map((c) => String(c.payload?.text ?? ""));
  /** Oxirgi ekranning tugmalari. */
  const btns = (list: Call[]) => {
    const last = list.filter((c) => /^(send|edit)/.test(c.method)).pop();
    return (last?.payload?.reply_markup?.inline_keyboard ?? []).flat() as any[];
  };
  /** AYNAN menyu xabarining tugmalari — menyudan keyin boshqa xabarlar
   *  ham ketadi (masalan taklifchiga xabar), shuning uchun oxirgisi
   *  har doim menyu emas. */
  const menuButtons = (list: Call[]) => {
    const m = list.find(
      (c) => /^(send|edit)/.test(c.method) && isMenu(String(c.payload?.text ?? ""))
    );
    return (m?.payload?.reply_markup?.inline_keyboard ?? []).flat() as any[];
  };
  const alerts = (list: Call[]) =>
    list.filter((c) => c.method === "answerCallbackQuery").map((c) => String(c.payload?.text ?? ""));

  const isMenu = (t: string) => /Kerakli bo'limni tanlang/.test(t);

  // ═══════════════ 1. Darvoza yoqilgan: BITTA ekran ═══════════════
  console.log("\n── Yangi foydalanuvchi: bitta ekran ──");

  await sub.setChannel(CHANNEL, `https://t.me/${CHANNEL.slice(1)}`);
  await sub.setSubscriptionRequired(true);
  take();

  // HAQIQIY yo'l: odam referal havolasini bosib keladi.
  //
  // Darvoza `/start` ni ushlab, `next()` ni chaqirmaydi — ya'ni `/start`
  // ushlovchisi ishlamaydi. Taklifchi shu yerda yozilmasa, konkurs
  // uchun taklif butunlay yo'qoladi.
  await bot.handleUpdate(cmd(NEW, `/start ${INV}`));
  const first = take();
  const firstText = screens(first).pop() ?? "";
  const firstBtns = btns(first);

  ok("bitta ekranda oferta ham, kanal ham so'raldi",
     /oferta/i.test(firstText) && firstText.includes(CHANNEL),
     firstText.split("\n").filter((l) => l.trim()).slice(0, 4).join(" / ").slice(0, 90));
  ok("menyu ochilmadi", !isMenu(firstText));

  const refRow = await pool.query<{ referrer_id: string | null }>(
    "SELECT referrer_id FROM users WHERE user_id = $1", [NEW]
  );
  ok("TAKLIFCHI saqlandi (darvoza /start ni to'sgan bo'lsa ham)",
     Number(refRow.rows[0]?.referrer_id ?? 0) === INV,
     String(refRow.rows[0]?.referrer_id));
  ok("oferta havolasi tugmasi bor", firstBtns.some((b) => /oferta/i.test(b.text) && b.url));
  ok("kanal havolasi tugmasi bor", firstBtns.some((b) => /Kanalga/i.test(b.text) && b.url));
  ok("tasdiq tugmasi BITTA",
     firstBtns.filter((b) => b.callback_data === "entry_ok").length === 1,
     firstBtns.map((b) => `${b.text}${b.callback_data ? `[${b.callback_data}]` : ""}`).join(" | "));

  // ═══════════════ 2. A'zo bo'lmasdan bosish ═══════════════
  //
  // ENG MUHIM TEKSHIRUV: a'zolik o'tmasa ham ROZILIK YOZILISHI kerak.
  // Aks holda odam kanalga a'zo bo'lib qaytgach, bot undan ofertani
  // qaytadan so'rardi — aynan shu nosozlik bo'lgan.
  console.log("\n── A'zo bo'lmasdan tasdiqlash ──");

  take();
  await bot.handleUpdate(tap(NEW, "entry_ok"));
  const noMember = take();

  ok("a'zo emasligi aytildi",
     noMember.some((c) => c.method === "answerCallbackQuery" && c.payload?.show_alert === true),
     alerts(noMember).join(" | "));
  ok("menyu ochilmadi", !screens(noMember).some(isMenu));

  const afterTry = await pool.query<{ offer_accepted_at: string | null }>(
    "SELECT offer_accepted_at FROM users WHERE user_id = $1", [NEW]
  );
  ok("ROZILIK BAZAGA YOZILDI (oferta qayta so'ralmaydi)",
     Number(afterTry.rows[0]?.offer_accepted_at ?? 0) > 0,
     String(afterTry.rows[0]?.offer_accepted_at));

  const secondText = screens(noMember).pop() ?? "";
  ok("endi ekranda FAQAT kanal so'raladi",
     secondText.includes(CHANNEL) && !/Ommaviy oferta/i.test(secondText),
     secondText.split("\n").filter((l) => l.trim())[0] ?? "");

  // ═══════════════ 3. A'zo bo'lib bosish → MENYU ═══════════════
  console.log("\n── A'zo bo'lib tasdiqlash ──");

  const active = await contest.startContest({
    title: "ENTRY: Sinov", prize: "Sovrin", winnersCount: 3,
  });

  members.add(NEW);
  take();
  await bot.handleUpdate(tap(NEW, "entry_ok"));
  const joined = take();

  ok("MENYU DARHOL ochildi", screens(joined).some(isMenu),
     screens(joined).map((t) => t.split("\n")[0]).join(" | ").slice(0, 80));
  ok("«/start bosing» deyilmadi",
     !screens(joined).some((t) => /\/start/.test(t)),
     screens(joined).find((t) => /\/start/.test(t))?.slice(0, 50) ?? "aytilmadi");

  const menuBtns = menuButtons(joined);
  ok("menyu tugmalari chiqdi",
     menuBtns.some((b) => /Stars/.test(b.text)) && menuBtns.some((b) => /Balans/.test(b.text)),
     menuBtns.map((b) => b.text).join(" | "));

  const row = await pool.query<{ channel_joined_at: string }>(
    "SELECT channel_joined_at FROM users WHERE user_id = $1", [NEW]
  );
  ok("a'zolik bazaga yozildi", Number(row.rows[0]?.channel_joined_at ?? 0) > 0);
  ok("taklif konkursga sanaldi",
     (await contest.countUserInvites(active.id, INV)) === 1,
     String(await contest.countUserInvites(active.id, INV)));

  // ═══════════════ 4. Oferta QAYTA so'ralmaydi ═══════════════
  console.log("\n── Keyingi harakatlar ──");

  await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(NEW)]);
  take();
  await bot.handleUpdate(tap(NEW, "balance"));
  const after = screens(take());
  ok("oferta QAYTA so'ralmadi",
     !after.some((t) => /Ommaviy oferta|oferta shartlarini/i.test(t)),
     after.map((t) => t.split("\n")[0]).join(" | ").slice(0, 70));
  ok("balans ekrani ochildi", after.some((t) => /Balans/i.test(t)));

  // ═══════════════ 5. Eski tugma nomlari ═══════════════
  //
  // Yangilanishdan oldin yuborilgan xabarlar foydalanuvchilarning
  // chatida qolgan — o'sha tugmalar ishlashda davom etishi kerak.
  console.log("\n── Eski tugma nomlari ──");

  for (const old of ["offer_accept", "sub_check"]) {
    await pool.query("DELETE FROM users WHERE user_id = $1", [OLD]);
    await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(OLD)]);
    await pool.query("INSERT INTO users (user_id, created_at) VALUES ($1, 1)", [OLD]);
    members.add(OLD);
    take();
    await bot.handleUpdate(tap(OLD, old));
    const r = screens(take());
    ok(`«${old}» hali ishlaydi`, r.some(isMenu),
       r.map((t) => t.split("\n")[0]).join(" | ").slice(0, 60));
  }

  // ═══════════════ 6. Admin kanaldan ozod ═══════════════
  console.log("\n── Admin ──");

  await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(ADMIN)]);
  take();
  await bot.handleUpdate(cmd(ADMIN, "/start"));
  const adminScreens = screens(take());
  ok("admindan kanal so'ralmadi",
     !adminScreens.some((t) => t.includes(CHANNEL)),
     adminScreens.map((t) => t.split("\n")[0]).join(" | ").slice(0, 60));
  ok("adminga menyu chiqdi", adminScreens.some(isMenu));

  // ═══════════════ 7. Darvoza o'chiq ═══════════════
  console.log("\n── Darvoza o'chiq ──");

  await sub.setSubscriptionRequired(false);
  await pool.query("DELETE FROM users WHERE user_id = $1", [NEW]);
  await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(NEW)]);
  take();

  await bot.handleUpdate(cmd(NEW, "/start"));
  const offOnly = screens(take()).pop() ?? "";
  ok("faqat oferta so'raldi (kanal yo'q)",
     /oferta/i.test(offOnly) && !offOnly.includes(CHANNEL),
     offOnly.split("\n").filter((l) => l.trim())[0] ?? "");

  take();
  await bot.handleUpdate(tap(NEW, "entry_ok"));
  ok("rozilikdan keyin menyu ochildi", screens(take()).some(isMenu));

  // ═══════════════ Tozalash ═══════════════
  await sub.setChannel("", "");
  await sub.setSubscriptionRequired(false);
  await pool.query("DELETE FROM contests WHERE title LIKE 'ENTRY:%'");
  await clean();
  await closePool();

  console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 Kirish oqimi testlari o'tdi");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
