/**
 * Katalogni HAQIQIY Marketapp javob shakli bilan sinaydi.
 *
 * Namuna javobdan olingan asosiy jihatlar:
 *   • { "cursor": "101", "items": [...] } — kursor yuqori darajada
 *   • javob KOLLEKSIYA BO'YICHA FILTRLANMAGAN — hammasi aralash
 *   • atributlar MASSIV: [{ trait_type: "Model", value: "Lizard" }, ...]
 *   • narx bo'yicha o'sish tartibida saralangan
 */
import http from "node:http";

const COLLECTIONS = [
  ["Pool Floats", "Pool Float"],
  ["Vice Creams", "Vice Cream"],
  ["Chill Flames", "Chill Flame"],
  ["Bling Binkies", "Bling Binky"],   // noto'g'ri ko'plik — alohida tekshiruv
  ["Xmas Stockings", "Xmas Stocking"],
];
const MODELS = ["Lizard", "Palm Beach", "Iceman", "Cherry On Top"];
const BACKDROPS = ["Neon Blue", "Sapphire", "Cyberpunk", "Emerald"];
const SYMBOLS = ["Eagle", "Brain", "Yogi Shaman", "Turtle"];
const TOTAL = 640;
const PAGE = 100;

let requests = 0;
let maxConcurrent = 0;
let inFlight = 0;

function makeGift(i: number) {
  const [, singular] = COLLECTIONS[i % COLLECTIONS.length];
  return {
    nft_address: `EQ${i}${"x".repeat(40)}`,
    nft_name: `${singular} #${10000 + i}`,
    owner: "EQowner",
    attributes: [
      { trait_type: "Model", value: MODELS[i % MODELS.length] },
      { trait_type: "Backdrop", value: BACKDROPS[i % BACKDROPS.length] },
      { trait_type: "Symbol", value: SYMBOLS[i % SYMBOLS.length] },
    ],
    min_duration: 259200,
    max_duration: 15552000,
    price_per_day: String(3399900 + i * 1000),
    discount_per_day: 0,
    listed_at: 1788844256,
  };
}

const server = http.createServer((req, res) => {
  inFlight++;
  maxConcurrent = Math.max(maxConcurrent, inFlight);
  const u = new URL(req.url!, "http://x");
  res.writeHead(200, { "Content-Type": "application/json" });

  if (u.pathname === "/v1/collections/gifts/") {
    inFlight--;
    return res.end(JSON.stringify({
      items: COLLECTIONS.map(([plural], i) => ({ address: `EQCol${i}`, name: plural })),
    }));
  }

  if (u.pathname === "/v1/rent/gifts/") {
    requests++;
    const col = u.searchParams.get("collection_address");
    const offset = parseInt(u.searchParams.get("cursor") ?? "0", 10);

    let pool = Array.from({ length: TOTAL }, (_, i) => makeGift(i));
    if (col) {
      const idx = parseInt(col.replace("EQCol", ""), 10);
      pool = pool.filter((_, i) => i % COLLECTIONS.length === idx);
    }

    const slice = pool.slice(offset, offset + PAGE);
    const next = offset + PAGE < pool.length ? String(offset + PAGE) : null;
    inFlight--;
    return res.end(JSON.stringify({ cursor: next, items: slice }));
  }

  inFlight--;
  res.end("{}");
});

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

async function main() {
  await new Promise<void>((r) => server.listen(19500, r));

  const { runMigrations } = await import("../src/db/migrate");
  const { pool, closePool } = await import("../src/db/pool");
  const pricing = await import("../src/services/pricing");
  const catalog = await import("../src/services/catalog");

  await runMigrations();
  await pricing.loadPricing();
  await pool.query("TRUNCATE market_collections");

  console.log("\n── To'liq aylanish ──");
  await catalog.refreshCatalogNow();

  const stats = catalog.catalogStats();
  console.log(`   Marketapp so'rovlari: ${requests}, parallel: ${maxConcurrent}`);

  ok("hamma gift yuklandi", stats.gifts === TOTAL, `(${stats.gifts}/${TOTAL})`);
  ok("so'rovlar ketma-ket", maxConcurrent === 1, `(${maxConcurrent})`);
  ok("sahifa soni kutilganday", requests <= TOTAL / PAGE + 1, `(${requests} ta so'rov)`);

  const page = catalog.queryGifts({ limit: 100 });
  const first = page.items[0];
  ok("atributlar o'qildi", Boolean(first.model && first.backdrop && first.symbol),
     `model=${first.model} backdrop=${first.backdrop} symbol=${first.symbol}`);

  const cols = catalog.listCatalogCollections();
  ok("kolleksiyalar aniqlandi", cols.length === COLLECTIONS.length, `(${cols.length})`);
  ok("kolleksiya nomlari to'g'ri",
     cols.every((c) => COLLECTIONS.some(([plural]) => plural === c.name)),
     cols.map((c) => c.name).join(", "));

  // "Bling Binky #123" → "Bling Binkies" — noto'g'ri ko'plik ham topilishi kerak
  const binky = catalog.queryGifts({ search: "Bling Binky", limit: 5 }).items[0];
  ok("noto'g'ri ko'plik ham mos keldi", binky?.collection_name === "Bling Binkies",
     binky?.collection_name ?? "topilmadi");

  const sorted = page.items.map((g) => Number(g.price_per_day_nano));
  ok("narx bo'yicha saralangan", sorted.every((v, i) => i === 0 || sorted[i - 1] <= v));

  console.log("\n── Marketapp yiqilganda ──");
  const before = catalog.catalogStats().gifts;
  server.close();
  await catalog.refreshCatalogNow();
  ok("giftlar yo'qolmadi", catalog.catalogStats().gifts === before,
     `(${before} → ${catalog.catalogStats().gifts})`);

  await closePool();
  console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 Katalog testlari o'tdi");
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
