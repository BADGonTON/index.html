import { mnemonicToWalletKey } from "@ton/crypto";
import {
  Address,
  Cell,
  SendMode,
  beginCell,
  external,
  internal,
  loadStateInit,
  storeMessage,
} from "@ton/core";
import { WalletContractV3R2 } from "@ton/ton";
import { config } from "../config";
import { getWalletInformation, sendBoc, WalletInfo } from "./toncenter";
import { FragmentTxData } from "./marketapp";
import { pool } from "../db/pool";

/**
 * Loyihadagi YAGONA TON hamyoni. Stars, Premium va Gift Arenda to'lovlari
 * hammasi shu hamyondan chiqadi.
 *
 * ENG MUHIM QOIDA: bitta hamyondan bir vaqtda IKKITA tranzaksiya yuborib
 * bo'lmaydi — ikkalasi ham bir xil `seqno` bilan imzolanadi va bittasi
 * yo'qoladi (pul yechilib, xizmat berilmaydi). Shuning uchun har bir
 * yuborish `pg_advisory_lock` bilan himoyalangan: bu qulf butun BAZA
 * darajasida ishlaydi, ya'ni botning nechta processi/serveri bo'lsa ham
 * navbat saqlanadi.
 */
const WALLET_LOCK_ID = 947_112_777;

let cachedKeyPair: { publicKey: Buffer; secretKey: Buffer } | null = null;
let cachedContract: WalletContractV3R2 | null = null;

async function getKeyPair() {
  if (!cachedKeyPair) {
    cachedKeyPair = await mnemonicToWalletKey(config.mnemonic.trim().split(/\s+/));
  }
  return cachedKeyPair;
}

async function getWalletContract(): Promise<WalletContractV3R2> {
  if (!cachedContract) {
    const { publicKey } = await getKeyPair();
    cachedContract = WalletContractV3R2.create({ workchain: 0, publicKey });
  }
  return cachedContract;
}

export async function getWalletAddress(): Promise<string> {
  const contract = await getWalletContract();
  return contract.address.toString({ urlSafe: true, bounceable: true, testOnly: false });
}

export interface WalletState {
  address: string;
  balanceTon: number;
  seqno: number;
}

/** Hamyon holati: balans va seqno. */
export async function getWallet(): Promise<WalletState> {
  const address = await getWalletAddress();
  const info: WalletInfo = await getWalletInformation(address);
  return { address, balanceTon: info.balanceTon, seqno: info.seqno };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * MarketApp qaytargan tranzaksiyani TON tarmog'iga yuboradi va tasdiqlanishini
 * kutadi (seqno oshguncha, maksimum ~60 soniya).
 *
 * Yuborish butun tizim bo'ylab KETMA-KET bajariladi (yuqoridagi qulf).
 */
export async function sendTransaction(txData: FragmentTxData): Promise<void> {
  const messages = txData.transaction?.messages ?? txData.messages;
  if (!messages || messages.length === 0) {
    throw new Error("TX_ERROR: tranzaksiyada messages bo'sh");
  }

  const client = await pool.connect();
  try {
    // Navbat: bu yerda kutish normal holat (boshqa TX yuborilyapti).
    await client.query("SELECT pg_advisory_lock($1)", [WALLET_LOCK_ID]);
    await sendTransactionUnsafe(messages);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [WALLET_LOCK_ID]).catch(() => {});
    client.release();
  }
}

async function sendTransactionUnsafe(messages: NonNullable<FragmentTxData["messages"]>): Promise<void> {
  const msg = messages[0];
  const toAddress = Address.parse(msg.address);
  const amount = BigInt(msg.amount);

  const payloadCell = msg.payload ? decodeBoc(msg.payload) : undefined;
  const stateInitCell = msg.stateInit ? decodeBoc(msg.stateInit) : undefined;
  const stateInit = stateInitCell ? loadStateInit(stateInitCell.beginParse()) : undefined;

  const { secretKey } = await getKeyPair();
  const contract = await getWalletContract();
  const address = await getWalletAddress();

  const before = await getWalletInformation(address);
  const seqnoBefore = before.seqno;

  console.log(`⛓  TX yuborilmoqda → ${msg.address} | ${amount} nanoTON | seqno=${seqnoBefore}`);

  const transferCell = contract.createTransfer({
    seqno: seqnoBefore,
    secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY,
    messages: [
      internal({ to: toAddress, value: amount, bounce: true, init: stateInit, body: payloadCell }),
    ],
  }) as Cell;

  const externalMessage = external({ to: contract.address, body: transferCell });
  const boc = beginCell().store(storeMessage(externalMessage)).endCell().toBoc().toString("base64");

  try {
    await sendBoc(boc);
  } catch (err) {
    // sendBoc "duplicate message" kabi xato berishi mumkin, lekin TX baribir
    // tarmoqqa tushgan bo'lishi mumkin — shu sabab darhol xato bermay,
    // quyida seqno bo'yicha haqiqiy natijani tekshiramiz.
    console.warn("⚠️  sendBoc xatosi (seqno bo'yicha tekshiramiz):", (err as Error).message);
  }

  for (let step = 0; step < 15; step++) {
    await sleep(4000);
    try {
      const after = await getWalletInformation(address);
      if (after.seqno > seqnoBefore) {
        console.log(`✅ TX tasdiqlandi (seqno ${seqnoBefore} → ${after.seqno})`);
        return;
      }
    } catch (err) {
      console.warn(`seqno tekshirishda xato (${step + 1}/15):`, (err as Error).message);
    }
  }

  throw new Error(`TX_EXPIRED: 60s ichida seqno oshmadi (seqno_before=${seqnoBefore})`);
}

/** base64 yoki hex BOC ni Cell ga aylantiradi. */
function decodeBoc(raw: string): Cell {
  const isHex = /^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0;
  const bytes = Buffer.from(raw, isHex ? "hex" : "base64");
  return Cell.fromBoc(bytes)[0];
}
