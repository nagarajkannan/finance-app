import type { Asset, Goal, Liability } from "@/lib/types";
import type { AssetSource } from "@/lib/groww/types";
import type { DebtDetails } from "@/lib/debt";
import type { EquityDetails } from "@/lib/equity";
import type { GoldDetails } from "@/lib/gold";
import type { AssetCategoryId } from "@/lib/types";
import type {
  Asset as AssetRecord,
  Goal as GoalRecord,
  Liability as LiabilityRecord,
} from "@/generated/prisma/client";

export function normalizeAsset(record: AssetRecord): Asset {
  return {
    id: record.id,
    name: record.name,
    categoryId: record.categoryId as AssetCategoryId,
    type: record.type,
    institution: record.institution,
    investedAmount: Number(record.investedAmount),
    currentValue: Number(record.currentValue),
    startDate: record.startDate,
    notes: record.notes ?? "",
    debtDetails: (record.debtDetails as DebtDetails | null) ?? undefined,
    equityDetails: (record.equityDetails as EquityDetails | null) ?? undefined,
    goldDetails: (record.goldDetails as GoldDetails | null) ?? undefined,
    source: (record.source as AssetSource | null) ?? undefined,
    createdAt: record.createdAt.toISOString(),
  };
}

export function normalizeLiability(record: LiabilityRecord): Liability {
  return {
    id: record.id,
    name: record.name,
    type: record.type as Liability["type"],
    lender: record.lender,
    originalAmount: Number(record.originalAmount),
    outstandingAmount: Number(record.outstandingAmount),
    interestRate: Number(record.interestRate),
    startDate: record.startDate,
    endDate: record.endDate,
    emiAmount: Number(record.emiAmount),
    notes: record.notes ?? "",
    createdAt: record.createdAt.toISOString(),
  };
}

export function normalizeGoal(record: GoalRecord): Goal {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? "",
    targetAmount: Number(record.targetAmount),
    targetDate: record.targetDate,
    linkedAssetIds: Array.isArray(record.linkedAssetIds)
      ? (record.linkedAssetIds as string[])
      : [],
    createdAt: record.createdAt.toISOString(),
  };
}
