import crypto from "node:crypto";
import { config } from "../config";
import { listCollections, listGiftsForCollection, rateLimitState } from "./marketapp";
import {
  loadAllCollections,
  upsertCollectionNames,
  saveCollectionGifts,
  markCollectionFailed,
  deleteMissingCollections,
} from "../db/repo/marketCache";
import { secToDays, pricePerDayUzs } from "./pricing";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  KATALOG — aylanma yangilash va server tomonda sahifalash
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Haqiqiy hajm: ~120 kolleksiya, ~8 000 gift. Bu ikkita muammo tug'diradi,
 * ikkalasi ham shu faylda hal qilingan.
 *
 * 1) MARKETAPP 429 QAYTARADI.
 *    Avval 120 ta kolleksiya 6 tadan parallel, har 90 soniyada so'ralardi —
 *    Marketapp buni "Too Many Requests" deb rad etardi. Endi so'rovlar
 *    ketma-ket va vaqt bo'ylab tarqatilgan: har siklda faqat `marketBatch`
 *    ta ENG ESKI kolleksiya yangilanadi. 120 ta kolleksiya uchun to'liq
 *    aylanish ~10 daqiqa — gift narxlari uchun bu mutlaqo yetarli.
 *
 * 2) YIQILGAN KOLLEKSIYA MA'LUMOTNI O'CHIRIB YUBORARDI.
 *    Eski kodda xato bo'lgan kolleksiya BO'SH ro'yxat sifatida saqlanardi,
 *    ya'ni bitta 429 ishlaydigan giftlarni o'chirardi. Endi har bir
 *    kolleksiya mustaqil: muvaffaqiyatsiz urinishda faqat xato yoziladi,
 *    giftlarga umuman tegilmaydi.
 *
 * 3) 8 000 GIFTNI BITTA JAVOBDA YUBORIB BO'LMAYDI (~2 MB).
 *    Shu sabab Mini App endi sahifalab oladi: `queryGifts()` xotiradagi
 *    indeksdan filtrlab, saralab, 60 tadan qaytaradi. Indeks oldindan
 *    tayyorlangani uchun bu millisekundlar ichida bajariladi.
 */

export interface CatalogGift {
  nft_address: string;
  nft_name: string;
  collection_address: string;
  collection_name: string;
  /** nanoTON — string, chunki 2^53 dan katta bo'lishi mumkin */
  price_per_day_nano: string;
  min_days: number;
  max_days: number;
}

export interface CatalogCollection {
  address: string;
  name: string;
  gift_count: number;
  /** Oxirgi muvaffaqiyatli yangilanish (unix). 0 — hali bir marta ham olinmagan. */
  fetched_at: number;
  /** Oxirgi urinishdagi xato (masalan 429). */
  last_error: string | null;
}

export interface CatalogStats {
  collections: number;
  gifts: number;
  /** Hali bir marta ham yuklanmagan kolleksiyalar soni. */
  pending: number;
  /** Oxirgi urinishda xato bergan kolleksiyalar soni. */
  failing: number;
  /** Eng eski ma'lumotning yoshi (soniya). */
  oldest_age_sec: number;
  ready: boolean;
  rate_interval_ms: number;
  rate_limited: boolean;
}

const FRAGMENT_CDN = "https://nft.fragment.com/gift";

// ── Xotiradagi holat ──
interface Entry {
  address: string;
  name: string;
  gifts: CatalogGift[];
  fetchedAt: number;
  lastError: string | null;
  lastTryAt: number;
}

const byAddress = new Map<string, Entry>();
const byNft = new Map<string, CatalogGift>();

/** Narx bo'yicha o'sish tartibida saralangan tekis indeks (sahifalash uchun). */
let index: CatalogGift[] = [];
/** Indeks har o'zgarganda yangilanadi — klient sahifalashni qaytadan boshlashi uchun. */
let indexVersion = "";

let cycleTimer: NodeJS.Timeout | null = null;
let listTimer: NodeJS.Timeout | null = null;
let cycleRunning = false;
let lastListAt = 0;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Rasm manzili
// ═══════════════════════════════════════════════════════════════════════════

/** "Rare Bird #7043" → "rarebird-7043" */
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

// ═══════════════════════════════════════════════════════════════════════════
//  Indeks
// ═══════════════════════════════════════════════════════════════════════════

function rebuildIndex(): void {
  const all: CatalogGift[] = [];
  byNft.clear();

  for (const entry of byAddress.values()) {
    for (const gift of entry.gifts) {
      all.push(gift);
      byNft.set(gift.nft_address, gift);
    }
  }

  // Bir marta saralaymiz — keyin har bir sahifa so'rovi tayyor tartibdan oladi.
  all.sort((a, b) => comparePrice(a, b));
  index = all;

  const hash = crypto.createHash("sha1");
  hash.update(String(all.length));
  for (const g of all) hash.update(g.nft_address);
  indexVersion = hash.digest("hex").slice(0, 12);
}

function comparePrice(a: CatalogGift, b: CatalogGift): number {
  const pa = BigInt(a.price_per_day_nano || "0");
  const pb = BigInt(b.price_per_day_nano || "0");
  return pa < pb ? -1 : pa > pb ? 1 : a.nft_name.localeCompare(b.nft_name);
}

function normalizeGifts(
  raw: Awaited<ReturnType<typeof listGiftsForCollection>>,
  address: string,
  name: string
): CatalogGift[] {
  const out: CatalogGift[] = [];
  for (const g of raw) {
    if (!g?.nft_address || !g?.nft_name) continue;
    out.push({
      nft_address: g.nft_address,
      nft_name: g.nft_name,
      collection_address: address,
      collection_name: name,
      price_per_day_nano: String(g.price_per_day ?? "0").split(".")[0] || "0",
      min_days: Math.max(1, secToDays(g.min_duration)),
      max_days: Math.max(1, secToDays(g.max_duration)),
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  O'qish (Mini App shu funksiyalardan foydalanadi)
// ═══════════════════════════════════════════════════════════════════════════

export function listCatalogCollections(): CatalogCollection[] {
  const out: CatalogCollection[] = [];
  for (const e of byAddress.values()) {
    if (e.gifts.length === 0) continue; // bo'sh kolleksiyani ko'rsatmaymiz
    out.push({
      address: e.address,
      name: e.name,
      gift_count: e.gifts.length,
      fetched_at: e.fetchedAt,
      last_error: e.lastError,
    });
  }
  out.sort((a, b) => b.gift_count - a.gift_count || a.name.localeCompare(b.name));
  return out;
}

export interface GiftQuery {
  collection?: string | null;
  search?: string;
  sort?: "asc" | "desc";
  offset?: number;
  limit?: number;
}

export interface GiftPage {
  items: CatalogGift[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
  version: string;
}

/**
 * Filtrlash + saralash + sahifalash — hammasi xotirada.
 * 8 000 element ustidan chiziqli filtr ~1 ms, shuning uchun alohida
 * indeks/qidiruv tuzilmasi kerak emas.
 */
export function queryGifts(q: GiftQuery): GiftPage {
  const limit = Math.min(Math.max(1, q.limit ?? config.marketPageSize), 100);
  const offset = Math.max(0, q.offset ?? 0);
  const term = (q.search ?? "").trim().toLowerCase();

  let items: CatalogGift[] = index;

  if (q.collection || term) {
    items = index.filter((g) => {
      if (q.collection && g.collection_address !== q.collection) return false;
      if (term && !g.nft_name.toLowerCase().includes(term)) return false;
      return true;
    });
  }

  const total = items.length;
  // Indeks o'sish tartibida saralangan; kamayish uchun oxiridan olamiz.
  const page =
    q.sort === "desc"
      ? items.slice(Math.max(0, total - offset - limit), Math.max(0, total - offset)).reverse()
      : items.slice(offset, offset + limit);

  return {
    items: page,
    total,
    offset,
    limit,
    has_more: offset + page.length < total,
    version: indexVersion,
  };
}

/** To'lovdan oldin narx va muddatni tekshirish uchun. */
export function findGift(nftAddress: string): CatalogGift | null {
  return byNft.get(nftAddress) ?? null;
}

export function catalogStats(): CatalogStats {
  let pending = 0;
  let failing = 0;
  let oldest = 0;
  const now = nowSec();

  for (const e of byAddress.values()) {
    if (e.fetchedAt === 0) pending++;
    else oldest = Math.max(oldest, now - e.fetchedAt);
    if (e.lastError) failing++;
  }

  const rate = rateLimitState();
  return {
    collections: byAddress.size,
    gifts: index.length,
    pending,
    failing,
    oldest_age_sec: oldest,
    ready: index.length > 0,
    rate_interval_ms: rate.intervalMs,
    rate_limited: rate.limitedRecently,
  };
}

/** Mini App katalog o'zgarganini shu belgidan biladi. */
export function catalogVersion(): string {
  return indexVersion;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Yangilash
// ═══════════════════════════════════════════════════════════════════════════

/** Kolleksiyalar RO'YXATINI yangilaydi (giftlarga tegmaydi). */
async function refreshCollectionList(): Promise<void> {
  try {
    const raw = await listCollections();
    if (raw.length === 0) {
      console.warn("⚠️  Marketapp bo'sh kolleksiya ro'yxatini qaytardi — o'zgartirmaymiz");
      return;
    }

    const items = raw
      .filter((c) => c?.address)
      .map((c) => ({ address: c.address, name: String(c.name ?? "Nomsiz") }));

    for (const item of items) {
      const existing = byAddress.get(item.address);
      if (existing) {
        existing.name = item.name;
      } else {
        byAddress.set(item.address, {
          address: item.address,
          name: item.name,
          gifts: [],
          fetchedAt: 0,
          lastError: null,
          lastTryAt: 0,
        });
      }
    }

    // Marketapp'dan yo'qolgan kolleksiyalarni olib tashlaymiz.
    const keep = new Set(items.map((i) => i.address));
    for (const address of [...byAddress.keys()]) {
      if (!keep.has(address)) byAddress.delete(address);
    }

    await upsertCollectionNames(items);
    await deleteMissingCollections(items.map((i) => i.address));

    lastListAt = nowSec();
    rebuildIndex();
    console.log(`📚 Kolleksiyalar ro'yxati: ${items.length} ta`);
  } catch (err) {
    console.error("❌ Kolleksiyalar ro'yxatini olib bo'lmadi:", (err as Error).message);
  }
}

/** Navbatdagi partiya: eng uzoq vaqt yangilanmagan kolleksiyalar. */
function pickBatch(size: number): Entry[] {
  return [...byAddress.values()]
    .sort((a, b) => {
      // Hali bir marta ham yuklanmaganlar eng oldinda.
      if (a.fetchedAt === 0 && b.fetchedAt !== 0) return -1;
      if (b.fetchedAt === 0 && a.fetchedAt !== 0) return 1;
      // Keyin — eng eskisi. Xato berganini biroz kutamiz (lastTryAt hisobga olinadi).
      return a.fetchedAt + (a.lastError ? 300 : 0) - (b.fetchedAt + (b.lastError ? 300 : 0));
    })
    .slice(0, size);
}

/** Bitta kolleksiyani yangilaydi. Xatoda MAVJUD giftlar saqlanib qoladi. */
async function refreshOne(entry: Entry): Promise<boolean> {
  entry.lastTryAt = nowSec();
  try {
    const raw = await listGiftsForCollection(entry.address);
    const gifts = normalizeGifts(raw, entry.address, entry.name);

    // Ilgari giftlari bor edi, endi bo'sh kelyapti — bu deyarli har doim
    // Marketapp tomonidagi vaqtinchalik nosozlik. Ishlaydigan ma'lumotni
    // o'chirmaymiz, faqat belgilab qo'yamiz.
    if (gifts.length === 0 && entry.gifts.length > 0) {
      entry.lastError = "bo'sh javob";
      await markCollectionFailed(entry.address, "bo'sh javob");
      return false;
    }

    entry.gifts = gifts;
    entry.fetchedAt = nowSec();
    entry.lastError = null;
    await saveCollectionGifts(entry.address, entry.name, gifts, entry.fetchedAt);
    return true;
  } catch (err) {
    const message = (err as Error).message;
    entry.lastError = message.slice(0, 200);
    await markCollectionFailed(entry.address, message).catch(() => {});
    // DIQQAT: entry.gifts ga TEGILMAYDI — eski ma'lumot joyida qoladi.
    return false;
  }
}

/** Bitta sikl: bir nechta kolleksiyani ketma-ket yangilaydi. */
async function runCycle(): Promise<void> {
  if (cycleRunning) return;
  cycleRunning = true;

  try {
    if (byAddress.size === 0 || nowSec() - lastListAt > config.marketCollectionsRefreshSec) {
      await refreshCollectionList();
    }

    const batch = pickBatch(config.marketBatch);
    if (batch.length === 0) return;

    let ok = 0;
    for (const entry of batch) {
      // eslint-disable-next-line no-await-in-loop
      if (await refreshOne(entry)) ok++;
    }

    rebuildIndex();

    const stats = catalogStats();
    console.log(
      `🔄 Katalog: ${ok}/${batch.length} kolleksiya yangilandi · ` +
        `jami ${stats.gifts} gift / ${stats.collections} kolleksiya` +
        (stats.pending ? ` · ${stats.pending} ta kutilmoqda` : "") +
        (stats.failing ? ` · ${stats.failing} ta xato` : "")
    );
  } catch (err) {
    console.error("❌ Katalog sikli xatosi:", (err as Error).message);
  } finally {
    cycleRunning = false;
  }
}

/** Bazadagi oxirgi nusxani xotiraga yuklaydi (ishga tushishda). */
async function hydrate(): Promise<void> {
  try {
    const rows = await loadAllCollections();
    for (const row of rows) {
      byAddress.set(row.address, {
        address: row.address,
        name: row.name,
        gifts: Array.isArray(row.gifts) ? row.gifts : [],
        fetchedAt: row.fetched_at,
        lastError: row.last_error,
        lastTryAt: row.last_try_at,
      });
    }
    rebuildIndex();

    if (index.length > 0) {
      console.log(`💾 Katalog bazadan tiklandi: ${index.length} gift / ${rows.length} kolleksiya`);
    }
  } catch (err) {
    console.warn("Katalogni bazadan o'qib bo'lmadi:", (err as Error).message);
  }
}

/**
 * Fon yangilashini boshlaydi.
 *
 * Birinchi sikl DARHOL ishlaydi, lekin uni kutmaymiz: bazadan tiklangan
 * katalog allaqachon xizmat ko'rsatishga tayyor.
 */
export async function startCatalogRefresher(): Promise<void> {
  await hydrate();

  runCycle().catch(() => {});

  cycleTimer = setInterval(() => {
    runCycle().catch(() => {});
  }, config.marketCycleSec * 1000);
  cycleTimer.unref();

  const fullPassMin = Math.round(
    ((Math.max(1, byAddress.size) / config.marketBatch) * config.marketCycleSec) / 60
  );
  console.log(
    `⚙️  Katalog yangilash: har ${config.marketCycleSec}s da ${config.marketBatch} ta kolleksiya ` +
      `(to'liq aylanish ~${fullPassMin} daqiqa)`
  );
}

export function stopCatalogRefresher(): void {
  if (cycleTimer) clearInterval(cycleTimer);
  if (listTimer) clearInterval(listTimer);
  cycleTimer = null;
  listTimer = null;
}

/** Admin uchun: darhol to'liq yangilash (navbat orqali, sekin ketadi). */
export async function refreshCatalogNow(): Promise<void> {
  await refreshCollectionList();
  await runCycle();
}

/** Mini App ijaralarni ko'rsatishda ham shu narx formulasini ishlatadi. */
export { pricePerDayUzs };
