/**
 * WEBHOOK HECH QACHON TIQILIB QOLMASLIGI KERAK.
 *
 * Haqiqiy nosozlik shunday edi: foydalanuvchi botni bloklagan, uning
 * yangilanishini qayta ishlashda `403: bot was blocked by the user`
 * chiqqan, webhook esa Telegram'ga xato javob qaytargan. Telegram
 * javobni "yetkazib bo'lmadi" deb hisoblab, O'SHA yangilanishni har
 * daqiqada qayta yuborgan — navbat tiqilib, shu chatning boshqa
 * xabarlari, hatto /start ham yetib kelmay qolgan.
 *
 * Shu sabab: qayta ishlashda NIMA bo'lishidan qat'i nazar, Telegram
 * doim 200 olishi kerak.
 */
import express from "express";
import type { AddressInfo } from "node:net";
import { GrammyError } from "grammy";
import { unreachableKind, describeTgError } from "../src/services/tgErrors";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? "  " + extra : ""}`);
  if (!cond) fails++;
};

console.log("\n── Webhook javobi ──");

/**
 * `src/web/server.ts` dagi o'ram bilan AYNAN bir xil mantiq.
 * Bu yerda grammY o'rniga ataylab yiqiladigan soxta ishlovchi turadi.
 */
function wrap(handler: (req: express.Request, res: express.Response) => Promise<void>) {
  return (req: express.Request, res: express.Response) => {
    Promise.resolve(handler(req, res)).catch(() => {
      if (!res.headersSent) res.status(200).end();
    });
  };
}

async function main(): Promise<void> {
  const app = express();
  app.use(express.json());

  // 1) Xato bilan yiqiladigan yangilanish
  app.post("/boom", wrap(async () => {
    throw new Error("403: Forbidden: bot was blocked by the user");
  }));

  // 2) Javob YOZILGANDAN KEYIN yiqiladigan yangilanish (fon vazifasi)
  app.post("/late", wrap(async (_req, res) => {
    res.status(200).end();
    throw new Error("keyin yiqildi");
  }));

  // 3) Odatdagi, muvaffaqiyatli yangilanish
  app.post("/fine", wrap(async (_req, res) => {
    res.status(200).end();
  }));

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const port = (server.address() as AddressInfo).port;

  const post = async (path: string): Promise<number> => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ update_id: 1 }),
    });
    return r.status;
  };

  const boom = await post("/boom");
  ok("xato bo'lsa ham Telegram 200 oladi", boom === 200, `${boom}`);

  const late = await post("/late");
  ok("javobdan keyingi xato javobni buzmaydi", late === 200, `${late}`);

  const fine = await post("/fine");
  ok("odatdagi yangilanish ham 200", fine === 200, `${fine}`);

  // Ketma-ket xato kelsa ham server tirik qoladi — Telegram navbati
  // tiqilib qolmaydi.
  const many = await Promise.all([post("/boom"), post("/boom"), post("/fine")]);
  ok("ketma-ket xatodan keyin ham ishlaydi", many.every((s) => s === 200), many.join(","));

  server.close();

  // ── Xato turkumlari ──
  //
  // Broadcast hisoboti ilgari HAR QANDAY xatoni "bloklagan" deb
  // ko'rsatardi. Eski bazadan ko'chirilgan, botga hech qachon yozmagan
  // foydalanuvchi ham shunday sanalardi — bu esa butunlay boshqa holat.
  console.log("\n── Xato turkumlari ──");

  const grammyErr = (code: number, description: string): GrammyError =>
    new GrammyError("Call to 'sendMessage' failed!", { ok: false, error_code: code, description },
                    "sendMessage", {});

  const blocked = grammyErr(403, "Forbidden: bot was blocked by the user");
  const noChat = grammyErr(403, "Forbidden: bot can't initiate conversation with a user");
  const notFound = grammyErr(400, "Bad Request: chat not found");
  const real = grammyErr(400, "Bad Request: message text is empty");

  ok("bloklagan aniqlandi", unreachableKind(blocked) === "blocked");
  ok("yozmagan aniqlandi", unreachableKind(noChat) === "no_chat");
  ok("chat topilmadi — yozmagan", unreachableKind(notFound) === "no_chat");
  ok("haqiqiy xato turkumga tushmaydi", unreachableKind(real) === null);
  ok("oddiy xato ham turkumga tushmaydi", unreachableKind(new Error("nimadir")) === null);

  // Xato matni BIR QATOR bo'lishi kerak: ilgari butun `ctx` bosilib,
  // loglar o'qib bo'lmas holga kelgandi.
  const line = describeTgError(blocked);
  ok("xato bir qatorlik matn", !line.includes("\n") && line.length < 120, line);
  ok("metod nomi ko'rinadi", line.includes("sendMessage"), line);

  console.log(fails ? `\n❌ ${fails} ta test yiqildi` : "\n🎉 Webhook testlari o'tdi");
  process.exit(fails ? 1 : 0);
}

main();
