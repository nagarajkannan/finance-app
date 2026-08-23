import { goalProgress, totalOutstanding, totalsForAssets } from "./calculations";
import { ASSET_CATEGORIES } from "./types";
import type { Asset, Goal, Liability } from "./types";

/** One category line inside a snapshot: how much sat in it at that moment. */
export interface SnapshotCategory {
  id: string;
  label: string;
  value: number;
  invested: number;
  count: number;
}

export interface SnapshotGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  progressPercent: number;
}

export type SnapshotSource = "manual" | "scheduled";

/** The numbers frozen at one point in time — never recalculated afterwards. */
export interface SnapshotValues {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  totalInvested: number;
  assetCategories: SnapshotCategory[];
  liabilityCategories: SnapshotCategory[];
  goals: SnapshotGoal[];
}

export interface Snapshot extends SnapshotValues {
  id: string;
  capturedAt: string;
  name: string;
  source: SnapshotSource;
  createdAt: string;
}

/**
 * Reads the existing assets, liabilities and goals and freezes their totals.
 * Nothing here writes back to those records — a snapshot is a copy, not a source.
 */
export function buildSnapshotValues(
  assets: Asset[],
  liabilities: Liability[],
  goals: Goal[],
): SnapshotValues {
  const totals = totalsForAssets(assets);
  const totalLiabilities = totalOutstanding(liabilities);

  const assetCategories = ASSET_CATEGORIES.map((category) => {
    const inCategory = assets.filter((a) => a.categoryId === category.id);
    return {
      id: category.id,
      label: category.name,
      value: inCategory.reduce((sum, a) => sum + a.currentValue, 0),
      invested: inCategory.reduce((sum, a) => sum + a.investedAmount, 0),
      count: inCategory.length,
    };
  }).filter((category) => category.count > 0);

  const byType = new Map<string, Liability[]>();
  for (const liability of liabilities) {
    byType.set(liability.type, [...(byType.get(liability.type) ?? []), liability]);
  }
  const liabilityCategories = [...byType.entries()].map(([type, rows]) => ({
    id: type,
    label: type,
    value: rows.reduce((sum, l) => sum + l.outstandingAmount, 0),
    invested: rows.reduce((sum, l) => sum + l.originalAmount, 0),
    count: rows.length,
  }));

  return {
    totalAssets: totals.current,
    totalLiabilities,
    netWorth: totals.current - totalLiabilities,
    totalInvested: totals.invested,
    assetCategories,
    liabilityCategories,
    goals: goals.map((goal) => {
      const progress = goalProgress(goal, assets);
      return {
        id: goal.id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        currentAmount: progress.currentAmount,
        progressPercent: progress.progressPercent,
      };
    }),
  };
}

export const SNAPSHOT_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom",
] as const;

export type SnapshotFrequency = (typeof SNAPSHOT_FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<SnapshotFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  custom: "Custom",
};

export interface SnapshotSchedule {
  enabled: boolean;
  frequency: SnapshotFrequency;
  /** Local time of day, "HH:MM". */
  timeOfDay: string;
  /** Days between snapshots; only the custom frequency uses it. */
  intervalDays: number;
  /** "YYYY-MM-DD", empty means "start today". */
  startDate: string;
  /** "YYYY-MM-DD", empty means "never end". */
  endDate: string;
  lastRunAt?: string;
  /** Derived, never stored: when the next automatic snapshot is due. */
  nextRunAt?: string;
}

export function isSnapshotFrequency(value: unknown): value is SnapshotFrequency {
  return (
    typeof value === "string" &&
    (SNAPSHOT_FREQUENCIES as readonly string[]).includes(value)
  );
}
