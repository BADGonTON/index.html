import { getSetting, setSetting } from "../db/repo/settings";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TEXNIK ISHLAR REJIMI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Admin panelidagi bitta tugma bilan yoqiladi. Yoqilganda oddiy
 * foydalanuvchi botdan hech narsa qila olmaydi — faqat "texnik ishlar
 * bormoqda" degan javob oladi.
 *
 * ADMINLAR uchun bot ODATDAGIDEK ishlayveradi: shu tufayli tuzatishni
 * tekshirib ko'rish, gift qo'shish yoki narxni o'zgartirish mumkin.
 *
 * Nega bazada: bot bir nechta processda ishlashi mumkin va qayta ishga
 * tushirilganda ham rejim saqlanib qolishi kerak. Xotiradagi nusxa esa
 * har bir xabar uchun bazaga bormaslik uchun — rejim kamdan-kam
 * o'zgaradi, shuning uchun bir necha soniyalik kechikish muammo emas.
 */

const KEY = "maintenance";

/** Xotiradagi nusxa qancha vaqt yangi hisoblanadi (ms). */
const CACHE_MS = 5_000;

let enabled = false;
let checkedAt = 0;

/** Ishga tushishda bir marta — keyingi tekshiruvlar keshdan. */
export async function loadMaintenance(): Promise<void> {
  enabled = (await getSetting(KEY, "0")) === "1";
  checkedAt = Date.now();
  if (enabled) {
    console.log("🚧 TEXNIK ISHLAR REJIMI YOQILGAN — oddiy foydalanuvchilar uchun bot yopiq");
  }
}

/**
 * Rejim yoqilganmi.
 *
 * Bir necha soniyada bir marta bazadan tekshiriladi: boshqa processda
 * (yoki boshqa admin tomonidan) o'zgartirilgan bo'lsa ham sezib qoladi.
 */
export async function isMaintenance(): Promise<boolean> {
  if (Date.now() - checkedAt < CACHE_MS) return enabled;

  try {
    enabled = (await getSetting(KEY, "0")) === "1";
    checkedAt = Date.now();
  } catch {
    // Baza javob bermasa oxirgi ma'lum holatda qolamiz — bot to'xtamasin.
  }
  return enabled;
}

/** Keshdan o'qiydi (admin panelida ko'rsatish uchun). */
export function maintenanceCached(): boolean {
  return enabled;
}

/** Rejimni yoqadi/o'chiradi va yangi holatni qaytaradi. */
export async function toggleMaintenance(): Promise<boolean> {
  const next = !(await isMaintenance());
  await setSetting(KEY, next ? "1" : "0");
  enabled = next;
  checkedAt = Date.now();
  console.log(next ? "🚧 Texnik ishlar rejimi YOQILDI" : "✅ Texnik ishlar rejimi O'CHIRILDI");
  return next;
}
