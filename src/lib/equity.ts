import type { InstrumentKind } from "./market/types";
import type { Asset } from "./types";

/** Equity holdings that are priced from a live NAV or market price. */
export type EquityKind = Exclude<InstrumentKind, "bond">;

export type InvestmentMode = "sip" | "lumpsum";

/**
 * What an equity holding is made of. Funds, shares and ETFs share this shape —
 * `kind` decides whether a unit is a fund unit or a share, and whether the
 * price is a NAV or a last traded price.
 */
export interface EquityDetails {
  kind: EquityKind;
  /** Scheme code for funds, exchange symbol (RELIANCE.NS) for shares and ETFs. */
  instrumentId: string;
  instrumentName: string;
  /** Units or shares held. */
  units: number;
  /** Average purchase NAV / buy price. */
  avgPrice: number;
  investedAmount: number;
  /** Latest NAV or market price, refreshed from the market API. */
  currentPrice: number;
  /** When that price was published. */
  priceUpdatedAt: string;
  /** Funds only: SIP or lump sum, with the SIP details when it is a SIP. */
  mode?: InvestmentMode;
  sipAmount?: number;
  /** Day of the month the SIP is debited. */
  sipDay?: number;
  /** Funds only. */
  folio?: string;
  /** Shares and ETFs only. */
  dividendReceived?: number;
  /** The date of a lump sum purchase, or the date the SIP started. */
  investmentDate?: string;
}

export const EQUITY_KIND_BY_TYPE: Record<string, EquityKind> = {
  "Equity Mutual Fund": "mutual-fund",
  "Direct Stock": "stock",
  "ETF Fund": "etf",
};

export function equityKindForType(
  categoryId: string,
  type: string,
): EquityKind | undefined {
  if (categoryId !== "equity") return undefined;
  return EQUITY_KIND_BY_TYPE[type];
}

interface KindLabels {
  instrumentLabel: string;
  instrumentHint: string;
  unitsLabel: string;
  avgPriceLabel: string;
  currentPriceLabel: string;
  searchPlaceholder: string;
}

export const EQUITY_LABELS: Record<EquityKind, KindLabels> = {
  "mutual-fund": {
    instrumentLabel: "Fund name",
    instrumentHint: "Search every fund published by AMFI",
    unitsLabel: "Units held",
    avgPriceLabel: "Average purchase NAV (₹)",
    currentPriceLabel: "Current NAV (₹)",
    searchPlaceholder: "Example: Parag Parikh Flexi Cap",
  },
  stock: {
    instrumentLabel: "Stock name / NSE symbol",
    instrumentHint: "Search NSE and BSE listings",
    unitsLabel: "Quantity",
    avgPriceLabel: "Average buy price (₹)",
    currentPriceLabel: "Current market price (₹)",
    searchPlaceholder: "Example: RELIANCE",
  },
  etf: {
    instrumentLabel: "ETF name / symbol",
    instrumentHint: "Search NSE and BSE listed ETFs",
    unitsLabel: "Quantity",
    avgPriceLabel: "Average buy price (₹)",
    currentPriceLabel: "Current price (₹)",
    searchPlaceholder: "Example: NIFTYBEES",
  },
};

export interface EquityValuation {
  /** Money put in: what the user typed, or units × average price. */
  invested: number;
  /** Units × today's price, falling back to the invested amount when no price is known. */
  currentValue: number;
  profit: number;
  profitPercent: number;
  /** True when the value shown is the invested amount because no price is known. */
  priceUnavailable: boolean;
  explanation: string[];
}

function round(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function valueEquityAsset(details: EquityDetails): EquityValuation {
  const units = Math.max(details.units || 0, 0);
  const invested = round(
    details.investedAmount > 0 ? details.investedAmount : units * (details.avgPrice || 0),
  );
  const priceUnavailable = !(details.currentPrice > 0);
  const currentValue = round(priceUnavailable ? invested : units * details.currentPrice);
  const profit = round(currentValue - invested);

  const unitWord = details.kind === "mutual-fund" ? "units" : "shares";
  const priceWord = details.kind === "mutual-fund" ? "NAV" : "price";

  return {
    invested,
    currentValue,
    profit,
    profitPercent: invested > 0 ? (profit / invested) * 100 : 0,
    priceUnavailable,
    explanation: priceUnavailable
      ? [
          `No live ${priceWord} yet, so the value shown is the amount you put in.`,
        ]
      : [
          `Value today = ${units} ${unitWord} × ₹${details.currentPrice} (today's ${priceWord}).`,
          `Money put in = ${units} ${unitWord} × ₹${round(details.avgPrice)} (your average ${priceWord}).`,
        ],
  };
}

/** Average buy price implied by the money put in, so the user does not have to work it out. */
export function averagePriceFrom(invested: number, units: number): number {
  if (!(units > 0) || !(invested > 0)) return 0;
  return round(invested / units);
}

/** Rebuilds an equity asset's invested amount and value today from its holding details. */
export function deriveEquityAsset(asset: Asset): Asset {
  if (!asset.equityDetails) return asset;
  const valuation = valueEquityAsset(asset.equityDetails);
  return {
    ...asset,
    investedAmount: valuation.invested,
    currentValue: valuation.currentValue,
  };
}
