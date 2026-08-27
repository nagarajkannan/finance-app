import { deriveAsset } from "@/lib/derive";
import { averagePriceFrom } from "@/lib/equity";
import { valueGoldAsset } from "@/lib/gold";
import type {
  AllocationMode,
  Asset,
  CashFlowType,
} from "@/lib/types";

export const expenseCategories = [
  "Housing",
  "Food & groceries",
  "Transport",
  "Utilities",
  "Healthcare",
  "Education",
  "Family",
  "Lifestyle",
  "Shopping",
  "Travel",
  "Insurance",
  "Taxes",
  "Other",
] as const;

export interface AssetInvestmentResult {
  asset: Asset;
  quantityAdded?: number;
  quantityUnit?: string;
  pricePerUnit?: number;
  calculation: string;
}

export interface CashFlowTransactionInput {
  month: string;
  date: string;
  type: CashFlowType;
  category: string;
  description: string;
  allocationMode: AllocationMode;
  allocationValue: number;
  targetId?: string;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function positivePrice(...prices: Array<number | undefined>) {
  return prices.find((price) => typeof price === "number" && price > 0);
}

export function calculateAllocationAmount(
  income: number,
  mode: AllocationMode,
  value: number,
) {
  if (!(income > 0) || !(value > 0)) return 0;
  return round(mode === "percentage" ? (income * value) / 100 : value);
}

export function isMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function applyAssetInvestment(
  source: Asset,
  amount: number,
  livePrice?: number,
): AssetInvestmentResult {
  const asset = deriveAsset(source);

  if (asset.equityDetails) {
    const details = asset.equityDetails;
    const price = positivePrice(livePrice, details.currentPrice);
    if (!price) {
      throw new Error("Refresh the asset's market price before investing.");
    }

    const quantityAdded = amount / price;
    const units = details.units + quantityAdded;
    const investedAmount = details.investedAmount + amount;
    const updated = deriveAsset({
      ...asset,
      equityDetails: {
        ...details,
        units,
        investedAmount,
        avgPrice: averagePriceFrom(investedAmount, units),
        currentPrice: price,
        priceUpdatedAt: new Date().toISOString(),
      },
    });

    return {
      asset: updated,
      quantityAdded: round(quantityAdded, 6),
      quantityUnit: details.kind === "mutual-fund" ? "units" : "shares",
      pricePerUnit: round(price, 4),
      calculation: `${round(quantityAdded, 6)} ${details.kind === "mutual-fund" ? "units" : "shares"} added at ₹${round(price, 4)} each.`,
    };
  }

  if (asset.goldDetails) {
    const details = asset.goldDetails;
    const price = positivePrice(livePrice, details.pricePerGram);
    if (!price) {
      throw new Error("Refresh the gold price before investing.");
    }

    const quantityAdded = amount / price;
    const goldDetails = {
      ...details,
      weightGrams: details.weightGrams + quantityAdded,
      amountPaid: details.amountPaid + amount,
      pricePerGram: price,
      priceUpdatedAt: new Date().toISOString(),
    };
    const valuation = valueGoldAsset(goldDetails);

    return {
      asset: {
        ...asset,
        goldDetails,
        investedAmount: valuation.invested,
        currentValue: valuation.currentValue,
      },
      quantityAdded: round(quantityAdded, 6),
      quantityUnit: "grams",
      pricePerUnit: round(price, 4),
      calculation: `${round(quantityAdded, 6)} grams added at ₹${round(price, 4)} per gram.`,
    };
  }

  const details = asset.debtDetails;
  if (details?.kind === "fd") {
    const updated = deriveAsset({
      ...asset,
      debtDetails: {
        ...details,
        principal: details.principal + amount,
      },
    });
    return {
      asset: updated,
      calculation: `₹${round(amount)} added to the fixed-deposit principal.`,
    };
  }

  if (details?.kind === "bond") {
    const price = positivePrice(
      livePrice,
      details.currentPrice,
      details.buyPrice,
      details.faceValue,
    );
    if (!price) {
      throw new Error("Refresh the bond price before investing.");
    }

    const quantityAdded = amount / price;
    const quantity = details.quantity + quantityAdded;
    const investedAmount =
      (details.investedAmount ?? details.quantity * details.buyPrice) + amount;
    const updated = deriveAsset({
      ...asset,
      debtDetails: {
        ...details,
        quantity,
        investedAmount,
        buyPrice: investedAmount / quantity,
        currentPrice: price,
        priceUpdatedAt: new Date().toISOString(),
      },
    });
    return {
      asset: updated,
      quantityAdded: round(quantityAdded, 6),
      quantityUnit: "bonds",
      pricePerUnit: round(price, 4),
      calculation: `${round(quantityAdded, 6)} bonds added at ₹${round(price, 4)} each.`,
    };
  }

  if (details?.kind === "debt-mf") {
    const price = positivePrice(livePrice, details.currentNav, details.buyNav);
    if (!price) {
      throw new Error("Refresh the fund NAV before investing.");
    }

    const quantityAdded = amount / price;
    const units = details.units + quantityAdded;
    const investedAmount = details.units * details.buyNav + amount;
    const updated = deriveAsset({
      ...asset,
      debtDetails: {
        ...details,
        units,
        buyNav: investedAmount / units,
        currentNav: price,
      },
    });
    return {
      asset: updated,
      quantityAdded: round(quantityAdded, 6),
      quantityUnit: "units",
      pricePerUnit: round(price, 4),
      calculation: `${round(quantityAdded, 6)} units added at a NAV of ₹${round(price, 4)}.`,
    };
  }

  if (
    details?.kind === "govt-scheme" &&
    details.contributionType === "lumpsum"
  ) {
    const updated = deriveAsset({
      ...asset,
      debtDetails: {
        ...details,
        amount: details.amount + amount,
      },
    });
    return {
      asset: updated,
      calculation: `₹${round(amount)} added to the scheme principal.`,
    };
  }

  if (details?.kind === "other-debt") {
    const updated = deriveAsset({
      ...asset,
      debtDetails: {
        ...details,
        principal: details.principal + amount,
      },
    });
    return {
      asset: updated,
      calculation: `₹${round(amount)} added to the asset principal.`,
    };
  }

  if (
    details?.kind === "rd" ||
    details?.kind === "insurance" ||
    (details?.kind === "govt-scheme" &&
      details.contributionType === "yearly")
  ) {
    return {
      asset,
      calculation:
        "Payment tracked without changing the asset because its value already follows its recurring contribution schedule.",
    };
  }

  return {
    asset: {
      ...asset,
      investedAmount: round(asset.investedAmount + amount),
      currentValue: round(asset.currentValue + amount),
    },
    calculation: `₹${round(amount)} added to the asset value.`,
  };
}
