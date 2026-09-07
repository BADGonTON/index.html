import axios from "axios";
import { config } from "../config";

async function toncenterGet<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await axios.get(`${config.toncenterBaseUrl}/${method}`, {
    params,
    headers: config.toncenterApiKey ? { "X-API-Key": config.toncenterApiKey } : {},
    timeout: 20_000,
  });
  if (!res.data?.ok) {
    throw new Error(`Toncenter GET xatosi (${method}): ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

async function toncenterPost<T = any>(method: string, payload: Record<string, unknown>): Promise<T> {
  const res = await axios.post(`${config.toncenterBaseUrl}/${method}`, payload, {
    headers: {
      "Content-Type": "application/json",
      ...(config.toncenterApiKey ? { "X-API-Key": config.toncenterApiKey } : {}),
    },
    timeout: 20_000,
  });
  if (!res.data?.ok) {
    throw new Error(`Toncenter POST xatosi (${method}): ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

export interface WalletInfo {
  balanceNano: bigint;
  balanceTon: number;
  seqno: number;
}

export async function getWalletInformation(address: string): Promise<WalletInfo> {
  const resp = await toncenterGet("getWalletInformation", { address });
  const balanceNano = BigInt(resp.result.balance);
  return {
    balanceNano,
    balanceTon: Number(balanceNano) / 1e9,
    seqno: Number(resp.result.seqno ?? 0),
  };
}

export async function sendBoc(bocBase64: string): Promise<void> {
  await toncenterPost("sendBoc", { boc: bocBase64 });
}
