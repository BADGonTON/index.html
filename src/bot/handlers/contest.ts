import { Bot } from "grammy";
import { MyContext } from "../session";
import { renderMenu, sendTracked } from "../ui";
import { isAdmin, config } from "../../config";
import { STEP } from "../steps";
import {
  fmt,
  CONTEST_NONE,
  LEADERS_MESSAGE,
  LEADERS_EMPTY,
  CONTEST_FINISHED_CHANNEL,
  CONTEST_WON,
  ADMIN_CONTEST_PANEL,
  ADMIN_CONTEST_ACTIVE,
  ADMIN_CONTEST_NONE,
  ADMIN_CONTEST_START,
  ADMIN_CONTEST_FINISH_CONFIRM,
  ADMIN_CONTEST_FINISHED,
  ADMIN_SET_CHANNEL,
  ADMIN_INVALID_FORMAT,
} from "../texts";
import { contestPanelKb, contestFinishKb, leadersKb, adminBackKb } from "../keyboards";
import { messageLinesHtml } from "../entities";
import {
  getActiveContest,
  startContest,
  finishContest,
  getLeaders,
  getUserPlace,
  countUserInvites,
  contestStats,
  WinnerRow,
} from "../../db/repo/contest";
import {
  isSubscriptionRequired,
  setSubscriptionRequired,
  setChannel,
  getChannel,
} from "../../services/subscription";
import { sendLog, notifyUser } from "../../services/logger";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  KONKURS: LIDERLAR VA ADMIN BOSHQARUVI
 * ═══════════════════════════════════════════════════════════════════════════
 */

function escapeHtml(text: string): string {
  return String(text ?? "").replace(/[&<>]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string
  );
}

/** Liderni bitta qatorga yozadi. */
function leaderLine(place: number, userId: number, username: string | null, invites: number): string {
  // Birinchi uchtasi medal bilan — jadval bir qarashda o'qiladi.
  const medal = ["\u{1F947}", "\u{1F948}", "\u{1F949}"][place - 1] ?? `${place}.`;
  // Foydalanuvchi ID si ko'rinadi (so'ralgani shu), username bo'lsa yoniga.
  const who = username ? `@${escapeHtml(username)}` : `<code>${userId}</code>`;
  return `${medal} ${who} — <b>${invites}</b> ta`;
}

export function registerContestHandlers(bot: Bot<MyContext>): void {
  // ---------------------------------------------------------------------
  //  Liderlar (hamma uchun)
  // ---------------------------------------------------------------------
  bot.callbackQuery("leaders", async (ctx) => {
    const contest = await getActiveContest();
    if (!contest) {
      await renderMenu(ctx, CONTEST_NONE, leadersKb());
      await ctx.answerCallbackQuery();
      return;
    }

    const [leaders, stats, myInvites, myPlace] = await Promise.all([
      getLeaders(contest.id, 10),
      contestStats(contest.id),
      countUserInvites(contest.id, ctx.from.id),
      getUserPlace(contest.id, ctx.from.id),
    ]);

    const list = leaders.length
      ? leaders.map((l, i) => leaderLine(i + 1, l.user_id, l.username, l.invites)).join("\n")
      : LEADERS_EMPTY;

    // O'z o'rni ALOHIDA ko'rsatiladi — o'ninchidan pastda bo'lsa ham
    // odam o'zini topa olsin.
    const me = myPlace > 0
      ? `\n\u{1F4CD} Siz: <b>${myPlace}-o'rin</b> · <b>${myInvites}</b> ta taklif`
      : "\n\u{1F4CD} Siz hali hech kimni taklif qilmadingiz";

    await renderMenu(
      ctx,
      fmt(LEADERS_MESSAGE, {
        // Nom va sovrin bazada XAVFSIZ HTML bo'lib turadi (admin
        // qo'ygan premium emoji bilan), shuning uchun qayta
        // qochirilmaydi — aks holda teglar matn bo'lib ko'rinardi.
        title: contest.title,
        prize: contest.prize,
        participants: stats.participants,
        invites: stats.invites,
        leaders: list,
        me,
      }),
      leadersKb()
    );
    await ctx.answerCallbackQuery();
  });

  // ---------------------------------------------------------------------
  //  Admin paneli
  // ---------------------------------------------------------------------
  const adminOnly =
    (handler: (ctx: MyContext) => Promise<void>) =>
    async (ctx: MyContext): Promise<void> => {
      if (!isAdmin(ctx.from!.id)) {
        await ctx.answerCallbackQuery();
        return;
      }
      await handler(ctx);
    };

  bot.callbackQuery("contest_panel", adminOnly(async (ctx) => {
    await showPanel(ctx);
    await ctx.answerCallbackQuery();
  }));

  bot.callbackQuery("contest_start", adminOnly(async (ctx) => {
    await sendTracked(ctx, ADMIN_CONTEST_START, adminBackKb());
    ctx.session.step = STEP.ADMIN_CONTEST_START;
    await ctx.answerCallbackQuery();
  }));

  bot.callbackQuery("contest_finish", adminOnly(async (ctx) => {
    const contest = await getActiveContest();
    if (!contest) {
      await showPanel(ctx);
      await ctx.answerCallbackQuery();
      return;
    }
    const stats = await contestStats(contest.id);
    await renderMenu(
      ctx,
      fmt(ADMIN_CONTEST_FINISH_CONFIRM, {
        title: contest.title,
        participants: stats.participants,
        invites: stats.invites,
      }),
      contestFinishKb()
    );
    await ctx.answerCallbackQuery();
  }));

  bot.callbackQuery("contest_finish_yes", adminOnly(async (ctx) => {
    const contest = await getActiveContest();
    if (!contest) {
      await showPanel(ctx);
      await ctx.answerCallbackQuery();
      return;
    }

    const winners = await finishContest(contest.id);
    await ctx.answerCallbackQuery();

    const list = winners.length
      ? winners.map((w) => leaderLine(w.place, w.user_id, w.username, w.invites)).join("\n")
      : "Ishtirokchi bo'lmadi.";

    await renderMenu(ctx, fmt(ADMIN_CONTEST_FINISHED, { winners: list }), adminBackKb());

    // E'lon va tabriklar FONDA ketadi: admin javobni kutib o'tirmaydi.
    void announceWinners(contest.title, contest.prize, winners, list);
  }));

  bot.callbackQuery("contest_channel", adminOnly(async (ctx) => {
    await sendTracked(
      ctx,
      fmt(ADMIN_SET_CHANNEL, {
        channel: getChannel() || "sozlanmagan",
        state: isSubscriptionRequired() ? "yoqilgan" : "o'chiq",
      }),
      adminBackKb()
    );
    ctx.session.step = STEP.ADMIN_SET_CHANNEL;
    await ctx.answerCallbackQuery();
  }));

  bot.callbackQuery("contest_sub_on", adminOnly(async (ctx) => {
    if (!getChannel()) {
      await ctx.answerCallbackQuery({
        text: "Avval kanalni sozlang.",
        show_alert: true,
      });
      return;
    }
    await setSubscriptionRequired(true);
    await showPanel(ctx);
    await ctx.answerCallbackQuery({ text: "Darvoza yoqildi" });
    await sendLog("\u{1F512} Majburiy obuna darvozasi YOQILDI");
  }));

  bot.callbackQuery("contest_sub_off", adminOnly(async (ctx) => {
    await setSubscriptionRequired(false);
    await showPanel(ctx);
    await ctx.answerCallbackQuery({ text: "Darvoza o'chirildi" });
    await sendLog("\u{1F513} Majburiy obuna darvozasi O'CHIRILDI");
  }));
}

async function showPanel(ctx: MyContext): Promise<void> {
  const contest = await getActiveContest();

  let status: string;
  if (contest) {
    const stats = await contestStats(contest.id);
    status = fmt(ADMIN_CONTEST_ACTIVE, {
      title: contest.title,
      prize: contest.prize || "—",
      winners: contest.winners_count,
      participants: stats.participants,
      invites: stats.invites,
    });
  } else {
    status = ADMIN_CONTEST_NONE;
  }

  await renderMenu(
    ctx,
    fmt(ADMIN_CONTEST_PANEL, { status }),
    contestPanelKb(Boolean(contest), isSubscriptionRequired())
  );
}

/**
 * G'oliblarni kanalga e'lon qiladi va har biriga shaxsan xabar beradi.
 *
 * Kanalga yuborib bo'lmasa ham (bot admin emas) tabriklar baribir
 * ketadi — g'oliblar xabarsiz qolmasligi kerak.
 */
async function announceWinners(
  title: string,
  prize: string,
  winners: WinnerRow[],
  list: string
): Promise<void> {
  for (const w of winners) {
    await notifyUser(
      w.user_id,
      fmt(CONTEST_WON, { title, place: w.place, invites: w.invites })
    );
  }

  const channel = getChannel();
  if (!channel) return;

  const { botApi } = await import("../../services/logger");
  const api = botApi();
  if (!api) return;

  try {
    await api.sendMessage(
      channel,
      fmt(CONTEST_FINISHED_CHANNEL, {
        title,
        prize,
        winners: list,
      }),
      { parse_mode: "HTML" }
    );
  } catch (err) {
    await sendLog(
      `⚠️ <b>KONKURS E'LONI YUBORILMADI</b>\n\n` +
        `Kanal: <code>${escapeHtml(channel)}</code>\n` +
        `Sabab: ${escapeHtml((err as Error).message)}\n\n` +
        `Bot kanalda admin ekanini tekshiring.`
    );
  }
}

// ───────────────────────── Matn bosqichlari ─────────────────────────

/**
 * Yangi konkurs: nomi, sovrini va o'rinlar soni — uch qator.
 */
export async function handleContestStartText(ctx: MyContext): Promise<void> {
  // Har bir qator ALOHIDA HTML ga aylantiriladi: admin qo'ygan premium
  // emoji `<tg-emoji>` bo'lib saqlanadi, qolgan matn esa xavfsiz
  // holatga keltiriladi.
  const lines = messageLinesHtml(ctx.message)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Birinchi qator — nomi, OXIRGI qator — o'rinlar soni, ORASIDAGI
  // hammasi sovrin.
  //
  // Nega oxirgi qator: sovrin ko'p qatorli bo'lishi tabiiy ("1-o'rin ...",
  // "2-3 o'rin ..."). Ilgari uchinchi qator soni deb olinardi va
  // `parseInt("2-3 o'rin 20 000 so'm")` JIM TURIB 2 qaytarardi — admin
  // 5 ta o'rin yozib, 2 ta o'rinli konkurs olardi va buni bilmasdi.
  const title = lines[0] ?? "";
  const countLine = lines.length > 1 ? lines[lines.length - 1] : "";
  const prize = lines.slice(1, -1).join("\n");

  // Faqat RAQAM qabul qilinadi: "5 ta o'rin" ham xato, chunki xatoni
  // hozir ko'rsatish yakunlashda noto'g'ri g'olib chiqqanidan yaxshiroq.
  if (!title || !/^\d{1,2}$/.test(countLine)) {
    await sendTracked(ctx, ADMIN_INVALID_FORMAT, adminBackKb());
    return;
  }

  const winners = parseInt(countLine, 10);
  if (winners < 1 || winners > 50) {
    await sendTracked(ctx, ADMIN_INVALID_FORMAT, adminBackKb());
    return;
  }

  // Faol konkurs bo'lsa, bazadagi UNIQUE indeks ikkinchisini qo'ymaydi.
  // Xatoni foydalanuvchiga xom holda ko'rsatmaymiz.
  const existing = await getActiveContest();
  if (existing) {
    ctx.session.step = undefined;
    await sendTracked(
      ctx,
      "⚠️ Faol konkurs allaqachon bor. Avval uni yakunlang.",
      adminBackKb()
    );
    return;
  }

  const contest = await startContest({ title, prize, winnersCount: winners });
  ctx.session.step = undefined;

  await sendTracked(
    ctx,
    `✅ <b>Konkurs boshlandi</b>\n\n` +
      `<b>${contest.title}</b>\n` +
      `${contest.prize}\n\n` +
      `Sovrinli o'rinlar: <b>${contest.winners_count}</b>`,
    adminBackKb()
  );
  await sendLog(`\u{1F3C6} Konkurs boshlandi: <b>${contest.title}</b>`);
}

/** Majburiy kanalni sozlaydi. */
export async function handleSetChannelText(ctx: MyContext): Promise<void> {
  const raw = (ctx.message?.text ?? "").trim();
  ctx.session.step = undefined;

  if (raw === "-") {
    await setChannel("", "");
    await setSubscriptionRequired(false);
    await sendTracked(ctx, "✅ Majburiy kanal o'chirildi.", adminBackKb());
    return;
  }

  const channel = raw.startsWith("@") ? raw : `@${raw}`;
  if (!/^@[A-Za-z0-9_]{4,32}$/.test(channel)) {
    await sendTracked(ctx, ADMIN_INVALID_FORMAT, adminBackKb());
    return;
  }

  await setChannel(channel, `https://t.me/${channel.slice(1)}`);

  // Bot kanalda admin ekanini DARHOL tekshiramiz: keyinroq, foydalanuvchi
  // darvozaga urilganda bilib qolgandan ko'ra hozir aytgan yaxshi.
  const { isMember } = await import("../../services/subscription");
  const probe = await isMember(config.admins[0] ?? ctx.from!.id);

  await sendTracked(
    ctx,
    `✅ Majburiy kanal: <b>${escapeHtml(channel)}</b>\n\n` +
      (probe === null
        ? "⚠️ Lekin a'zolikni tekshirib bo'lmadi — bot kanalda ADMIN emasga o'xshaydi."
        : "Bot kanalni o'qiy oladi — darvozani yoqsangiz bo'ladi."),
    adminBackKb()
  );
}
