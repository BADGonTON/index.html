import { Router } from "express";
import { config } from "../config";
import { requireTelegramAuth, rateLimit } from "./auth";
import {
  listCatalogCollections,
  queryGifts,
  findGift,
  catalogStats,
  catalogVersion,
  giftImageUrl,
} from "../services/catalog";
import {
  getTonRateUzs,
  getServiceFeeUzs,
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
  listUserRentals,
  markRentalLinked,
  enqueueRentJob,
  RentalRow,
} from "../db/repo/rentals";
import { tonConnectLink } from "../services/marketapp";
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
      },
      settings: {
        profile_link_video_url: config.profileLinkVideoUrl || null,
        support_url: config.supportBot,
        page_size: config.marketPageSize,
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
      res.status(404).json({ error: "Bu gift endi mavjud emas. Ro'yxatni yangilang." });
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
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      res.status(400).json({ error: "Kun soni 1 dan 365 gacha bo'lishi kerak" });
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
    tx_error: r.tx_error,
    total_days: secToDays(r.duration_sec),
    left_days: r.end_time ? Math.max(0, Math.ceil((r.end_time - now) / 86_400)) : null,
    end_time: r.end_time,
    price_per_day_uzs: pricePerDayUzs(r.price_per_day_nano),
    price_per_day_nano: r.price_per_day_nano,
    paid_uzs: r.paid_uzs,
    extend_affordable_days: daysAffordableExtend(r.price_per_day_nano, balanceUzs),
    is_linked: r.status === "linked",
  };
}
