export type GoldPurity =
  | "24K"
  | "22K"
  | "21K"
  | "20K"
  | "18K"
  | "16K"
  | "14K"
  | "10K";

export const GOLD_PURITY_OPTIONS: { value: GoldPurity; label: string }[] = [
  { value: "24K", label: "24K" },
  { value: "22K", label: "22K" },
  { value: "21K", label: "21K" },
  { value: "20K", label: "20K" },
  { value: "18K", label: "18K" },
  { value: "16K", label: "16K" },
  { value: "14K", label: "14K" },
  { value: "10K", label: "10K" },
];

/** One purchase lot of physical gold. Later lots are separate assets. */
export interface GoldDetails {
  purity: GoldPurity;
  weightGrams: number;
  purchaseDate: string;
  /** Total you paid, including making charges and GST if they were in the bill. */
  amountPaid: number;
  makingCharges?: number;
  gst?: number;
  /** Live metal price per gram for this purity, from goldprice.dev. */
  pricePerGram: number;
  priceUpdatedAt: string;
}

export interface GoldValuation {
  invested: number;
  currentValue: number;
  profit: number;
  returnPercent: number;
  priceUnavailable: boolean;
  explanation: string[];
}

export function isPhysicalGold(categoryId: string, type: string): boolean {
  return categoryId === "commodities" && type === "Physical Gold";
}

function round(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function goldLotName(details: GoldDetails, notes?: string): string {
  const note = notes?.trim();
  if (note) return note;
  const weight = details.weightGrams > 0 ? `${details.weightGrams} g` : "";
  return [details.purity, "physical gold", weight].filter(Boolean).join(" · ");
}

export function valueGoldAsset(details: GoldDetails): GoldValuation {
  const invested = round(Math.max(details.amountPaid, 0));
  const priceUnavailable = !(details.pricePerGram > 0);
  const currentValue = round(
    priceUnavailable ? invested : details.weightGrams * details.pricePerGram,
  );
  const profit = round(currentValue - invested);

  return {
    invested,
    currentValue,
    profit,
    returnPercent: invested > 0 ? (profit / invested) * 100 : 0,
    priceUnavailable,
    explanation: priceUnavailable
      ? [
          "No live metal price yet, so the value shown is what you paid.",
        ]
      : [
          `Metal value = ${details.weightGrams} g × ₹${details.pricePerGram} (${details.purity} Chennai / India jewellery rate).`,
          "This is the board rate for the metal, not a jeweller buyback. GST and making charges are extra.",
        ],
  };
}
