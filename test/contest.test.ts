/**
 * REFERAL KONKURSI.
 *
 * Konkursda hamma gap SANOQDA. Shuning uchun bu test raqamni
 * ko'tarishning har bir yo'lini alohida yopadi:
 *
 *   • havolani bosish O'ZI yetarli emas — kanalga a'zo bo'lish shart
 *   • bir odam IKKI marta sanalmaydi (kanaldan chiqib qayta kirsa ham)
 *   • o'zini o'zi taklif qilish sanalmaydi
 *   • yakunlangan konkursning g'oliblari O'ZGARMAYDI
 *
 * Oxirgisi ayniqsa muhim: g'oliblar kanalda E'LON QILINADI. Agar ro'yxat
 * keyinroq qayta hisoblansa, e'lon qilingan natija jim turib o'zgarardi.
 */
import type { Update } from "grammy/types";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

const ADMIN = 700300;
const A = 700301;   // taklif qiluvchi
const B = 700302;   // taklif qiluvchi
const X = 700311;   // A taklif qilgan
const Y = 700312;   // A taklif qilgan
const Z = 700313;   // B taklif qilgan
const ALL = [ADMIN, A, B, X, Y, Z];

const CHANNEL = "@hozirol_test";

let updateId = 1;
let messageId = 500;

function chatOf(id: number) {
  return { id, type: "private" as const, first_name: "T" };
}
function userOf(id: number) {
  return { id, is_bot: false, first_name: "T", username: `u${id}` };
}

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
    await pool.query("DELETE FROM contest_winners WHERE user_id = ANY($1)", [ALL]);
    await pool.query("DELETE FROM contests WHERE title LIKE 'TEST:%'");
    await pool.query("DELETE FROM users WHERE user_id = ANY($1)", [ALL]);
    await pool.query("DELETE FROM bot_sessions WHERE key = ANY($1)", [ALL.map(String)]);
  };
  await clean();

  // Hamma oferta bergan holda turadi — bu test obuna darvozasini
  // tekshiradi, ofertani emas.
  for (const id of ALL) {
    await pool.query(
      `INSERT INTO users (user_id, username, balance, offer_accepted_at, created_at)
       VALUES ($1, $2, 0, 1, 1)`,
      [id, `u${id}`]
    );
  }
  // Taklif qilinganlarning referrer'i — bazada shunday yoziladi.
  await pool.query("UPDATE users SET referrer_id = $1 WHERE user_id = ANY($2)", [A, [X, Y]]);
  await pool.query("UPDATE users SET referrer_id = $1 WHERE user_id = $2", [B, Z]);

  const bot = createBot();
  bindLogger(bot.api);

  const calls: Call[] = [];
  /** Kanalda kim bor — testda biz boshqaramiz. */
  const members = new Set<number>();
  /** `getChatMember` butunlay yiqiladigan holat. */
  let chatMemberBroken = false;

  bot.api.config.use(async (_prev, method, payload: any) => {
    calls.push({ method, payload });

    if (method === "getChatMember") {
      if (chatMemberBroken) throw new Error("Bad Request: CHAT_ADMIN_REQUIRED");
      return {
        ok: true,
        result: {
          user: userOf(payload.user_id),
          status: members.has(payload.user_id) ? "member" : "left",
        },
      } as any;
    }
    if (/^(send|edit|copy)/.test(method)) {
      return { ok: true, result: { message_id: messageId++, date: 0, chat: chatOf(1) } } as any;
    }
    return { ok: true, result: true } as any;
  });
  bot.botInfo = {
    id: 1, is_bot: true, first_name: "H", username: "h_bot",
    can_join_groups: true, can_read_all_group_messages: false,
    supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
  };

  const take = () => calls.splice(0, calls.length);
  const sentTo = (list: Call[], userId: number) =>
    list.filter((c) => c.method === "sendMessage" && c.payload?.chat_id === userId);
  const textsTo = (list: Call[], userId: number) =>
    sentTo(list, userId).map((c) => String(c.payload.text));

  // ═══════════════════ 1. Darvoza o'chiq ═══════════════════
  //
  // Konkurs tizimi botga TO'SIQ QO'YMASLIGI kerak: admin yoqmaguncha
  // hamma narsa ilgarigidek ishlaydi.
  console.log("\n── Darvoza o'chiq ──");

  await sub.setChannel("", "");
  await sub.setSubscriptionRequired(false);
  take();

  await bot.handleUpdate(cmd(X, "/start"));
  const off = textsTo(take(), X);
  ok("darvoza o'chiqda menyu chiqdi",
     off.length > 0 && !off.some((t) => /a'zo bo'ling/i.test(t)),
     off.length ? off[0].slice(0, 42).replace(/\n/g, " ") : "javob yo'q");

  // ═══════════════════ 2. Darvoza yoqilgan ═══════════════════
  console.log("\n── Darvoza yoqilgan ──");

  await sub.setChannel(CHANNEL, `https://t.me/${CHANNEL.slice(1)}`);
  await sub.setSubscriptionRequired(true);
  ok("darvoza yoqildi", sub.isSubscriptionRequired());

  // Sessiyada "tekshirilgan" belgisi qolmasligi uchun tozalaymiz.
  await pool.query("DELETE FROM bot_sessions WHERE key = ANY($1)", [ALL.map(String)]);
  take();

  await bot.handleUpdate(cmd(X, "/start"));
  const gated = textsTo(take(), X);
  ok("a'zo bo'lmagan odam to'sildi",
     gated.some((t) => /a'zo bo'ling/i.test(t)),
     gated.map((t) => t.slice(0, 30)).join(" | ") || "javob yo'q");
  ok("menyu ko'rsatilmadi", !gated.some((t) => /Gift|Arenda|Balans/i.test(t)));

  // Adminni darvoza TO'XTATMAYDI — aks holda kanalni sozlayotgan odam
  // o'z darvozasi ortida qolib ketardi.
  await bot.handleUpdate(cmd(ADMIN, "/start"));
  const adminTexts = textsTo(take(), ADMIN);
  ok("admin darvozadan o'tdi",
     adminTexts.length > 0 && !adminTexts.some((t) => /a'zo bo'ling/i.test(t)),
     adminTexts.length ? "menyu" : "javob yo'q");

  // ═══════════════════ 3. Konkurs boshlanadi ═══════════════════
  console.log("\n── Konkurs ──");

  const started = await contest.startContest({
    title: "TEST: Bahorgi konkurs", prize: "1 000 000 so'm", winnersCount: 2,
  });
  ok("konkurs boshlandi", started.status === "active", started.title);

  const active = await contest.getActiveContest();
  ok("faol konkurs topildi", active?.id === started.id);

  // ═══════════════════ 4. Taklif FAQAT a'zolikdan keyin ═══════════════════
  console.log("\n── Taklif sanog'i ──");

  // X hali kanalda yo'q — "tekshirdim" tugmasi uni o'tkazmasligi kerak.
  take();
  await bot.handleUpdate(tap(X, "sub_check"));
  const notYet = take();
  ok("a'zo bo'lmasa ogohlantiriladi",
     notYet.some((c) => c.method === "answerCallbackQuery" && c.payload?.show_alert === true),
     notYet.map((c) => c.method).join(", "));
  ok("a'zo bo'lmaganda taklif sanalmadi",
     (await contest.countUserInvites(started.id, A)) === 0);

  // Endi X kanalga qo'shildi.
  members.add(X);
  take();
  await bot.handleUpdate(tap(X, "sub_check"));
  const joined = take();
  ok("a'zo bo'lgach ichkariga kiritildi",
     textsTo(joined, X).length > 0,
     joined.map((c) => c.method).join(", "));
  ok("taklif A ga yozildi", (await contest.countUserInvites(started.id, A)) === 1);
  ok("taklif qilgan odamga xabar ketdi",
     textsTo(joined, A).some((t) => /taklif/i.test(t)),
     textsTo(joined, A).join(" | ").slice(0, 60) || "xabar yo'q");

  // Kanaldan chiqib qayta kirish — sanoq O'SMASLIGI kerak. Busiz
  // reytingni bitta akkaunt bilan cheksiz ko'tarish mumkin bo'lardi.
  await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(X)]);
  await pool.query("UPDATE users SET channel_joined_at = 0 WHERE user_id = $1", [X]);
  take();
  await bot.handleUpdate(tap(X, "sub_check"));
  take();
  ok("qayta a'zo bo'lish IKKINCHI marta sanalmadi",
     (await contest.countUserInvites(started.id, A)) === 1,
     String(await contest.countUserInvites(started.id, A)));

  // O'zini o'zi taklif qilish.
  ok("o'zini o'zi taklif qilish sanalmaydi",
     (await contest.countReferral(started.id, A, A)) === false);

  // Qolganlar ham qo'shiladi: A = 2, B = 1.
  for (const id of [Y, Z]) {
    members.add(id);
    await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(id)]);
    await bot.handleUpdate(tap(id, "sub_check"));
  }
  take();
  ok("A ning taklifi 2 ta", (await contest.countUserInvites(started.id, A)) === 2);
  ok("B ning taklifi 1 ta", (await contest.countUserInvites(started.id, B)) === 1);

  // ═══════════════════ 5. Liderlar ═══════════════════
  console.log("\n── Liderlar ──");

  const leaders = await contest.getLeaders(started.id, 10);
  ok("jadvalda ikki ishtirokchi", leaders.length === 2, String(leaders.length));
  ok("ko'p taklif qilgan yuqorida",
     leaders[0].user_id === A && leaders[0].invites === 2,
     `${leaders[0]?.user_id}=${leaders[0]?.invites}`);

  // "Siz N-o'rindasiz" jadvaldagi o'rin bilan BIR XIL bo'lishi shart.
  const placeA = await contest.getUserPlace(started.id, A);
  const placeB = await contest.getUserPlace(started.id, B);
  ok("o'rinlar jadval bilan mos", placeA === 1 && placeB === 2, `A=${placeA} B=${placeB}`);
  ok("taklifi yo'q odamning o'rni 0",
     (await contest.getUserPlace(started.id, X)) === 0);

  const stats = await contest.contestStats(started.id);
  ok("statistika to'g'ri",
     stats.participants === 2 && stats.invites === 3,
     `${stats.participants} ishtirokchi / ${stats.invites} taklif`);

  // Liderlar ekrani ochiladi va ichida ID va sanoq ko'rinadi.
  //
  // A ning o'zi ham darvozadan o'tishi kerak — u taklif qiluvchi, lekin
  // bot uchun u ham oddiy foydalanuvchi.
  members.add(A);
  await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(A)]);
  await bot.handleUpdate(tap(A, "sub_check"));
  take();
  await bot.handleUpdate(tap(A, "leaders"));
  const board = take();
  const boardText = [
    ...board.filter((c) => /^(send|edit)/.test(c.method)).map((c) => String(c.payload?.text ?? "")),
  ].join("\n");
  ok("liderlar ekrani chiqdi", boardText.includes("TEST: Bahorgi konkurs"),
     boardText.slice(0, 50).replace(/\n/g, " "));
  ok("ekranda taklif soni bor", /<b>2<\/b>/.test(boardText));
  ok("ekranda o'z o'rni bor", /1-o'rin/.test(boardText));

  // ═══════════════════ 6. Yakunlash ═══════════════════
  console.log("\n── Yakunlash ──");

  take();
  const winners = await contest.finishContest(started.id);
  ok("ikki g'olib muzlatildi", winners.length === 2, String(winners.length));
  ok("birinchi o'rin A da", winners[0].user_id === A && winners[0].place === 1);
  ok("konkurs yopildi", (await contest.getActiveContest()) === null);

  // Yakunlangandan KEYIN kelgan taklif g'oliblarni o'zgartirmasligi kerak.
  await contest.countReferral(started.id, B, 700399);
  await contest.countReferral(started.id, B, 700398);
  const frozen = await contest.getWinners(started.id);
  ok("e'lon qilingan g'oliblar o'zgarmadi",
     frozen.length === 2 && frozen[0].user_id === A && frozen[0].invites === 2,
     frozen.map((w) => `${w.place}:${w.user_id}=${w.invites}`).join(", "));
  await pool.query("DELETE FROM contest_refs WHERE invited_id = ANY($1)", [[700399, 700398]]);

  // Ikkinchi marta yakunlash — bo'sh ro'yxat, xato emas.
  ok("ikkinchi yakunlash xato bermaydi",
     (await contest.finishContest(started.id)).length === 0);

  // ═══════════════════ 7. Kanaldagi e'lon ═══════════════════
  console.log("\n── Kanalda e'lon ──");

  // Admin tugmasi: yakunlash → g'oliblarga xabar + kanalga e'lon.
  const second = await contest.startContest({
    title: "TEST: Ikkinchi konkurs", prize: "Telegram Premium", winnersCount: 1,
  });
  await contest.countReferral(second.id, A, X);
  take();
  await bot.handleUpdate(tap(ADMIN, "contest_finish_yes"));
  // E'lon FONDA ketadi — bitta navbat aylanishini kutamiz.
  await new Promise((r) => setTimeout(r, 150));
  const announced = take();

  ok("g'olibga shaxsan xabar ketdi",
     textsTo(announced, A).some((t) => /g'olib|yutdingiz|o'rin/i.test(t)),
     textsTo(announced, A).join(" | ").slice(0, 60) || "xabar yo'q");

  const toChannel = announced.filter(
    (c) => c.method === "sendMessage" && c.payload?.chat_id === CHANNEL
  );
  ok("kanalda e'lon qilindi", toChannel.length === 1,
     String(toChannel.length));
  ok("e'londa g'olib ko'rsatildi",
     toChannel.some((c) => String(c.payload.text).includes(String(A)) ||
                           String(c.payload.text).includes(`u${A}`)),
     String(toChannel[0]?.payload?.text ?? "").slice(0, 70).replace(/\n/g, " "));

  // ═══════════════════ 8. Bizning sozlama xatomiz ═══════════════════
  //
  // Bot kanalda admin bo'lmasa `getChatMember` yiqiladi. Bu BIZNING
  // xatomiz — foydalanuvchi shu sababli botdan foydalana olmay
  // qolmasligi kerak, shuning uchun darvoza o'tkazib yuboradi.
  console.log("\n── Sozlama xatosi ──");
  console.log("   (pastdagi \"tekshirib bo'lmadi\" loglari ATAYLAB chiqariladi)");

  chatMemberBroken = true;
  ok("tekshirib bo'lmasa null qaytadi", (await sub.isMember(X)) === null);

  await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(Z)]);
  await pool.query("UPDATE users SET channel_joined_at = 0 WHERE user_id = $1", [Z]);
  take();
  await bot.handleUpdate(tap(Z, "sub_check"));
  const passthrough = textsTo(take(), Z);
  ok("sozlama xatosida foydalanuvchi o'tkazildi",
     passthrough.length > 0 && !passthrough.some((t) => /a'zo bo'ling/i.test(t)),
     passthrough.length ? "o'tdi" : "to'silib qoldi");
  chatMemberBroken = false;

  // ═══════════════════ 9. Konkurs ochish formati ═══════════════════
  //
  // Sovrin ko'p qatorli bo'lishi TABIIY: "1-o'rin ...", "2-3 o'rin ...".
  // Ilgari uchinchi qator o'rinlar soni deb olinardi, ya'ni
  // `parseInt("2-3 o'rin 20 000 so'm")` JIM TURIB 2 qaytarardi: admin
  // 5 ta o'rin yozib, 2 ta o'rinli konkurs olardi va buni faqat
  // g'oliblar e'lon qilinganda bilardi.
  console.log("\n── Konkurs ochish formati ──");

  async function openContest(text: string) {
    await pool.query("DELETE FROM contests WHERE status = 'active'");
    await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(ADMIN)]);
    take();
    await bot.handleUpdate(tap(ADMIN, "contest_start"));
    await bot.handleUpdate(cmd(ADMIN, text));
    const replies = take()
      .filter((c) => /^(send|edit)/.test(c.method))
      .map((c) => String(c.payload?.text ?? ""));
    const { rows } = await pool.query<{ title: string; prize: string; winners_count: number }>(
      "SELECT title, prize, winners_count FROM contests WHERE status = 'active' ORDER BY id DESC LIMIT 1"
    );
    return { row: rows[0] ?? null, replies };
  }

  const oneLine = await openContest(
    "TEST: Sinov\n1-o'rin 50 000 · 2-3 o'rin 20 000 · 4-5 o'rin 10 000\n5"
  );
  ok("bitta qatorli sovrin: 5 o'rin",
     Number(oneLine.row?.winners_count) === 5,
     String(oneLine.row?.winners_count));

  const multi = await openContest(
    "TEST: Sinov 2\n1-o'rin 50 000 so'm\n2-3 o'rin 20 000 so'mdan\n4-5 o'rin 10 000 so'mdan\n5"
  );
  ok("ko'p qatorli sovrin: 5 o'rin (2 EMAS)",
     Number(multi.row?.winners_count) === 5,
     String(multi.row?.winners_count));
  ok("sovrinning HAMMA qatori saqlandi",
     (multi.row?.prize ?? "").split("\n").length === 3 &&
       (multi.row?.prize ?? "").includes("4-5 o'rin"),
     JSON.stringify(multi.row?.prize));

  const blanks = await openContest(
    "TEST: Sinov 3\n\n1-o'rin 50 000\n\n2-5 o'rin 10 000\n\n5"
  );
  ok("bo'sh qatorlar xalaqit bermaydi",
     Number(blanks.row?.winners_count) === 5,
     String(blanks.row?.winners_count));

  // Oxirgi qatorda son bo'lmasa — JIM TURMASDAN xato beradi.
  const bad = await openContest("TEST: Sinov 4\n1-o'rin 50 000\n5 ta o'rin");
  ok("oxirgi qator son bo'lmasa konkurs ochilmaydi", bad.row === null,
     bad.row ? `ochildi: ${bad.row.winners_count}` : "ochilmadi");
  ok("xato aniq aytiladi",
     bad.replies.some((t) => /Noto'g'ri format/.test(t)),
     bad.replies.map((t) => t.split("\n")[0]).join(" | ") || "javob yo'q");

  const tooMany = await openContest("TEST: Sinov 5\nSovrin\n99");
  ok("51 dan ko'p o'rin qabul qilinmaydi", tooMany.row === null,
     tooMany.row ? `ochildi: ${tooMany.row.winners_count}` : "ochilmadi");

  await pool.query("DELETE FROM contests WHERE title LIKE 'TEST:%'");

  // ═══════════════════ 10. Admin qo'ygan premium emoji ═══════════════════
  //
  // Telegram premium emojini xabar MATNIDA yubormaydi — matnda oddiy
  // zaxira belgisi, haqiqiy emoji esa `entities` ichida keladi. Faqat
  // matnni o'qisak, admin tanlagan emoji yo'qolib, o'rniga oddiysi
  // qolardi. Konkurs e'loni kanalga chiqadi, ya'ni bu KO'RINADIGAN
  // narsa.
  console.log("\n── Admin qo'ygan premium emoji ──");

  const GIFT_ID = "5368324170671202286";
  const MEDAL_ID = "5451971135748916371";

  function msgWithEmoji(text: string, marks: [string, string][]): Update {
    const entities = marks.map(([glyph, id]) => ({
      type: "custom_emoji" as const,
      offset: text.indexOf(glyph),
      length: glyph.length,
      custom_emoji_id: id,
    }));
    return {
      update_id: updateId++,
      message: {
        message_id: messageId++, date: 0,
        chat: chatOf(ADMIN), from: userOf(ADMIN), text, entities,
      },
    } as Update;
  }

  async function openWithEmoji(text: string, marks: [string, string][]) {
    await pool.query("DELETE FROM contests WHERE status = 'active'");
    await pool.query("DELETE FROM bot_sessions WHERE key = $1", [String(ADMIN)]);
    take();
    await bot.handleUpdate(tap(ADMIN, "contest_start"));
    await bot.handleUpdate(msgWithEmoji(text, marks));
    const replies = take()
      .filter((c) => /^(send|edit)/.test(c.method))
      .map((c) => String(c.payload?.text ?? ""));
    const { rows } = await pool.query<{ id: number; title: string; prize: string }>(
      "SELECT id, title, prize FROM contests WHERE status = 'active' ORDER BY id DESC LIMIT 1"
    );
    return { row: rows[0] ?? null, replies };
  }

  const withEmoji = await openWithEmoji(
    "\u{1F381} TEST: Sinov\n\u{1F3C5} 1-o'rin — 20 000 so'm\n2-o'rin — 12 000 so'm\n2",
    [["\u{1F381}", GIFT_ID], ["\u{1F3C5}", MEDAL_ID]]
  );

  ok("nomdagi premium emoji AYNAN saqlandi",
     (withEmoji.row?.title ?? "").includes(`<tg-emoji emoji-id="${GIFT_ID}">`),
     JSON.stringify(withEmoji.row?.title));
  ok("sovrindagi premium emoji AYNAN saqlandi",
     (withEmoji.row?.prize ?? "").includes(`<tg-emoji emoji-id="${MEDAL_ID}">`),
     JSON.stringify(withEmoji.row?.prize));

  // Teg qator chegarasidan kesilib ketmasligi kerak: nomda yopilmagan
  // teg qolsa ikkala qator ham buzilardi.
  const balanced = (t: string) =>
    (t.match(/<tg-emoji/g) ?? []).length === (t.match(/<\/tg-emoji>/g) ?? []).length;
  ok("teglar qator chegarasida butun qoldi",
     balanced(withEmoji.row?.title ?? "") && balanced(withEmoji.row?.prize ?? ""),
     `title=${withEmoji.row?.title} prize=${withEmoji.row?.prize}`);

  // Admin ko'radigan tasdiqda teg MATN bo'lib ko'rinmasligi kerak.
  ok("tasdiq xabarida emoji tirik, qochirilmagan",
     withEmoji.replies.some((t) => t.includes(`emoji-id="${GIFT_ID}"`)) &&
       !withEmoji.replies.some((t) => t.includes("&lt;tg-emoji")),
     withEmoji.replies.map((t) => t.slice(0, 40)).join(" | "));

  // Kanaldagi e'londa ham admin tanlagan emoji bo'lishi kerak.
  await contest.countReferral(withEmoji.row!.id, A, X);
  take();
  await bot.handleUpdate(tap(ADMIN, "contest_finish_yes"));
  await new Promise((r) => setTimeout(r, 200));
  const announce = take();
  const toCh = announce.find(
    (c) => c.method === "sendMessage" && c.payload?.chat_id === CHANNEL
  );
  ok("kanaldagi e'londa admin emojisi bor",
     String(toCh?.payload?.text ?? "").includes(`emoji-id="${GIFT_ID}"`),
     String(toCh?.payload?.text ?? "").slice(0, 60));

  // HTML belgilarini admin yozsa ham xabar buzilmasligi kerak.
  const risky = await openWithEmoji("TEST: <b>A</b> & B\nSovrin <i>x</i>\n1", []);
  ok("HTML belgilari qochirildi",
     (risky.row?.title ?? "").includes("&lt;b&gt;") &&
       (risky.row?.title ?? "").includes("&amp;"),
     JSON.stringify(risky.row?.title));

  await pool.query("DELETE FROM contest_refs WHERE inviter_id = ANY($1)", [[A]]);
  await pool.query("DELETE FROM contests WHERE title LIKE '%TEST%'");

  // ═══════════════════ Tozalash ═══════════════════
  await sub.setSubscriptionRequired(false);
  await sub.setChannel("", "");
  await clean();
  await closePool();

  console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 Konkurs testlari o'tdi");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
