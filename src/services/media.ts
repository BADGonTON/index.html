import fs from "node:fs";
import path from "node:path";
import { config } from "../config";

/**
 * Profilga ulash bo'yicha QISQA VIDEO — o'z serverimizdan beriladi.
 *
 * Nega tashqi havola emas: YouTube va boshqa saytlar Telegram Mini App
 * ichidagi <video> da o'ynamaydi (ular o'z pleyerini iframe bilan beradi,
 * uni esa Telegram to'sib qo'yadi). Fayl o'z serverimizda tursa, video
 * ilova ichida, hech qayerga chiqmasdan o'ynaydi va tez ochiladi.
 *
 * Ishlatish: videoni shu papkaga tashlang —
 *
 *     miniapp/media/guide.mp4
 *
 * Boshqa nom kerak bo'lsa `PROFILE_LINK_VIDEO_FILE` ni o'zgartiring.
 * Fayl bo'lmasa, `PROFILE_LINK_VIDEO_URL` (tashqi havola) ishlatiladi;
 * u ham bo'lmasa "Batafsil" tugmasi (YouTube) qoladi.
 */

/** Statik fayllar papkasi — `/app` shu yerdan beriladi. */
export function miniappDir(): string {
  return path.join(__dirname, "..", "..", "miniapp");
}

let resolved: string | null | undefined;

/**
 * Mini App'ga yuboriladigan video manzili.
 *
 * Natija bir marta hisoblanadi: har bir `/api/bootstrap` da diskka
 * murojaat qilish shart emas.
 */
export function guideVideoUrl(): string | null {
  if (resolved !== undefined) return resolved;

  const file = config.profileLinkVideoFile.trim();
  if (file) {
    // Fayl nomi papkadan chiqib ketmasin.
    const safe = path.basename(file);
    const full = path.join(miniappDir(), "media", safe);

    if (fs.existsSync(full)) {
      const size = fs.statSync(full).size;
      console.log(`🎬 Video qo'llanma serverda: /app/media/${safe} (${(size / 1024 / 1024).toFixed(1)} MB)`);
      resolved = `/app/media/${safe}`;
      return resolved;
    }
    console.log(`ℹ️  Video qo'llanma topilmadi: miniapp/media/${safe}`);
  }

  resolved = config.profileLinkVideoUrl.trim() || null;
  return resolved;
}

/** Testlar uchun — keshni tozalaydi. */
export function resetGuideVideoCache(): void {
  resolved = undefined;
}
