import crypto from "node:crypto";
import { config } from "../config";
import {
  listCollections,
  listGiftsForCollection,
  sweepAllRentGifts,
  traitOf,
  rateLimitState,
  RawRentGift,
} from "./marketapp";
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
 *  KATALOG — bitta to'liq aylanma va server tomonda sahifalash
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Haqiqiy hajm: ~120 kolleksiya, ~8 000 gift. Bu uchta muammo tug'diradi,
 * uchalasi ham shu faylda hal qilingan.
 *
 * 1) MARKETAPP 429 QAYTARADI.
 *    Avval har bir kolleksiya ALOHIDA so'ralardi — 120 ta so'rov, ustiga
 *    parallel. Endi `/v1/rent/gifts/` kolleksiya filtrisiz, kursor bo'yicha
 *    ~100 tadan sahifalab o'qiladi: butun katalog ~80 KETMA-KET so'rov.
 *    So'rovlar orasidagi tanaffus 429 kelganda o'zi kengayadi va tinchlikda
 *    o'zi torayadi — tizim Marketapp chegarasini o'zi topib oladi.
 *
 * 2) YIQILGAN YANGILANISH MA'LUMOTNI O'CHIRIB YUBORARDI.
 *    Endi yangi indeks faqat OQIM TO'LIQ TUGAGANDA almashtiriladi: aylanish
 *    o'rtasida xato chiqsa, eski katalog joyida qoladi.
 *
 * 3) 8 000 GIFTNI BITTA JAVOBDA YUBORIB BO'LMAYDI (~2 MB).
 *    Shu sabab Mini App sahifalab oladi: `queryGifts()` xotiradagi indeksdan
 *    filtrlab, saralab, 60 tadan qaytaradi.
 *
 * BANDLIK: xarid oldidan `verifyGiftAvailable()` (yoki to'plam uchun
 * `verifyGiftsAvailable()`) aynan kerakli kolleksiyani bitta so'rov bilan
 * yangilaydi, xariddan keyin esa gift indeksdan DARHOL olib tashlanadi —
 * "to'lov o'tdi, lekin gift mavjud emas" degan holat shunday yopilgan.
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
  /** Atributlar — bir xil mavzudagi kolleksiya yig'ish uchun. */
  model?: string | null;
  symbol?: string | null;
  backdrop?: string | null;
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
let knownCollections = new Map<string, { address: string; name: string }>();

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

/** Bo'sh satrlarni `null` ga keltiradi. */
function str(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? null : t;
}

function comparePrice(a: CatalogGift, b: CatalogGift): number {
  const pa = BigInt(a.price_per_day_nano || "0");
  const pb = BigInt(b.price_per_day_nano || "0");
  return pa < pb ? -1 : pa > pb ? 1 : a.nft_name.localeCompare(b.nft_name);
}

/**
 * Gift nomidan kolleksiya "kaliti"ni yasaydi.
 *
 * Javobda gift o'z kolleksiya manzilini olib yurmaydi, faqat nomi bo'ladi:
 * "Pool Float #64956". Kolleksiya ro'yxatida esa nom KO'PLIKDA: "Pool Floats".
 * Shuning uchun ikkalasini bir xil ko'rinishga keltiramiz:
 *
 *   "Pool Float #64956" → "poolfloat"
 *   "Pool Floats"       → "poolfloat"
 *   "Bling Binky"       → "blingbinky"
 *   "Bling Binkies"     → "blingbinky"   (ies → y)
 */
function collectionKey(name: string): string {
  let key = String(name || "")
    .replace(/#\s*\d+\s*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (key.endsWith("ies")) key = key.slice(0, -3) + "y";
  else if (key.endsWith("ses") || key.endsWith("xes") || key.endsWith("zes")) key = key.slice(0, -2);
  else if (key.endsWith("s")) key = key.slice(0, -1);
  return key;
}

/** Gift nomidan kolleksiya nomini ajratadi: "Pool Float #64956" → "Pool Float". */
function baseName(nftName: string): string {
  return String(nftName || "").replace(/\s*#\s*\d+\s*$/, "").trim();
}

function normalizeGift(g: RawRentGift, collections: Map<string, { address: string; name: string }>): CatalogGift | null {
  if (!g?.nft_address || !g?.nft_name) return null;

  const base = baseName(g.nft_name);
  const col = collections.get(collectionKey(base));

  return {
    nft_address: g.nft_address,
    nft_name: g.nft_name,
    collection_address: col?.address ?? `name:${collectionKey(base)}`,
    collection_name: col?.name ?? base,
    price_per_day_nano: String(g.price_per_day ?? "0").split(".")[0] || "0",
    min_days: Math.max(1, secToDays(g.min_duration)),
    max_days: Math.max(1, secToDays(g.max_duration)),
    model: traitOf(g, "Model"),
    symbol: traitOf(g, "Symbol"),
    backdrop: traitOf(g, "Backdrop"),
  };
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
/** Indeksdagi barcha giftlar (narx bo'yicha o'sish tartibida). */
export function listGifts(): CatalogGift[] {
  return index;
}

export function findGift(nftAddress: string): CatalogGift | null {
  return byNft.get(nftAddress) ?? null;
}

/**
 * Giftni katalogdan DARHOL olib tashlaydi.
 *
 * Ijara rasmiylashtirilishi bilan chaqiriladi: shu zahoti u boshqa
 * foydalanuvchilarga ko'rinmaydi. Aks holda keyingi yangilanishgacha
 * (~10 daqiqa) gift ro'yxatda turaverar va kimdir uni sotib olishga
 * urinib, "mavjud emas" degan javob olardi.
 */
export function removeGift(nftAddress: string): void {
  const gift = byNft.get(nftAddress);
  if (!gift) return;

  const entry = byAddress.get(gift.collection_address);
  if (entry) entry.gifts = entry.gifts.filter((g) => g.nft_address !== nftAddress);
  rebuildIndex();
}

/**
 * Bitta kolleksiyani NAVBATDAN TASHQARI yangilaydi.
 *
 * Xarid oldidan chaqiriladi: shu bitta so'rov "gift hali ham bo'shmi?"
 * degan savolga aniq javob beradi. Butun katalogni tez-tez yangilash
 * o'rniga faqat MUHIM daqiqada, faqat kerakli kolleksiyani so'raymiz —
 * Marketapp'ga yuk deyarli qo'shilmaydi.
 *
 * `timeoutMs` ichida ulgurmasa — kutmaymiz: xaridni to'sib qo'ygandan ko'ra
 * davom etgan ma'qul (ish bajarilmasa, ishchi pulni qaytaradi).
 */
export async function verifyGiftAvailable(
  nftAddress: string,
  timeoutMs = 6000
): Promise<{ available: boolean; checked: boolean }> {
  const gift = byNft.get(nftAddress);
  if (!gift) return { available: false, checked: true };

  const refreshed = await Promise.race([
    refreshSingleCollection(gift.collection_address, gift.collection_name).then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs)),
  ]).catch(() => false);

  if (!refreshed) return { available: true, checked: false };
  return { available: byNft.has(nftAddress), checked: true };
}

/**
 * Bir nechta giftni BIRDANIGA tekshiradi (to'plam xaridi uchun).
 *
 * To'plamdagi giftlar bitta kolleksiyadan bo'lgani uchun bitta so'rov
 * hammasini yangilaydi — Marketapp'ga yuk 12 barobar emas, bir barobar.
 * Qaytadi: hali ham bo'sh giftlar ro'yxati va tekshiruv bajarilganmi.
 */
export async function verifyGiftsAvailable(
  nftAddresses: string[],
  timeoutMs = 8000
): Promise<{ available: string[]; checked: boolean }> {
  const targets = new Map<string, { address: string; name: string }>();
  for (const addr of nftAddresses) {
    const gift = byNft.get(addr);
    if (gift) targets.set(gift.collection_address, {
      address: gift.collection_address,
      name: gift.collection_name,
    });
  }
  if (targets.size === 0) return { available: [], checked: true };

  const refreshed = await Promise.race([
    Promise.all([...targets.values()].map((c) => refreshSingleCollection(c.address, c.name))).then(
      () => true
    ),
    new Promise<boolean>((r) => setTimeout(() => r(false), timeoutMs)),
  ]).catch(() => false);

  // Tekshira olmasak — xaridni to'smaymiz (ish bajarilmasa, ishchi pulni qaytaradi).
  if (!refreshed) return { available: [...nftAddresses], checked: false };
  return { available: nftAddresses.filter((a) => byNft.has(a)), checked: true };
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

/** Kolleksiyalar ro'yxatini o'qiydi (nom → manzil xaritasi uchun). */
async function loadCollectionMap(): Promise<Map<string, { address: string; name: string }>> {
  const map = new Map<string, { address: string; name: string }>();
  try {
    for (const c of await listCollections()) {
      if (!c?.address) continue;
      const name = String(c.name ?? "").trim();
      if (!name) continue;
      map.set(collectionKey(name), { address: c.address, name });
    }
    lastListAt = nowSec();
    knownCollections = map;
  } catch (err) {
    console.error("❌ Kolleksiyalar ro'yxatini olib bo'lmadi:", (err as Error).message);
  }
  return knownCollections.size > 0 ? knownCollections : map;
}

/**
 * To'liq aylanish: butun katalogni bitta oqim bilan qayta o'qiydi.
 *
 * MUHIM: natija FAQAT oqim to'liq tugagandagina qo'llanadi. Yarim yo'lda
 * uzilib qolsa, eski (ishlaydigan) katalog joyida qoladi — bo'sh ro'yxat
 * hech qachon saqlanmaydi.
 */
async function runSweep(): Promise<void> {
  if (cycleRunning) return;
  cycleRunning = true;

  const startedAt = Date.now();
  try {
    if (knownCollections.size === 0 || nowSec() - lastListAt > config.marketCollectionsRefreshSec) {
      await loadCollectionMap();
    }

    const raw = await sweepAllRentGifts((loaded, page) => {
      if (page % 20 === 0) console.log(`   … ${loaded} gift (${page}-sahifa)`);
    });

    if (raw.length === 0) {
      console.warn("⚠️  Marketapp bo'sh katalog qaytardi — eski nusxa saqlanib qoldi");
      return;
    }

    // Kolleksiyalar bo'yicha guruhlaymiz
    const grouped = new Map<string, Entry>();
    for (const g of raw) {
      const gift = normalizeGift(g, knownCollections);
      if (!gift) continue;

      let entry = grouped.get(gift.collection_address);
      if (!entry) {
        entry = {
          address: gift.collection_address,
          name: gift.collection_name,
          gifts: [],
          fetchedAt: nowSec(),
          lastError: null,
          lastTryAt: nowSec(),
        };
        grouped.set(gift.collection_address, entry);
      }
      entry.gifts.push(gift);
    }

    byAddress.clear();
    for (const [address, entry] of grouped) byAddress.set(address, entry);
    rebuildIndex();

    // Bazaga yozamiz — restartdan keyin darhol xizmat ko'rsatish uchun
    const fetchedAt = nowSec();
    await upsertCollectionNames(
      [...grouped.values()].map((e) => ({ address: e.address, name: e.name }))
    ).catch(() => {});
    for (const entry of grouped.values()) {
      await saveCollectionGifts(entry.address, entry.name, entry.gifts, fetchedAt).catch(() => {});
    }
    await deleteMissingCollections([...grouped.keys()]).catch(() => {});

    const withAttrs = index.filter((g) => g.model || g.backdrop || g.symbol).length;
    console.log(
      `🔄 Katalog to'liq yangilandi: ${index.length} gift / ${byAddress.size} kolleksiya · ` +
        `${Math.round((Date.now() - startedAt) / 1000)}s` +
        (withAttrs ? ` · ${withAttrs} tasida atributlar bor` : " · atributlar topilmadi")
    );
  } catch (err) {
    console.error("❌ Katalogni yangilashda xato:", (err as Error).message);
  } finally {
    cycleRunning = false;
  }
}


/**
 * Bitta kolleksiyani navbatdan tashqari yangilaydi — xarid oldidan
 * "bu gift hali bo'shmi?" degan savolga javob olish uchun.
 */
async function refreshSingleCollection(address: string, name: string): Promise<void> {
  const raw = await listGiftsForCollection(address);
  const gifts = raw.map((g) => normalizeGift(g, knownCollections)).filter(Boolean) as CatalogGift[];

  // Bo'sh javob deyarli har doim vaqtinchalik nosozlik — ishlaydigan
  // ma'lumotni o'chirmaymiz.
  const entry = byAddress.get(address);
  if (gifts.length === 0 && entry && entry.gifts.length > 0) return;

  byAddress.set(address, {
    address,
    name,
    gifts,
    fetchedAt: nowSec(),
    lastError: null,
    lastTryAt: nowSec(),
  });
  rebuildIndex();
  await saveCollectionGifts(address, name, gifts, nowSec()).catch(() => {});
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
      knownCollections.set(collectionKey(row.name), { address: row.address, name: row.name });
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
 * Fon yangilashini boshlaydi. Birinchi to'liq aylanish DARHOL boshlanadi,
 * lekin uni kutmaymiz — bazadan tiklangan katalog allaqachon xizmatga tayyor.
 */
export async function startCatalogRefresher(): Promise<void> {
  await hydrate();

  runSweep().catch(() => {});

  cycleTimer = setInterval(() => {
    runSweep().catch(() => {});
  }, config.marketSweepSec * 1000);
  cycleTimer.unref();

  console.log(`⚙️  Katalog har ${config.marketSweepSec}s da to'liq yangilanadi`);
}

export function stopCatalogRefresher(): void {
  if (cycleTimer) clearInterval(cycleTimer);
  if (listTimer) clearInterval(listTimer);
  cycleTimer = null;
  listTimer = null;
}

/** Admin uchun: darhol to'liq yangilash (navbat orqali, sekin ketadi). */
export async function refreshCatalogNow(): Promise<void> {
  await runSweep();
}

/** Mini App ijaralarni ko'rsatishda ham shu narx formulasini ishlatadi. */
export { pricePerDayUzs };
