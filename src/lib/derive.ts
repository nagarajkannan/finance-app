import { deriveAsset as deriveDebtAsset } from "./debt";
import { deriveEquityAsset } from "./equity";
import { valueGoldAsset } from "./gold";
import type { Asset } from "./types";

/** Recalculates the assets whose value comes from their own details rather than a typed in number. */
export function deriveAsset(asset: Asset): Asset {
  if (asset.equityDetails) return deriveEquityAsset(asset);
  if (asset.goldDetails) {
    const valuation = valueGoldAsset(asset.goldDetails);
    return {
      ...asset,
      investedAmount: valuation.invested,
      currentValue: valuation.currentValue,
      startDate: asset.goldDetails.purchaseDate || asset.startDate,
    };
  }
  return deriveDebtAsset(asset);
}
