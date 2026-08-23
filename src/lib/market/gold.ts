import type { GoldPurity } from "@/lib/gold";

const CHENNAI_URL = "https://www.goodreturns.in/gold-rates/chennai.html";
const INDIA_URL = "https://www.goodreturns.in/gold-rates/";
const CACHE_TTL_MS = 30 * 60 * 1000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

const KARAT: Record<GoldPurity, number> = {
  "24K": 24,
  "22K": 22,
  "21K": 21,
  "20K": 20,
  "18K": 18,
  "16K": 16,
  "14K": 14,
  "10K": 10,
};

interface IndiaGoldRates {
  "24K": number;
  "22K": number;
  "18K": number;
  market: string;
  asOf: string;
}

export interface GoldQuote {
  purity: GoldPurity;
  pricePerGram: number;
  asOf: string;
  /** City or national board the rupee rate came from. */
  market: string;
}

let cache: { loadedAt: number; rates: IndiaGoldRates } | null = null;
let loading: Promise<IndiaGoldRates> | null = null;

function rupees(value: string): number {
  return Number(value.replace(/,/g, ""));
}

/**
 * Goodreturns publishes today's 24K / 22K / 18K jewellery rate per gram
 * in the intro sentence on the Chennai and India pages.
 */
function parseBoardRates(html: string, market: string): IndiaGoldRates | null {
  const match = html.match(
    /Today's gold price in (?:Chennai|India) stands at <strong>(?:&#x20b9;|&#8377;|₹)([0-9,]+)<\/strong> per gram for 24 karat gold[\s\S]*? <strong>(?:&#x20b9;|&#8377;|₹)([0-9,]+)<\/strong> per gram for 22 karat gold[\s\S]*? <strong>(?:&#x20b9;|&#8377;|₹)([0-9,]+)<\/strong> per gram for 18 karat gold/i,
  );
  if (!match) return null;
  const price24 = rupees(match[1]);
  const price22 = rupees(match[2]);
  const price18 = rupees(match[3]);
  if (!(price24 > 0 && price22 > 0 && price18 > 0)) return null;
  return {
    "24K": price24,
    "22K": price22,
    "18K": price18,
    market,
    asOf: new Date().toISOString(),
  };
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`The India gold rate page could not be loaded (${response.status}).`);
  }
  return response.text();
}

async function fetchIndiaRates(): Promise<IndiaGoldRates> {
  try {
    const chennai = parseBoardRates(await fetchPage(CHENNAI_URL), "Chennai, Tamil Nadu");
    if (chennai) return chennai;
  } catch {
    // Fall through to the national page.
  }
  const india = parseBoardRates(await fetchPage(INDIA_URL), "India");
  if (!india) {
    throw new Error("Today's India gold rate could not be read.");
  }
  return india;
}

async function indiaRates(): Promise<IndiaGoldRates> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.rates;
  loading ??= fetchIndiaRates()
    .then((rates) => {
      cache = { loadedAt: Date.now(), rates };
      return rates;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

function priceFor(rates: IndiaGoldRates, purity: GoldPurity): number {
  if (purity === "24K" || purity === "22K" || purity === "18K") {
    return rates[purity];
  }
  return Math.round(((rates["24K"] * KARAT[purity]) / 24) * 100) / 100;
}

/** Tamil Nadu (Chennai) jewellery board rate per gram; India-wide if Chennai is down. */
export async function goldQuote(purity: GoldPurity): Promise<GoldQuote> {
  const rates = await indiaRates();
  const pricePerGram = priceFor(rates, purity);
  if (!(pricePerGram > 0)) {
    throw new Error(`No ${purity} India gold rate came back.`);
  }
  return {
    purity,
    pricePerGram,
    asOf: rates.asOf,
    market: rates.market,
  };
}
