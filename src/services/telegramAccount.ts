import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { config } from "../config";

/**
 * Bu fayl nom.py (Telethon) dagi vazifani JS'da bajaradi:
 *  - Yangi akkaunt qo'shishda: kodni yuborish, kod bilan kirish, 2FA bilan kirish.
 *  - Sotilgandan keyin: akkauntning 777000 (Telegram xizmat xabarlari) dan kelgan
 *    oxirgi login kodini o'qish.
 *
 * DIQQAT: har bir "login jarayoni" davomida ochiq turgan TelegramClient obyekti
 * xotirada (Map) saqlanadi, chunki uni sessiyaga (JSON/DB) yozib bo'lmaydi.
 * Shu sabab admin bitta vaqtda faqat bitta akkaunt qo'sha oladi — bu amaliyotda
 * yetarli, chunki qo'shish jarayoni bir necha soniya davom etadi.
 */

export interface PendingLogin {
  client: TelegramClient;
  phone: string;
  phoneCodeHash: string;
  twoFa: string | null;
  price: number;
}

const pendingLogins = new Map<number, PendingLogin>();

export function getPendingLogin(adminId: number): PendingLogin | undefined {
  return pendingLogins.get(adminId);
}

export function clearPendingLogin(adminId: number): void {
  const p = pendingLogins.get(adminId);
  if (p) {
    p.client.disconnect().catch(() => {});
  }
  pendingLogins.delete(adminId);
}

function assertConfigured(): void {
  if (!config.tgApiId || !config.tgApiHash) {
    throw new Error(
      "TG_API_ID / TG_API_HASH sozlanmagan. .env fayliga my.telegram.org dan olingan qiymatlarni qo'shing."
    );
  }
}

/** Berilgan raqamga login kodini yuboradi va login jarayonini boshlaydi. */
export async function startPhoneLogin(
  adminId: number,
  phone: string,
  twoFa: string | null,
  price: number
): Promise<void> {
  assertConfigured();
  const client = new TelegramClient(new StringSession(""), config.tgApiId, config.tgApiHash, {
    connectionRetries: 3,
  });
  await client.connect();

  try {
    const { phoneCodeHash } = await client.sendCode({ apiId: config.tgApiId, apiHash: config.tgApiHash }, phone);
    pendingLogins.set(adminId, { client, phone, phoneCodeHash, twoFa, price });
  } catch (err) {
    await client.disconnect().catch(() => {});
    throw err;
  }
}

export interface FinishLoginResult {
  sessionString: string;
}

/** Foydalanuvchi yuborgan kod (va agar kerak bo'lsa 2FA) bilan kirishni yakunlaydi. */
export async function finishPhoneLogin(adminId: number, code: string): Promise<FinishLoginResult> {
  const pending = pendingLogins.get(adminId);
  if (!pending) {
    throw new Error("Login seansi topilmadi. Qaytadan /admin dan boshlang.");
  }
  const { client, phone, phoneCodeHash, twoFa } = pending;

  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash,
        phoneCode: code,
      })
    );
  } catch (err: any) {
    if (err?.errorMessage === "SESSION_PASSWORD_NEEDED") {
      if (!twoFa) {
        throw new Error("Akkauntda 2FA parol bor ekan, lekin siz '-' deb kiritgan edingiz.");
      }
      await client.signInWithPassword(
        { apiId: config.tgApiId, apiHash: config.tgApiHash },
        {
          password: async () => twoFa,
          onError: async (e) => {
            throw e;
          },
        }
      );
    } else {
      throw err;
    }
  }

  const sessionString = client.session.save() as unknown as string;
  await client.disconnect().catch(() => {});
  pendingLogins.delete(adminId);
  return { sessionString };
}

/**
 * Sotilgan akkauntning StringSession'i orqali ulanib, 777000 (Telegram) dan
 * kelgan oxirgi xabardan 5 xonali login kodini o'qiydi. Topilmasa null qaytaradi.
 */
export async function getLoginCode(sessionString: string): Promise<string | null> {
  assertConfigured();
  const client = new TelegramClient(new StringSession(sessionString), config.tgApiId, config.tgApiHash, {
    connectionRetries: 2,
  });
  try {
    await client.connect();
    const authorized = await client.checkAuthorization();
    if (!authorized) return null;

    const messages = await client.getMessages(777000, { limit: 1 });
    if (messages.length > 0) {
      const text = messages[0].message ?? "";
      const match = text.match(/\b(\d{5})\b/);
      if (match) return match[1];
    }
    return null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Login kod o'qishda xato:", (err as Error).message);
    return null;
  } finally {
    await client.disconnect().catch(() => {});
  }
}
