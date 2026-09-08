import crypto from "node:crypto";
import { listGifts, catalogVersion, giftImageUrl, CatalogGift } from "./catalog";
import { BUNDLE_MIN_DAYS, BUNDLE_SIZES, bundleQuote, pricePerDayUzs } from "./pricing";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TO'PLAMLAR — bir mavzudagi giftlar to'plami
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi bitta gift emas, 3 / 6 / 9 yoki 12 tadan iborat, BIR XIL
 * ko'rinishdagi to'plamni bir bosishda ijaraga oladi. Uchta daraja bor va
 * har biri ORQA FONDAN boshlanadi — to'plamning ko'zga tashlanadigan
 * belgisi aynan fon rangi:
 *
 *   1) fon                       — bir xil rangdagi giftlar
 *   2) fon + model               — rangi ham, modeli ham bir xil
 *   3) fon + model + belgi       — uchalasi ham bir xil, eng nozik variant
 *
 * Ya'ni har bir keyingi daraja oldingisidan qat'iyroq: 3-darajadagi
 * to'plam giftlari bir-biridan faqat raqami bilan farq qiladi.
 *
 * Muddat kamida BUNDLE_MIN_DAYS (7) kun, har bir gift uchun xizmat haqi
 * olinadi, ustiga BUNDLE_MARKUP_PCT (10%) ustama qo'shiladi. Foydalanuvchiga
 * har bir giftning narxi emas, faqat TO'PLAMNING yakuniy narxi ko'rsatiladi.
 *
 * TEZLIK: to'plamlar katalog indeksidan XOTIRADA yig'iladi va katalog
 * versiyasi o'zgarmaguncha qayta hisoblanmaydi. Marketapp'ga bitta ham
 * qo'shimcha so'rov ketmaydi.
 */

/** To'plam qanchalik qat'iy tanlangan (hammasi fondan boshlanadi). */
export type BundleKind = "backdrop" | "backdrop_model" | "backdrop_model_symbol";

/** Har bir daraja qaysi atributlarni bir xil bo'lishini talab qiladi. */
const KIND_TRAITS: Record<BundleKind, Array<"backdrop" | "model" | "symbol">> = {
  backdrop: ["backdrop"],
  backdrop_model: ["backdrop", "model"],
  backdrop_model_symbol: ["backdrop", "model", "symbol"],
};

const KINDS = Object.keys(KIND_TRAITS) as BundleKind[];

export interface Bundle {
  id: string;
  kind: BundleKind;
  /** Ko'rsatish uchun: "Neon Blue" yoki "Neon Blue · Lizard · Eagle". */
  value: string;
  /** To'plamni belgilovchi atributlar (darajaga qarab null bo'lishi mumkin). */
  backdrop: string;
  model: string | null;
  symbol: string | null;
  collection_address: string;
  collection_name: string;
  /** To'plamdagi giftlar — narx bo'yicha arzondan qimmatga. */
  gifts: CatalogGift[];
  /** Shu to'plamda mavjud o'lchamlar (3/6/9/12 dan qaysilari yig'iladi). */
  sizes: number[];
  /** Barcha giftlar uchun ruxsat etilgan eng uzun muddat. */
  max_days: number;
}

// Foydalanuvchi ro'yxatni shu tartibda ko'radi: avval eng keng variant.
const KIND_ORDER: Record<BundleKind, number> = {
  backdrop: 0,
  backdrop_model: 1,
  backdrop_model_symbol: 2,
};

export const KIND_LABEL: Record<BundleKind, string> = {
  backdrop: "Bir xil fon",
  backdrop_model: "Fon + model",
  backdrop_model_symbol: "Fon + model + belgi",
};

/** Bitta to'plamdagi eng ko'p gift soni. */
const MAX_SIZE = Math.max(...BUNDLE_SIZES);

// Kesh (katalog versiyasiga bog'langan)
let builtFor = " ";
let ordered: Bundle[] = [];
let byId = new Map<string, Bundle>();

function traitOfGift(g: CatalogGift, trait: "backdrop" | "model" | "symbol"): string | null {
  const v = trait === "backdrop" ? g.backdrop : trait === "model" ? g.model : g.symbol;
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

    for (const kind of KINDS) {
      // Darajaning HAMMA atributi bo'lishi shart. Fon ko'rsatilmagan gift
      // hech qaysi to'plamga tushmaydi, modeli yo'q gift esa faqat
      // birinchi darajada qoladi.
      const parts = KIND_TRAITS[kind].map((t) => traitOfGift(gift, t));
      if (parts.some((p) => p === null)) continue;

      const value = parts.join(" · ");
      const id = bundleId(kind, gift.collection_address, value);
      let group = groups.get(id);
      if (!group) {
        group = {
          id,
          kind,
          value,
          backdrop: parts[0]!,
          model: parts[1] ?? null,
          symbol: parts[2] ?? null,
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

  // Avval eng keng daraja (faqat fon), keyin qat'iyroqlari; har daraja
  // ichida kattaroq to'plam va arzonrog'i oldinda turadi.
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

export function bundleStats(): Record<BundleKind, number> & { total: number } {
  build();
  const out = { total: ordered.length, backdrop: 0, backdrop_model: 0, backdrop_model_symbol: 0 };
  for (const b of ordered) out[b.kind]++;
  return out;
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
    backdrop: b.backdrop,
    model: b.model,
    symbol: b.symbol,
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

/** So'rovdagi `kind` parametrini tekshiradi. */
export function isBundleKind(value: string): value is BundleKind {
  return (KINDS as string[]).includes(value);
}
