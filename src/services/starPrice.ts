import { getSetting, setSetting } from "../db/repo/settings";

let cachedPrice = 240;

export async function loadStarPrice(): Promise<void> {
  const price = await getSetting("star_price");
  if (price) cachedPrice = parseInt(price, 10);
}

export function getStarPrice(): number {
  return cachedPrice;
}

export async function setStarPrice(newPrice: number): Promise<void> {
  cachedPrice = newPrice;
  await setSetting("star_price", newPrice);
}
