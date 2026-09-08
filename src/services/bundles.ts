import crypto from "node:crypto";
import { listGifts, catalogVersion, giftImageUrl, CatalogGift } from "./catalog";
import { BUNDLE_MIN_DAYS, BUNDLE_SIZES, bundleQuote, pricePerDayUzs } from "./pricing";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TO'PLAMLAR — bir mavzudagi giftlar to'plami
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi bitta gift emas, 3 / 6 / 9 yoki 12 tadan iborat, BIR XIL
 * belgiga ega to'plamni bir bosishda ijaraga oladi:
 *
 *   • orqa fon (Backdrop) — bir xil rangdagi giftlar, eng chiroyli variant
 *   • model  (Model)
 *   • belgi  (Symbol)
 *
 * Muddat kamida BUNDLE_MIN_DAYS (7) kun, har bir gift uchun xizmat haqi
 * olinadi, ustiga BUNDLE_MARKUP_PCT (10%) ustama qo'shiladi. Foydalanuvchiga
 * har bir giftning narxi emas, faqat TO'PLAMNING yakuniy narxi ko'rsatiladi.
 *
 * TEZLIK: to'plamlar katalog indeksidan XOTIRADA yig'iladi va katalog
 * versiyasi o'zgarmaguncha qayta hisoblanmaydi. Marketapp'ga bitta ham
 * qo'shimcha so'rov ketmaydi.
 */

/** To'plam qaysi belgi bo'yicha yig'ilgan. */
export type BundleKind = "backdrop" | "model" | "symbol";

export interface Bundle {
  id: string;
  kind: BundleKind;
  /** Belgi qiymati, masalan "Cobalt Blue". */
  value: string;
  collection_address: string;
  collection_name: string;
  /** To'plamdagi giftlar — narx bo'yicha arzondan qimmatga. */
  gifts: CatalogGift[];
  /** Shu to'plamda mavjud o'lchamlar (3/6/9/12 dan qaysilari yig'iladi). */
  sizes: number[];
  /** Barcha giftlar uchun ruxsat etilgan eng uzun muddat. */
  max_days: number;
}

const KIND_ORDER: Record<BundleKind, number> = { backdrop: 0, model: 1, symbol: 2 };

export const KIND_LABEL: Record<BundleKind, string> = {
  backdrop: "Bir xil fon",
  model: "Bir xil model",
  symbol: "Bir xil belgi",
};

/** Bitta to'plamdagi eng ko'p gift soni. */
const MAX_SIZE = Math.max(...BUNDLE_SIZES);

// Kesh (katalog versiyasiga bog'langan)
let builtFor = " ";
let ordered: Bundle[] = [];
let byId = new Map<string, Bundle>();

function traitOfGift(g: CatalogGift, kind: BundleKind): string | null {
  const v = kind === "backdrop" ? g.backdrop : kind === "model" ? g.model : g.symbol;
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? null : t;
}

function bundleId(kind: BundleKind, collectionAddress: string, value: string): string {
  return crypto
    .createHash("sha1")
    .update(`${kind}|${collectionAddress}|${value.toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Katalog indeksidan to'plamlarni yig'adi.
 *
 * Faqat muddati 7 kunga yetadigan giftlar olinadi — aks holda to'plamni
 * eng kam muddatga ham ijaraga berib bo'lmaydi.
 */
function build(): void {
  const version = catalogVersion();
  if (version === builtFor) return;

  const groups = new Map<string, Bundle>();

  for (const gift of listGifts()) {
    if (gift.max_days < BUNDLE_MIN_DAYS) continue;

    for (const kind of ["backdrop", "model", "symbol"] as BundleKind[]) {
      const value = traitOfGift(gift, kind);
      if (!value) continue;

      const id = bundleId(kind, gift.collection_address, value);
      let group = groups.get(id);
      if (!group) {
        group = {
          id,
          kind,
          value,
          collection_address: gift.collection_address,
          collection_name: gift.collection_name,
          gifts: [],
          sizes: [],
          max_days: gift.max_days,
        };
        groups.set(id, group);
      }

      // Indeks allaqachon arzondan qimmatga saralangan, shuning uchun
      // birinchi kelganlar eng arzoni — eng ko'pi bilan 12 tasini olamiz.
      if (group.gifts.length < MAX_SIZE) {
        group.gifts.push(gift);
        group.max_days = Math.min(group.max_days, gift.max_days);
      }
    }
  }

  const out: Bundle[] = [];
  for (const group of groups.values()) {
    group.sizes = BUNDLE_SIZES.filter((n) => n <= group.gifts.length);
    if (group.sizes.length === 0) continue; // 3 tadan kam — to'plam bo'lmaydi
    out.push(group);
  }

  // Avval "bir xil fon" (eng chiroylisi), keyin kattaroq to'plamlar,
  // oxirida arzonrog'i — foydalanuvchi eng yaxshisini birinchi ko'radi.
  out.sort((a, b) => {
    const k = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (k !== 0) return k;
    const s = b.gifts.length - a.gifts.length;
    if (s !== 0) return s;
    return startingTotal(a) - startingTotal(b);
  });

  ordered = out;
  byId = new Map(out.map((b) => [b.id, b]));
  builtFor = version;
}

/** Eng kichik o'lchamdagi (3 ta) to'plamning 7 kunlik narxi — saralash uchun. */
function startingTotal(b: Bundle): number {
  const size = b.sizes[0];
  return bundleQuote(
    b.gifts.slice(0, size).map((g) => g.price_per_day_nano),
    BUNDLE_MIN_DAYS
  ).total_uzs;
}

export interface BundleQuery {
  kind: BundleKind | null;
  collection: string | null;
  offset: number;
  limit: number;
}

export interface BundlePage {
  version: string;
  total: number;
  offset: number;
  has_more: boolean;
  items: Bundle[];
}

export function queryBundles(q: BundleQuery): BundlePage {
  build();

  let list = ordered;
  if (q.kind) list = list.filter((b) => b.kind === q.kind);
  if (q.collection) list = list.filter((b) => b.collection_address === q.collection);

  const offset = Math.max(0, q.offset);
  const limit = Math.min(60, Math.max(1, q.limit));
  const items = list.slice(offset, offset + limit);

  return {
    version: catalogVersion(),
    total: list.length,
    offset,
    has_more: offset + items.length < list.length,
    items,
  };
}

export function findBundle(id: string): Bundle | null {
  build();
  return byId.get(id) ?? null;
}

export function bundleStats(): { total: number; backdrops: number } {
  build();
  return {
    total: ordered.length,
    backdrops: ordered.reduce((n, b) => n + (b.kind === "backdrop" ? 1 : 0), 0),
  };
}

/**
 * To'plamni Mini App tushunadigan ko'rinishga o'tkazadi.
 *
 * DIQQAT: har bir giftning NARXI YUBORILMAYDI. Foydalanuvchi faqat
 * to'plamning yakuniy narxini ko'rishi kerak — talab shunday.
 */
export function serializeBundle(b: Bundle, opts: { withGifts?: boolean } = {}) {
  const prices = b.gifts.map((g) => g.price_per_day_nano);

  return {
    id: b.id,
    kind: b.kind,
    kind_label: KIND_LABEL[b.kind],
    value: b.value,
    collection_name: b.collection_name,
    collection_address: b.collection_address,
    available: b.gifts.length,
    sizes: b.sizes,
    min_days: BUNDLE_MIN_DAYS,
    max_days: b.max_days,
    from_per_day_uzs: pricePerDayUzs(b.gifts[0]?.price_per_day_nano ?? "0"),
    // Har o'lcham uchun: eng kam muddatdagi (7 kun) narx va kunlik yig'indi.
    //
    // `per_day_uzs` — shu o'lchamdagi giftlarning KUNLIK narxlari YIG'INDISI.
    // Mini App slayderni surganda narxni shu bittagina son bilan, server bilan
    // BIR XIL formula bo'yicha hisoblaydi. Alohida giftning narxi yuborilmaydi.
    prices: b.sizes.map((size) => ({
      size,
      per_day_uzs: prices.slice(0, size).reduce<number>((n, p) => n + pricePerDayUzs(p), 0),
      total_uzs: bundleQuote(prices.slice(0, size), BUNDLE_MIN_DAYS).total_uzs,
    })),
    preview: b.gifts.slice(0, 4).map((g) => ({
      nft_name: g.nft_name,
      image_url: giftImageUrl(g.nft_name),
    })),
    gifts: opts.withGifts
      ? b.gifts.map((g) => ({
          nft_address: g.nft_address,
          nft_name: g.nft_name,
          image_url: giftImageUrl(g.nft_name),
          max_days: g.max_days,
        }))
      : undefined,
  };
}
