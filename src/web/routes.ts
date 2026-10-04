import { Router } from "express";
import { config, botUsername } from "../config";
import { requireTelegramAuth, rateLimit } from "./auth";
import {
  listCatalogCollections,
  queryGifts,
  findGift,
  verifyGiftAvailable,
  verifyGiftsAvailable,
  removeGift,
  catalogStats,
  catalogVersion,
  giftImageUrl,
} from "../services/catalog";
import {
  queryBundles,
  findBundle,
  bundleStats,
  serializeBundle,
  KIND_LABEL,
  isBundleKind,
  BundleKind,
} from "../services/bundles";
import {
  getTonRateUzs,
  getServiceFeeUzs,
  getExtendMinDays,
  getExtendFeeUzs,
  bundleQuote,
  BUNDLE_MIN_DAYS,
  BUNDLE_SIZES,
  BUNDLE_MARKUP_PCT,
  totalCostUzs,
  extendCostUzs,
  pricePerDayUzs,
  daysAffordableExtend,
  daysToSec,
  secToDays,
} from "../services/pricing";
import { getOrCreateUser, getBalance, tryDeductBalance, refundBalance } from "../db/repo/users";
import {
  createRental,
  getRental,
  lockRentalForPayment,
  lockRentalsForPayment,
  setRentalsStatus,
  setRentalPaidAmount,
  listUserRentals,
  markRentalLinked,
  enqueueRentJob,
  RentalRow,
} from "../db/repo/rentals";
import { tonConnectLink } from "../services/marketapp";
import { guideVideoUrl } from "../services/media";
import { sanitizeStoredRentError } from "../services/rentErrors";
import { sendLog } from "../services/logger";

/**
 * Mini App API.
 *
 * TEZLIK QOIDASI: bu yerdagi hech bir endpoint Marketapp yoki TON tarmog'ini
 * KUTMAYDI. Katalog xotiradagi keshdan o'qiladi, blokcheyn ishlari esa navbatga
 * (rent_jobs) qo'yiladi va fon ishchisi bajaradi. Shu sabab har bir so'rov
 * millisekundlarda javob beradi.
 *
 * XAVFSIZLIK QOIDASI: narx va muddat HECH QACHON klientdan olinmaydi —
 * har doim server keshidagi katalogdan qayta hisoblanadi.
 */
export function createApiRouter(): Router {
  const api = Router();
  api.use(requireTelegramAuth, rateLimit);

  // ---------------------------------------------------------------------
  //  Boshlang'ich yuklash
  //
  //  DIQQAT: bu yerda GIFTLAR YUBORILMAYDI. Katalogda ~8 000 gift bor,
  //  ularning hammasi ~2 MB JSON bo'ladi va mobil internetda ilovaning
  //  ochilishini sekinlashtiradi. Bunda faqat kolleksiyalar ro'yxati
  //  (~120 qator, bir necha KB) keladi, giftlar esa /gifts dan
  //  sahifalab olinadi.
  // ---------------------------------------------------------------------
  api.get("/bootstrap", async (req, res) => {
    const tgUser = req.tgUser!;
    const user = await getOrCreateUser(tgUser.id, tgUser.username ?? null);
    const stats = catalogStats();

    res.json({
      user: {
        id: user.user_id,
        username: tgUser.username ?? null,
        first_name: tgUser.first_name ?? null,
        photo_url: tgUser.photo_url ?? null,
      },
      balance_uzs: user.balance,
      pricing: {
        ton_rate_uzs: getTonRateUzs(),
        service_fee_uzs: getServiceFeeUzs(),
        // Uzaytirish alohida narxlanadi: eng kam muddat va o'z xizmat haqi.
        extend_min_days: getExtendMinDays(),
        extend_fee_uzs: getExtendFeeUzs(),
      },
      settings: {
        profile_link_video_url: guideVideoUrl(),
        profile_link_youtube_url: config.profileLinkYoutubeUrl || null,
        support_url: config.supportBot,
        page_size: config.marketPageSize,
        // Mini App "Balansni to'ldirish" tugmasi shu orqali
        // t.me/<bot>?start=pay deeplinkini yasaydi.
        bot_username: botUsername(),
      },
      bundle: {
        min_days: BUNDLE_MIN_DAYS,
        sizes: [...BUNDLE_SIZES],
        markup_pct: BUNDLE_MARKUP_PCT,
        total: bundleStats().total,
      },
      catalog: {
        version: catalogVersion(),
        ready: stats.ready,
        // Hali to'lib ulgurmagan bo'lsa, Mini App buni foydalanuvchiga aytadi.
        loading: stats.pending > 0,
        total_gifts: stats.gifts,
        collections: listCatalogCollections(),
      },
      rentals: (await listUserRentals(user.user_id)).map((r) => serializeRental(r, user.balance)),
    });
  });

  // ---------------------------------------------------------------------
  //  Giftlar — sahifalab (filtr va saralash ham serverda)
  // ---------------------------------------------------------------------
  api.get("/gifts", (req, res) => {
    const page = queryGifts({
      collection: req.query.collection ? String(req.query.collection) : null,
      search: req.query.q ? String(req.query.q) : "",
      sort: req.query.sort === "desc" ? "desc" : "asc",
      offset: Number(req.query.offset) || 0,
      limit: Number(req.query.limit) || config.marketPageSize,
    });

    res.json({
      version: page.version,
      total: page.total,
      offset: page.offset,
      has_more: page.has_more,
      items: page.items.map((g) => ({
        nft_address: g.nft_address,
        nft_name: g.nft_name,
        collection_name: g.collection_name,
        price_per_day_nano: g.price_per_day_nano,
        price_per_day_uzs: pricePerDayUzs(g.price_per_day_nano),
        min_days: g.min_days,
        max_days: g.max_days,
        image_url: giftImageUrl(g.nft_name),
      })),
    });
  });

  // ---------------------------------------------------------------------
  //  To'plamlar (kolleksiyalar) — 3/6/9/12 ta bir mavzudagi gift
  //
  //  Bu ro'yxat XOTIRADA, katalog indeksidan yig'iladi: Marketapp'ga
  //  qo'shimcha so'rov ketmaydi, javob millisekundlarda qaytadi.
  // ---------------------------------------------------------------------
  api.get("/bundles", (req, res) => {
    const kindParam = String(req.query.kind ?? "");
    const kind: BundleKind | null = isBundleKind(kindParam) ? kindParam : null;

    const page = queryBundles({
      kind,
      collection: req.query.collection ? String(req.query.collection) : null,
      offset: Number(req.query.offset) || 0,
      limit: Number(req.query.limit) || 20,
    });

    res.json({
      version: page.version,
      total: page.total,
      offset: page.offset,
      has_more: page.has_more,
      items: page.items.map((b) => serializeBundle(b)),
    });
  });

  api.get("/bundles/:id", (req, res) => {
    const bundle = findBundle(String(req.params.id));
    if (!bundle) {
      res.status(404).json({ error: "Bu to'plam endi mavjud emas. Ro'yxatni yangilang.", gone: true });
      return;
    }
    res.json({ bundle: serializeBundle(bundle, { withGifts: true }) });
  });

  // ---------------------------------------------------------------------
  //  To'plamni ijaraga olish — BITTA to'lov, N ta ijara
  //
  //  Narx server tomonda hisoblanadi: har bir giftning `days` kunlik ijarasi
  //  + har bir gift uchun xizmat haqi, ustiga 10% to'plam ustamasi.
  //  Klient yuborgan summa mutlaqo e'tiborga olinmaydi.
  // ---------------------------------------------------------------------
  api.post("/bundles/:id/rent", async (req, res) => {
    const tgUser = req.tgUser!;
    const bundle = findBundle(String(req.params.id));
    if (!bundle) {
      res.status(404).json({ error: "Bu to'plam endi mavjud emas. Ro'yxatni yangilang.", gone: true });
      return;
    }

    const size = Math.floor(Number(req.body?.size));
    const days = Math.floor(Number(req.body?.days));

    if (!BUNDLE_SIZES.includes(size as (typeof BUNDLE_SIZES)[number]) || !bundle.sizes.includes(size)) {
      res.status(400).json({ error: `Bu to'plamda ${bundle.sizes.join(", ")} ta gift olish mumkin` });
      return;
    }
    if (!Number.isFinite(days) || days < BUNDLE_MIN_DAYS || days > bundle.max_days) {
      res.status(400).json({
        error: `Muddat ${BUNDLE_MIN_DAYS} dan ${bundle.max_days} kungacha bo'lishi kerak`,
      });
      return;
    }

    // To'plamdagi giftlar bitta kolleksiyadan, shuning uchun BITTA so'rov
    // hammasini tekshiradi — Marketapp'ga yuk 12 barobar oshmaydi.
    const wanted = bundle.gifts.slice(0, size);
    const check = await verifyGiftsAvailable(wanted.map((g) => g.nft_address));
    const alive = new Set(check.available);
    const gifts = wanted.filter((g) => alive.has(g.nft_address));

    if (gifts.length < size) {
      // Bo'sh giftlar yetmadi — to'plamni QISMAN sotmaymiz, pul ham yechilmaydi.
      res.status(409).json({
        error:
          `Bu to'plamdan ${gifts.length} ta gift qoldi — kimdir hozirgina ijaraga oldi. ` +
          `Ro'yxatni yangilang yoki kichikroq to'plam tanlang.`,
        gone: true,
        available: gifts.length,
      });
      return;
    }

    const quote = bundleQuote(gifts.map((g) => g.price_per_day_nano), days);
    const label = `${KIND_LABEL[bundle.kind]} · ${bundle.value}`;

    await getOrCreateUser(tgUser.id, tgUser.username ?? null);

    // Avval barcha ijaralar 'draft' bo'lib yaratiladi, keyin BIR MARTA pul
    // yechiladi. Shu tartibda pul yechilgan, lekin ijara yaratilmagan holat
    // bo'lmaydi; yaratishda xato chiqsa esa hali pulga tegilmagan bo'ladi.
    const rentals = [];
    try {
      for (const gift of gifts) {
        rentals.push(
          await createRental({
            userId: tgUser.id,
            nftAddress: gift.nft_address,
            nftName: gift.nft_name,
            collectionName: gift.collection_name,
            collectionAddress: gift.collection_address,
            durationSec: daysToSec(days),
            pricePerDayNano: gift.price_per_day_nano,
            // Ustama va xizmat haqi to'plam bo'ylab teng taqsimlanadi —
            // yig'indi HAR DOIM quote.total_uzs ga teng bo'lishi uchun
            // oxirgi giftga qoldiq beriladi.
            paidUzs: 0,
            bundleId: bundle.id,
            bundleLabel: label,
          })
        );
      }
    } catch (err) {
      await setRentalsStatus(rentals.map((r) => r.id), "failed", "To'plam yaratilmadi");
      throw err;
    }

    const ids = rentals.map((r) => r.id);

    // 'draft' -> 'paying'. Ikki marta to'lashdan himoya: agar bir nechtasi
    // allaqachon bloklangan bo'lsa, hech narsa yechmaymiz.
    const lockedCount = await lockRentalsForPayment(ids, tgUser.id);
    if (lockedCount !== ids.length) {
      await setRentalsStatus(ids, "failed", "To'plam qayta ishga tushdi");
      res.status(409).json({ error: "Bu to'plam allaqachon to'lanmoqda" });
      return;
    }

    const remaining = await tryDeductBalance(tgUser.id, quote.total_uzs, "rent", `bundle:${bundle.id}`);
    if (remaining === null) {
      await setRentalsStatus(ids, "failed", "Balans yetarli emas");
      res.status(402).json({
        error: "Balans yetarli emas",
        required_uzs: quote.total_uzs,
        balance_uzs: await getBalance(tgUser.id),
      });
      return;
    }

    // Yechilgan summani ijaralar bo'ylab taqsimlaymiz (hisobot uchun) va
    // har bir gift uchun alohida blokcheyn ishini navbatga qo'yamiz.
    const share = Math.floor(quote.total_uzs / ids.length);
    try {
      for (let i = 0; i < ids.length; i++) {
        const paid = i === ids.length - 1 ? quote.total_uzs - share * (ids.length - 1) : share;
        await setRentalPaidAmount(ids[i], paid);
        await enqueueRentJob(ids[i], "pay", { days, cost_uzs: paid });
        removeGift(gifts[i].nft_address);
      }
    } catch (err) {
      // Navbatga qo'yib bo'lmadi — pulni DARHOL qaytaramiz.
      await refundBalance(tgUser.id, quote.total_uzs, `bundle:${bundle.id}`);
      await setRentalsStatus(ids, "failed", "Navbatga qo'yib bo'lmadi");
      throw err;
    }

    res.json({
      ok: true,
      bundle_id: bundle.id,
      rental_ids: ids,
      count: ids.length,
      days,
      cost_uzs: quote.total_uzs,
      balance_uzs: remaining,
      status: "paying",
    });
  });

  // ---------------------------------------------------------------------
  //  Balans (yengil so'rov — to'lovdan keyin yangilash uchun)
  // ---------------------------------------------------------------------
  api.get("/balance", async (req, res) => {
    res.json({ balance_uzs: await getBalance(req.tgUser!.id) });
  });

  // ---------------------------------------------------------------------
  //  Mening giftlarim
  // ---------------------------------------------------------------------
  api.get("/rentals", async (req, res) => {
    const userId = req.tgUser!.id;
    const [rentals, balance] = await Promise.all([listUserRentals(userId), getBalance(userId)]);
    res.json({ balance_uzs: balance, rentals: rentals.map((r) => serializeRental(r, balance)) });
  });

  // ---------------------------------------------------------------------
  //  Yangi ijara: yaratish + to'lov BITTA so'rovda
  // ---------------------------------------------------------------------
  api.post("/rentals", async (req, res) => {
    const tgUser = req.tgUser!;
    const nftAddress = String(req.body?.nft_address ?? "");
    const days = Math.floor(Number(req.body?.days));

    const gift = findGift(nftAddress);
    if (!gift) {
      res.status(404).json({ error: "Bu gift endi mavjud emas. Ro'yxatni yangilang.", gone: true });
      return;
    }

    // Gift shu daqiqada ham bo'shmi? Katalog ~10 daqiqada bir yangilanadi,
    // ya'ni kimdir hozirgina ijaraga olgan bo'lishi mumkin. Pulni yechishdan
    // OLDIN aynan shu kolleksiyani bitta so'rov bilan tekshiramiz —
    // "to'lov o'tdi, keyin gift yo'q" degan holat bo'lmasligi uchun.
    const check = await verifyGiftAvailable(nftAddress);
    if (check.checked && !check.available) {
      res.status(409).json({
        error: "Bu giftni hozirgina boshqa kimdir ijaraga oldi. Boshqasini tanlang.",
        gone: true,
      });
      return;
    }
    if (!Number.isFinite(days) || days < gift.min_days || days > gift.max_days) {
      res.status(400).json({
        error: `Muddat ${gift.min_days} dan ${gift.max_days} kungacha bo'lishi kerak`,
      });
      return;
    }

    // Narx SERVER tomonda hisoblanadi — klient yuborgan summa e'tiborga olinmaydi.
    const cost = totalCostUzs(gift.price_per_day_nano, days);

    await getOrCreateUser(tgUser.id, tgUser.username ?? null);

    const rental = await createRental({
      userId: tgUser.id,
      nftAddress: gift.nft_address,
      nftName: gift.nft_name,
      collectionName: gift.collection_name,
      collectionAddress: gift.collection_address,
      durationSec: daysToSec(days),
      pricePerDayNano: gift.price_per_day_nano,
      paidUzs: cost,
    });

    // 'draft' → 'paying'. Faqat bitta so'rov muvaffaqiyatli bo'ladi.
    const locked = await lockRentalForPayment(rental.id, tgUser.id);
    if (!locked) {
      res.status(409).json({ error: "Bu ijara allaqachon to'lanmoqda" });
      return;
    }

    const remaining = await tryDeductBalance(tgUser.id, cost, "rent", rental.id);
    if (remaining === null) {
      const { setRentalStatus } = await import("../db/repo/rentals");
      await setRentalStatus(rental.id, "failed", "Balans yetarli emas");
      res.status(402).json({
        error: "Balans yetarli emas",
        required_uzs: cost,
        balance_uzs: await getBalance(tgUser.id),
      });
      return;
    }

    // Blokcheyn ishi navbatga qo'yiladi — foydalanuvchi kutmaydi.
    await enqueueRentJob(rental.id, "pay", { days, cost_uzs: cost });

    // Gift band bo'ldi — katalogdan DARHOL olib tashlaymiz, shunda boshqalar
    // uni ko'rmaydi va sotib olishga urinmaydi.
    removeGift(nftAddress);

    res.json({
      ok: true,
      rental_id: rental.id,
      cost_uzs: cost,
      balance_uzs: remaining,
      status: "paying",
    });
  });

  // ---------------------------------------------------------------------
  //  Uzaytirish
  // ---------------------------------------------------------------------
  api.post("/rentals/:id/extend", async (req, res) => {
    const userId = req.tgUser!.id;
    const rentalId = Number(req.params.id);
    const days = Math.floor(Number(req.body?.days));

    const rental = await getRental(rentalId, userId);
    if (!rental) {
      res.status(404).json({ error: "Ijara topilmadi" });
      return;
    }
    if (rental.status !== "linked" && rental.status !== "pending_link") {
      res.status(400).json({ error: "Bu ijarani hozir uzaytirib bo'lmaydi" });
      return;
    }
    // Eng kam muddat: har bir uzaytirish blokcheynga alohida tranzaksiya
    // yuboradi va uning komissiyasi muddatga bog'liq emas. 1 kunlik
    // uzaytirishda komissiya ijara narxidan oshib ketardi.
    const minDays = getExtendMinDays();
    if (!Number.isFinite(days) || days < minDays || days > 365) {
      res.status(400).json({
        error: `Uzaytirish kamida ${minDays} kun bo'lishi kerak (365 kungacha)`,
        min_days: minDays,
      });
      return;
    }

    const cost = extendCostUzs(rental.price_per_day_nano, days);
    const remaining = await tryDeductBalance(userId, cost, "rent_extend", rental.id);
    if (remaining === null) {
      res.status(402).json({
        error: "Balans yetarli emas",
        required_uzs: cost,
        balance_uzs: await getBalance(userId),
      });
      return;
    }

    await enqueueRentJob(rental.id, "extend", {
      days,
      extra_sec: daysToSec(days),
      cost_uzs: cost,
    });

    res.json({ ok: true, cost_uzs: cost, balance_uzs: remaining });
  });

  // ---------------------------------------------------------------------
  //  Profilga ulash (tc:// havola)
  // ---------------------------------------------------------------------
  api.post("/rentals/:id/link", async (req, res) => {
    const userId = req.tgUser!.id;
    const rentalId = Number(req.params.id);
    const tcUrl = String(req.body?.tonconnect_url ?? "").trim();

    const rental = await getRental(rentalId, userId);
    if (!rental) {
      res.status(404).json({ error: "Ijara topilmadi" });
      return;
    }
    if (rental.status !== "pending_link" && rental.status !== "linked") {
      res.status(400).json({
        error:
          rental.status === "paying"
            ? "To'lov hali tasdiqlanmoqda — bir daqiqadan keyin urinib ko'ring"
            : "Bu ijarani ulab bo'lmaydi",
      });
      return;
    }
    if (!/^(tc:\/\/|https:\/\/)/.test(tcUrl) || tcUrl.length > 2048) {
      res.status(400).json({ error: "tc:// yoki https:// bilan boshlanuvchi to'g'ri havola kiriting" });
      return;
    }

    try {
      const result = await tonConnectLink(rental.nft_address, tcUrl);
      const status = String(result?.status ?? result?.result ?? "").toLowerCase();
      const isOk = result?.ok === true || ["ok", "success", "connected"].includes(status);

      if (!isOk) {
        res.status(400).json({
          error: "Ulanish tasdiqlanmadi. Fragment'da hamyonni qayta ulab, yangi havola oling.",
        });
        return;
      }

      const endTime =
        rental.status === "linked" && rental.end_time
          ? rental.end_time
          : Math.floor(Date.now() / 1000) + Number(rental.duration_sec);

      await markRentalLinked(rental.id, tcUrl, endTime);
      res.json({ ok: true, end_time: endTime });
    } catch (err) {
      await sendLog(
        `⚠️ <b>TONCONNECT XATOSI</b>\n👤 <code>${userId}</code>\n` +
          `🎁 ${rental.nft_name}\n<code>${(err as Error).message}</code>`
      );
      res.status(502).json({ error: "Fragment bilan bog'lanib bo'lmadi. Birozdan keyin urinib ko'ring." });
    }
  });

  return api;
}

/** Ijara yozuvini Mini App tushunadigan ko'rinishga o'tkazadi. */
function serializeRental(r: RentalRow, balanceUzs: number) {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: r.id,
    nft_address: r.nft_address,
    nft_name: r.nft_name,
    collection_name: r.collection_name,
    image_url: giftImageUrl(r.nft_name),
    status: r.status,
    // Xom API xatosi HECH QACHON foydalanuvchiga chiqmaydi.
    tx_error: sanitizeStoredRentError(r.tx_error),
    total_days: secToDays(r.duration_sec),
    left_days: r.end_time ? Math.max(0, Math.ceil((r.end_time - now) / 86_400)) : null,
    end_time: r.end_time,
    price_per_day_uzs: pricePerDayUzs(r.price_per_day_nano),
    price_per_day_nano: r.price_per_day_nano,
    paid_uzs: r.paid_uzs,
    bundle_id: r.bundle_id,
    bundle_label: r.bundle_label,
    extend_affordable_days: daysAffordableExtend(r.price_per_day_nano, balanceUzs),
    is_linked: r.status === "linked",
  };
}
