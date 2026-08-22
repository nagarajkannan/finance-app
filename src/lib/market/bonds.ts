import type { BondInterestType, BondPayout } from "@/lib/debt";
import type { InstrumentOption, InstrumentQuote } from "./types";

const BOND_CENTRAL = "https://api.bondcentral.in";
const BSE_QUOTE =
  "https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

const ISIN = /^IN[A-Z0-9]{10}$/i;
const LIST_TTL_MS = 10 * 60 * 1000;

interface BondCentralRating {
  cra_rating?: string | null;
}

interface BondCentralData {
  isin?: string;
  issuer?: string;
  security_name?: string;
  security_status?: string;
  coupon_rate?: number | string | null;
  interest_type?: string | null;
  frequency?: string | null;
  frequency_description?: string | null;
  face_value?: number | string | null;
  issue_price?: number | string | null;
  maturity_date?: string | null;
  ratings?: BondCentralRating[];
}

interface BondCentralRow {
  isin: string;
  data: BondCentralData;
}

interface SecuritiesResponse {
  data?: BondCentralRow[];
}

export interface BondQuote extends InstrumentQuote {
  kind: "bond";
  issuer: string;
  couponRate: number;
  interestType: BondInterestType;
  frequency: BondPayout;
  faceValue: number;
  issuePrice: number;
  maturityDate: string;
}

const issuerCache = new Map<string, { loadedAt: number; names: string[] }>();

function num(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ymd(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

function isIsin(value: string): boolean {
  return ISIN.test(value.trim());
}

export function mapBondFrequency(
  frequency?: string | null,
  description?: string | null,
  interestType?: string | null,
): BondPayout {
  const text = `${frequency ?? ""} ${description ?? ""} ${interestType ?? ""}`.toLowerCase();
  if (text.includes("zero") || text.includes("cumulative")) return "cumulative";
  if (text.includes("twelve") || text.includes("month")) return "monthly";
  if (text.includes("four") || text.includes("quarter")) return "quarterly";
  if (text.includes("twice") || text.includes("half")) return "half-yearly";
  return "yearly";
}

export function mapBondInterestType(
  interestType?: string | null,
): BondInterestType {
  const text = (interestType ?? "").toLowerCase();
  if (text.includes("zero")) return "zero";
  if (text.includes("float") || text.includes("variable")) return "floating";
  return "fixed";
}

async function getJson<T>(url: string, headers: Record<string, string> = HEADERS): Promise<T> {
  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Bond Central did not answer (${response.status}).`);
  }
  return (await response.json()) as T;
}

async function searchIssuers(query: string): Promise<string[]> {
  const key = query.toLowerCase();
  const cached = issuerCache.get(key);
  if (cached && Date.now() - cached.loadedAt < LIST_TTL_MS) return cached.names;

  const names = await getJson<string[]>(
    `${BOND_CENTRAL}/issuer/search?query=${encodeURIComponent(query)}`,
  );
  const list = Array.isArray(names) ? names.filter(Boolean) : [];
  issuerCache.set(key, { loadedAt: Date.now(), names: list });
  return list;
}

async function fetchSecurities(params: Record<string, string>): Promise<BondCentralRow[]> {
  const search = new URLSearchParams({ page: "1", size: "20", ...params });
  const body = await getJson<SecuritiesResponse>(
    `${BOND_CENTRAL}/securities/?${search.toString()}`,
  );
  return (body.data ?? []).filter((row) => row?.isin && row.data);
}

function toOption(row: BondCentralRow): InstrumentOption {
  const data = row.data;
  const coupon = num(data.coupon_rate);
  const maturity = ymd(data.maturity_date);
  const frequency = mapBondFrequency(
    data.frequency,
    data.frequency_description,
    data.interest_type,
  );
  const parts = [
    row.isin,
    coupon > 0 ? `${coupon}%` : mapBondInterestType(data.interest_type) === "zero" ? "Zero coupon" : "",
    frequency === "cumulative" ? "" : frequency,
    maturity ? `matures ${maturity}` : "",
  ].filter(Boolean);

  return {
    kind: "bond",
    id: row.isin,
    name: data.security_name || data.issuer || row.isin,
    detail: parts.join(" · "),
  };
}

function stillOutstanding(row: BondCentralRow): boolean {
  const status = (row.data.security_status ?? "").toUpperCase();
  if (status && status !== "ACTIVE") return false;
  const maturity = ymd(row.data.maturity_date);
  if (!maturity) return true;
  return maturity >= new Date().toISOString().slice(0, 10);
}

function matchesQuery(row: BondCentralRow, words: string[]): boolean {
  const haystack = [
    row.isin,
    row.data.issuer,
    row.data.security_name,
    row.data.coupon_rate,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/** Search Bond Central by ISIN or issuer name. */
export async function searchBonds(
  query: string,
  limit = 25,
): Promise<InstrumentOption[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (isIsin(trimmed)) {
    const rows = await fetchSecurities({ isin: trimmed.toUpperCase(), size: "5" });
    return rows.map(toOption).slice(0, limit);
  }

  const issuers = await searchIssuers(trimmed);
  if (!issuers.length) return [];

  const batches = await Promise.all(
    issuers.slice(0, 4).map((issuer) => fetchSecurities({ issuer, size: "20" })),
  );
  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const rows: BondCentralRow[] = [];
  for (const row of batches.flat()) {
    if (seen.has(row.isin) || !stillOutstanding(row) || !matchesQuery(row, words)) {
      continue;
    }
    seen.add(row.isin);
    rows.push(row);
  }

  return rows
    .sort((a, b) => ymd(a.data.maturity_date).localeCompare(ymd(b.data.maturity_date)))
    .slice(0, limit)
    .map(toOption);
}

async function bseLastPrice(isin: string): Promise<{ price: number; asOf: string } | null> {
  try {
    const link = await getJson<{ scrip_code?: string | number }>(
      `${BOND_CENTRAL}/generate-bse-url/?isin_number=${encodeURIComponent(isin)}`,
    );
    const scrip = String(link.scrip_code ?? "").trim();
    if (!scrip) return null;

    const quote = await getJson<{
      CurrRate?: { LTP?: string };
      Header?: { LTP?: string; Ason?: string };
    }>(`${BSE_QUOTE}?Debtflag=&scripcode=${encodeURIComponent(scrip)}`, {
      ...HEADERS,
      Referer: "https://www.bseindia.com/",
    });
    const price = num(quote.CurrRate?.LTP ?? quote.Header?.LTP);
    if (!(price > 0)) return null;
    return { price, asOf: new Date().toISOString() };
  } catch {
    return null;
  }
}

function toQuote(row: BondCentralRow, market?: { price: number; asOf: string } | null): BondQuote {
  const data = row.data;
  const issuePrice = num(data.issue_price);
  const faceValue = num(data.face_value);
  return {
    kind: "bond",
    id: row.isin,
    name: data.security_name || data.issuer || row.isin,
    detail: data.issuer ?? "",
    issuer: data.issuer ?? "",
    couponRate: num(data.coupon_rate),
    interestType: mapBondInterestType(data.interest_type),
    frequency: mapBondFrequency(
      data.frequency,
      data.frequency_description,
      data.interest_type,
    ),
    faceValue,
    issuePrice: issuePrice || faceValue,
    maturityDate: ymd(data.maturity_date),
    price: market?.price ?? 0,
    asOf: market?.asOf ?? new Date().toISOString(),
  };
}

/** Bond Central reference data plus today's BSE last traded price when the ISIN is listed. */
export async function bondQuote(isin: string): Promise<BondQuote> {
  const rows = await fetchSecurities({ isin: isin.trim().toUpperCase(), size: "5" });
  const row = rows[0];
  if (!row) {
    throw new Error("Bond Central has no record for that ISIN.");
  }
  return toQuote(row, await bseLastPrice(row.isin));
}
