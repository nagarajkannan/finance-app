import type { DebtDetails } from "./debt";
import type { EquityDetails } from "./equity";
import type { AssetSource } from "./groww/types";

export type AssetCategoryId =
  | "equity"
  | "debt"
  | "real-estate"
  | "commodities"
  | "cash"
  | "crypto"
  | "alternatives"
  | "other";

export interface AssetCategory {
  id: AssetCategoryId;
  name: string;
  description: string;
  icon: string;
  types: string[];
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  {
    id: "equity",
    name: "Equity",
    description: "Shares and funds that invest in companies",
    icon: "📈",
    types: ["Equity Mutual Fund", "Direct Stock", "ETF Fund"],
  },
  {
    id: "debt",
    name: "Debt",
    description: "Fixed income like deposits and bonds",
    icon: "🏦",
    types: [
      "FD / RD",
      "Bonds",
      "Government Schemes",
      "Insurance",
      "MF / ETF",
      "Other Debt",
    ],
  },
  {
    id: "real-estate",
    name: "Real Estate",
    description: "Land, house or property you own",
    icon: "🏠",
    types: ["Direct Real Estate / Land", "Other Real Estate"],
  },
  {
    id: "commodities",
    name: "Commodities",
    description: "Gold, silver and similar holdings",
    icon: "🪙",
    types: [
      "Physical Gold",
      "Physical Silver",
      "Digital Gold",
      "Digital Silver",
      "ETF / SGB / MF",
    ],
  },
  {
    id: "cash",
    name: "Cash & Savings",
    description: "Money kept in bank or in hand",
    icon: "💵",
    types: ["Savings Account", "Other Cash & Savings"],
  },
  {
    id: "crypto",
    name: "Crypto",
    description: "Digital currencies",
    icon: "🪫",
    types: ["Cryptocurrency"],
  },
  {
    id: "alternatives",
    name: "Alternatives",
    description: "Anything outside the usual options",
    icon: "🧩",
    types: ["Other Alternative Investment"],
  },
  {
    id: "other",
    name: "Other",
    description: "Your own custom asset",
    icon: "📦",
    types: ["Custom Asset"],
  },
];

export function getCategory(id: string): AssetCategory | undefined {
  return ASSET_CATEGORIES.find((c) => c.id === id);
}

export interface Asset {
  id: string;
  name: string;
  categoryId: AssetCategoryId;
  type: string;
  institution: string;
  investedAmount: number;
  currentValue: number;
  startDate: string;
  notes: string;
  /** Set for debt assets: the inputs its value is calculated from. */
  debtDetails?: DebtDetails;
  /** Set for funds, shares and ETFs: the holding its value is calculated from. */
  equityDetails?: EquityDetails;
  /** Set when the asset is synced from a provider such as Groww. */
  source?: AssetSource;
  createdAt: string;
}

export const LIABILITY_TYPES = [
  "Home Loan",
  "Vehicle Loan",
  "Personal Loan",
  "Education Loan",
  "Credit Card",
  "Gold Loan",
  "Business Loan",
  "Friends / Family",
  "Other",
] as const;

export type LiabilityType = (typeof LIABILITY_TYPES)[number];

export interface Liability {
  id: string;
  name: string;
  type: LiabilityType;
  lender: string;
  originalAmount: number;
  outstandingAmount: number;
  interestRate: number;
  startDate: string;
  endDate: string;
  emiAmount: number;
  notes: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  description: string;
  targetAmount: number;
  targetDate: string;
  /** Individual assets linked to this goal (specific holdings, not whole categories). */
  linkedAssetIds: string[];
  createdAt: string;
}
