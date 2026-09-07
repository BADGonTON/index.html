import axios, { AxiosInstance } from "axios";
import { config } from "../config";

/**
 * MarketApp API klienti — Fragment (Stars/Premium) va Gift Arenda (rent)
 * endpointlari uchun yagona joy.
 *
 * Muhim tafsilotlar:
 *  - `keepAlive` ulanishlari qayta ishlatiladi (har so'rovda yangi TLS
 *    qo'l berish qilinmaydi — bu sezilarli tezlik beradi).
 *  - Tarmoq/5xx xatolarida qisqa eksponensial kechikish bilan qayta uriniladi.
 *  - Katalogni O'QISH so'rovlari (GET) faqat fon ishchisi tomonidan
 *    chaqiriladi; foydalanuvchi so'rovi hech qachon bu yerni kutmaydi.
 */

let clientRef: AxiosInstance | null = null;

function client(): AxiosInstance {
  if (!clientRef) {
    const http = require("node:http") as typeof import("node:http");
    const https = require("node:https") as typeof import("node:https");
    clientRef = axios.create({
      baseURL: config.marketAppApiBase,
      timeout: 30_000,
      headers: {
        Authorization: config.marketAppApiToken,
        "Content-Type": "application/json",
      },
      httpAgent: new http.Agent({ keepAlive: true, maxSockets: 64 }),
      httpsAgent: new https.Agent({ keepAlive: true, maxSockets: 64 }),
    });
  }
  return clientRef;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function describeError(method: string, path: string, err: any): string {
  const status = err?.response?.status;
  const body = err?.response?.data;
  const short = body ? JSON.stringify(body).slice(0, 400) : err?.message;
  return `${method} ${path}${status ? ` [${status}]` : ""}: ${short}`;
}

/** 5xx va tarmoq xatolarida qayta urinadi; 4xx da darhol xato beradi (mantiqiy xato). */
async function request<T>(
  method: "get" | "post",
  path: string,
  options: { params?: Record<string, unknown>; body?: Record<string, unknown>; retries?: number } = {}
): Promise<T> {
  const retries = options.retries ?? 2;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res =
        method === "get"
          ? await client().get<T>(path, { params: options.params })
          : await client().post<T>(path, options.body ?? {});
      return res.data;
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status;
      const retriable = status === undefined || status >= 500 || status === 429;
      if (!retriable || attempt === retries) break;
      await sleep(400 * 2 ** attempt);
    }
  }
  throw new Error(describeError(method.toUpperCase(), path, lastErr));
}

// ---------------------------------------------------------------------------
//  Fragment: Stars / Premium
// ---------------------------------------------------------------------------

export interface FragmentTxMessage {
  address: string;
  amount: string | number;
  payload?: string;
  stateInit?: string;
}

export interface FragmentTxData {
  transaction?: { messages: FragmentTxMessage[] };
  messages?: FragmentTxMessage[];
}

/** `null` — qabul qiluvchi topilmadi (xato emas, oddiy holat). */
export async function checkStarsRecipient(username: string): Promise<unknown | null> {
  try {
    return await request("post", "/v1/fragment/stars/recipient/", { body: { username }, retries: 1 });
  } catch {
    return null;
  }
}

export async function getStarsPriceTon(quantity: number): Promise<number | null> {
  const res = await request<{ ton?: string }>("post", "/v1/fragment/stars/price/", {
    body: { quantity },
  });
  return res?.ton ? parseFloat(res.ton) : null;
}

export async function getPremiumPrices(): Promise<Record<string, { ton: string }>> {
  return request("post", "/v1/fragment/premium/price/", { body: {} });
}

export async function buyStars(username: string, quantity: number): Promise<FragmentTxData> {
  return request("post", "/v1/fragment/stars/buy/", { body: { username, quantity }, retries: 0 });
}

export async function buyPremium(username: string, months: number): Promise<FragmentTxData> {
  return request("post", "/v1/fragment/premium/buy/", { body: { username, months }, retries: 0 });
}

// ---------------------------------------------------------------------------
//  Gift Arenda (rent)
// ---------------------------------------------------------------------------

export interface RawCollection {
  address: string;
  name?: string;
  [k: string]: unknown;
}

export interface RawRentGift {
  nft_address: string;
  nft_name: string;
  price_per_day: string | number; // nanoTON
  min_duration: number; // soniya
  max_duration: number; // soniya
  [k: string]: unknown;
}

export async function listCollections(): Promise<RawCollection[]> {
  const data = await request<RawCollection[] | { items?: RawCollection[] }>(
    "get",
    "/v1/collections/gifts/"
  );
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function listGiftsForCollection(collectionAddress: string): Promise<RawRentGift[]> {
  const data = await request<{ items?: RawRentGift[] }>("get", "/v1/rent/gifts/", {
    params: { collection_address: collectionAddress },
  });
  return data.items ?? [];
}

export async function payForRent(
  nftAddress: string,
  durationSec: number,
  pricePerDayNano: string
): Promise<FragmentTxData> {
  return request("post", `/v1/rent/${nftAddress}/pay/`, {
    body: { duration: durationSec, price_per_day: String(pricePerDayNano) },
    retries: 0,
  });
}

export async function extendRentApi(
  nftAddress: string,
  extraDurationSec: number,
  pricePerDayNano: string
): Promise<FragmentTxData> {
  return request("post", `/v1/rent/${nftAddress}/extend/`, {
    body: { duration: extraDurationSec, price_per_day: String(pricePerDayNano) },
    retries: 0,
  });
}

export async function tonConnectLink(nftAddress: string, tonconnectUrl: string): Promise<any> {
  return request("post", `/v1/rent/${nftAddress}/tonconnect/`, {
    body: { tonconnect_url: tonconnectUrl },
    retries: 1,
  });
}
