import crypto from "node:crypto";
import { config } from "../config";
import { listCollections, listGiftsForCollection } from "./marketapp";
import { loadSnapshot, saveSnapshot } from "../db/repo/marketCache";
import { secToDays } from "./pricing";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  KATALOG KESHI — Mini App tezligining asosiy sababi
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Eski oqim (sekin edi):
 *   Mini App ochiladi
 *     → GET /api/collections   → Marketapp (1-3 s)
 *     → har bir kolleksiya uchun GET /api/gifts → Marketapp (yana N ta so'rov)
 *   Ya'ni HAR BIR foydalanuvchi, HAR SAFAR ochganda Marketapp'ni kutardi.
 *   20 ta kolleksiya = 21 ta tashqi so'rov = 5-15 soniya "oq ekran".
 *
 * Yangi oqim (tez):
 *   Fon ishchisi MARKET_REFRESH_SEC (default 90 s) da bir marta butun
 *   katalogni yig'ib, xotirada va bazada saqlaydi. Mini App esa uni
 *   XOTIRADAN o'qiydi — tashqi so'rov umuman yo'q, javob ~1 ms.
 *
 * Qo'shimcha kafolatlar:
 *   • Bot qayta ishga tushsa — kesh bazadan tiklanadi, "sovuq start" yo'q.
 *   • Marketapp yiqilsa — oxirgi ishlaydigan nusxa ko'rsatiladi (`stale`
 *     bayrog'i bilan), Mini App bo'shab qolmaydi.
 *   • ETag orqali takroriy ochilishlar 304 bilan javob oladi (trafik tejaladi).
 */

export interface CatalogCollection {
  address: string;
  name: string;
  gift_count: number;
}

export interface CatalogGift {
  nft_address: string;
  nft_name: string;
  collection_address: string;
  collection_name: string;
  /** nanoTON — string, chunki 2^53 dan katta bo'lishi mumkin */
  price_per_day_nano: string;
  min_days: number;
  max_days: number;
  image_url: string;
}

export interface Catalog {
  collections: CatalogCollection[];
  gifts: CatalogGift[];
  fetched_at: number;
  stale: boolean;
  etag: string;
}

const FRAGMENT_CDN = "https://nft.fragment.com/gift";
const SNAPSHOT_KEY = "catalog";
/** Marketapp'ni bir vaqtda nechta so'rov bilan bezovta qilish mumkin. */
const FETCH_CONCURRENCY = 6;

let memory: Catalog | null = null;
let refreshing: Promise<void> | null = null;
let timer: NodeJS.Timeout | null = null;

/**
 * "Rare Bird #7043" → "rarebird-7043"
 * Fragment CDN rasm manzili shu qoidada yasaladi, alohida so'rov kerak emas.
 */
export function giftSlug(nftName: string): string {
  return (nftName || "")
    .trim()
    .replace(/\s*#\s*/g, "-")
    .replace(/[\s_]+/g, "")
    .toLowerCase();
}

export function giftImageUrl(nftName: string): string {
  return `${FRAGMENT_CDN}/${giftSlug(nftName)}.medium.jpg`;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function computeEtag(gifts: CatalogGift[], fetchedAt: number): string {
  const hash = crypto.createHash("sha1");
  hash.update(String(fetchedAt));
  hash.update(String(gifts.length));
  for (const g of gifts) hash.update(g.nft_address + g.price_per_day_nano);
  return `W/"${hash.digest("hex").slice(0, 16)}"`;
}

/** Bir nechta vazifani cheklangan parallellik bilan bajaradi. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function buildCatalog(
  collections: CatalogCollection[],
  gifts: CatalogGift[],
  fetchedAt: number
): Catalog {
  return {
    collections,
    gifts,
    fetched_at: fetchedAt,
    stale: nowSec() - fetchedAt > config.marketStaleSec,
    etag: computeEtag(gifts, fetchedAt),
  };
}

/**
 * Katalogni Marketapp'dan to'liq yig'ib, xotira va bazaga yozadi.
 * Bir vaqtda faqat BITTA yangilash ketadi (takroriy chaqiruvlar shu bittasini kutadi).
 */
export async function refreshCatalog(): Promise<void> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    const startedAt = Date.now();
    try {
      const rawCollections = await listCollections();

      const perCollection = await mapLimit(rawCollections, FETCH_CONCURRENCY, async (col) => {
        try {
          const items = await listGiftsForCollection(col.address);
          return { col, items };
        } catch (err) {
          // Bitta kolleksiya yiqilsa — qolganlari baribir ko'rsatiladi.
          console.warn(`⚠️  Kolleksiya yuklanmadi (${col.name ?? col.address}):`, (err as Error).message);
          return { col, items: [] };
        }
      });

      const collections: CatalogCollection[] = [];
      const gifts: CatalogGift[] = [];

      for (const { col, items } of perCollection) {
        const name = String(col.name ?? "Nomsiz");
        collections.push({ address: col.address, name, gift_count: items.length });

        for (const g of items) {
          if (!g?.nft_address || !g?.nft_name) continue;
          gifts.push({
            nft_address: g.nft_address,
            nft_name: g.nft_name,
            collection_address: col.address,
            collection_name: name,
            price_per_day_nano: String(g.price_per_day ?? "0").split(".")[0],
            min_days: Math.max(1, secToDays(g.min_duration)),
            max_days: Math.max(1, secToDays(g.max_duration)),
            image_url: giftImageUrl(g.nft_name),
          });
        }
      }

      // Bo'sh natija — deyarli har doim Marketapp tomonidagi vaqtinchalik
      // muammo. Mavjud ishlaydigan keshni bo'sh ro'yxat bilan almashtirmaymiz.
      if (gifts.length === 0 && memory && memory.gifts.length > 0) {
        console.warn("⚠️  Marketapp bo'sh katalog qaytardi — eski kesh saqlanib qoldi");
        return;
      }

      const fetchedAt = nowSec();
      memory = buildCatalog(collections, gifts, fetchedAt);
      await saveSnapshot(SNAPSHOT_KEY, { collections, gifts }, fetchedAt).catch((err) =>
        console.error("Katalogni bazaga yozishda xato:", err.message)
      );

      console.log(
        `🔄 Katalog yangilandi: ${collections.length} kolleksiya, ${gifts.length} gift ` +
          `(${Date.now() - startedAt} ms)`
      );
    } catch (err) {
      console.error("❌ Katalogni yangilab bo'lmadi:", (err as Error).message);
      if (memory) memory.stale = nowSec() - memory.fetched_at > config.marketStaleSec;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

/** Bazadagi oxirgi nusxani xotiraga yuklaydi (ishga tushishda). */
async function hydrateFromDatabase(): Promise<void> {
  try {
    const snap = await loadSnapshot<{ collections: CatalogCollection[]; gifts: CatalogGift[] }>(
      SNAPSHOT_KEY
    );
    if (snap && snap.payload?.gifts?.length) {
      memory = buildCatalog(snap.payload.collections ?? [], snap.payload.gifts, snap.fetchedAt);
      console.log(
        `💾 Katalog bazadan tiklandi: ${memory.gifts.length} gift ` +
          `(${nowSec() - snap.fetchedAt}s oldin yangilangan)`
      );
    }
  } catch (err) {
    console.warn("Katalogni bazadan o'qib bo'lmadi:", (err as Error).message);
  }
}

/**
 * Katalogni qaytaradi. HECH QACHON tashqi so'rov qilmaydi va hech qachon
 * kutmaydi — shuning uchun Mini App bir zumda ochiladi.
 */
export function getCatalog(): Catalog {
  if (!memory) {
    return { collections: [], gifts: [], fetched_at: 0, stale: true, etag: 'W/"empty"' };
  }
  memory.stale = nowSec() - memory.fetched_at > config.marketStaleSec;
  return memory;
}

export function findGift(nftAddress: string): CatalogGift | null {
  return getCatalog().gifts.find((g) => g.nft_address === nftAddress) ?? null;
}

/** Fon yangilashini boshlaydi (birinchi yangilash blokirovka qilmaydi). */
export async function startCatalogRefresher(): Promise<void> {
  await hydrateFromDatabase();

  // Birinchi yangilashni kutmaymiz: bazadan tiklangan nusxa allaqachon bor,
  // shuning uchun bot darhol xizmat ko'rsata boshlaydi.
  refreshCatalog().catch(() => {});

  timer = setInterval(() => {
    refreshCatalog().catch(() => {});
  }, config.marketRefreshSec * 1000);
  timer.unref();
}

export function stopCatalogRefresher(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
