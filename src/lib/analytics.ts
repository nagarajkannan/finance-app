import { formatCompact, formatCurrency } from "./format";
import type { Snapshot, SnapshotCategory } from "./snapshots";

export const RANGES = ["1M", "3M", "6M", "1Y", "ALL"] as const;

export type RangeId = (typeof RANGES)[number];

export const RANGE_LABELS: Record<RangeId, string> = {
  "1M": "1M",
  "3M": "3M",
  "6M": "6M",
  "1Y": "1Y",
  ALL: "All",
};

const RANGE_DAYS: Record<Exclude<RangeId, "ALL">, number> = {
  "1M": 30,
  "3M": 91,
  "6M": 183,
  "1Y": 365,
};

/** Oldest first — every calculation below assumes that order. */
export function sortByDate(snapshots: Snapshot[]): Snapshot[] {
  return [...snapshots].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  );
}

export function withinRange(
  snapshots: Snapshot[],
  range: RangeId,
  now = new Date(),
): Snapshot[] {
  const sorted = sortByDate(snapshots);
  if (range === "ALL") return sorted;

  const cutoff = now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  return sorted.filter((s) => new Date(s.capturedAt).getTime() >= cutoff);
}

export interface TrendPoint {
  id: string;
  capturedAt: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

export function trendPoints(snapshots: Snapshot[]): TrendPoint[] {
  return sortByDate(snapshots).map((snapshot) => ({
    id: snapshot.id,
    capturedAt: snapshot.capturedAt,
    netWorth: snapshot.netWorth,
    assets: snapshot.totalAssets,
    liabilities: snapshot.totalLiabilities,
  }));
}

export interface Change {
  before: number;
  after: number;
  change: number;
  changePercent: number;
}

export function changeBetween(before: number, after: number): Change {
  return {
    before,
    after,
    change: after - before,
    changePercent: before !== 0 ? ((after - before) / Math.abs(before)) * 100 : 0,
  };
}

export interface GrowthSummary {
  first: Snapshot;
  last: Snapshot;
  /** Movement across the snapshots handed in (the selected period). */
  period: Change;
  /** Movement from the snapshot right before the latest one. */
  sincePrevious: Change | null;
  assets: Change;
  liabilities: Change;
  days: number;
}

export function growthSummary(snapshots: Snapshot[]): GrowthSummary | null {
  const sorted = sortByDate(snapshots);
  if (sorted.length === 0) return null;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  return {
    first,
    last,
    period: changeBetween(first.netWorth, last.netWorth),
    sincePrevious: previous
      ? changeBetween(previous.netWorth, last.netWorth)
      : null,
    assets: changeBetween(first.totalAssets, last.totalAssets),
    liabilities: changeBetween(first.totalLiabilities, last.totalLiabilities),
    days: Math.round(
      (new Date(last.capturedAt).getTime() - new Date(first.capturedAt).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  };
}

export interface CategoryTrend extends Change {
  id: string;
  label: string;
  /** Share of the total this category held, then and now. */
  sharePercentBefore: number;
  sharePercentAfter: number;
}

function shareOf(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

export function categoryTrends(
  before: SnapshotCategory[],
  after: SnapshotCategory[],
): CategoryTrend[] {
  const beforeTotal = before.reduce((sum, c) => sum + c.value, 0);
  const afterTotal = after.reduce((sum, c) => sum + c.value, 0);
  const ids = [...new Set([...before, ...after].map((c) => c.id))];

  return ids
    .map((id) => {
      const from = before.find((c) => c.id === id);
      const to = after.find((c) => c.id === id);
      const fromValue = from?.value ?? 0;
      const toValue = to?.value ?? 0;
      return {
        id,
        label: to?.label ?? from?.label ?? id,
        ...changeBetween(fromValue, toValue),
        sharePercentBefore: shareOf(fromValue, beforeTotal),
        sharePercentAfter: shareOf(toValue, afterTotal),
      };
    })
    .sort((a, b) => b.after - a.after);
}

export interface SnapshotComparison {
  before: Snapshot;
  after: Snapshot;
  assets: Change;
  liabilities: Change;
  netWorth: Change;
  assetCategories: CategoryTrend[];
  liabilityCategories: CategoryTrend[];
  goals: {
    id: string;
    name: string;
    beforePercent: number;
    afterPercent: number;
    changePercent: number;
  }[];
}

export function compareSnapshots(
  a: Snapshot,
  b: Snapshot,
): SnapshotComparison {
  const [before, after] =
    new Date(a.capturedAt).getTime() <= new Date(b.capturedAt).getTime()
      ? [a, b]
      : [b, a];

  const goalIds = [
    ...new Set([...before.goals, ...after.goals].map((goal) => goal.id)),
  ];

  return {
    before,
    after,
    assets: changeBetween(before.totalAssets, after.totalAssets),
    liabilities: changeBetween(before.totalLiabilities, after.totalLiabilities),
    netWorth: changeBetween(before.netWorth, after.netWorth),
    assetCategories: categoryTrends(before.assetCategories, after.assetCategories),
    liabilityCategories: categoryTrends(
      before.liabilityCategories,
      after.liabilityCategories,
    ),
    goals: goalIds.map((id) => {
      const from = before.goals.find((goal) => goal.id === id);
      const to = after.goals.find((goal) => goal.id === id);
      const beforePercent = from?.progressPercent ?? 0;
      const afterPercent = to?.progressPercent ?? 0;
      return {
        id,
        name: to?.name ?? from?.name ?? "Goal",
        beforePercent,
        afterPercent,
        changePercent: afterPercent - beforePercent,
      };
    }),
  };
}

export interface Insight {
  id: string;
  icon: string;
  text: string;
  tone: "positive" | "negative" | "neutral";
}

const LAKH = 1_00_000;

/** The round number the value has just gone past, if it crossed one. */
function crossedMilestone(before: number, after: number): number | null {
  if (after <= before) return null;
  const step = after >= 1_00_00_000 ? 1_00_00_000 : 10 * LAKH;
  const milestone = Math.floor(after / step) * step;
  return milestone > before && milestone > 0 ? milestone : null;
}

function monthsBetween(from: string, to: string): number {
  const days =
    (new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000);
  return days / 30.44;
}

function periodLabel(from: string, to: string): string {
  const months = monthsBetween(from, to);
  if (months < 1.5) {
    const days = Math.max(
      1,
      Math.round(
        (new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000),
      ),
    );
    return `the last ${days} ${days === 1 ? "day" : "days"}`;
  }
  if (months < 11.5) return `the last ${Math.round(months)} months`;
  const years = Math.round(months / 12);
  return `the last ${years} ${years === 1 ? "year" : "years"}`;
}

/**
 * Plain readings of what the snapshots show. Nothing here explains *why* a
 * number moved — only what moved, by how much, and over what period.
 */
export function financialInsights(snapshots: Snapshot[]): Insight[] {
  const sorted = sortByDate(snapshots);
  if (sorted.length < 2) return [];

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const period = periodLabel(first.capturedAt, last.capturedAt);
  const insights: Insight[] = [];

  const netWorth = changeBetween(first.netWorth, last.netWorth);
  if (netWorth.change !== 0) {
    insights.push({
      id: "net-worth",
      icon: netWorth.change > 0 ? "📈" : "📉",
      tone: netWorth.change > 0 ? "positive" : "negative",
      text: `Your net worth ${netWorth.change > 0 ? "increased" : "decreased"} by ${formatCompact(
        Math.abs(netWorth.change),
      )} in ${period}.`,
    });
  }

  const liabilities = changeBetween(first.totalLiabilities, last.totalLiabilities);
  if (liabilities.change !== 0) {
    insights.push({
      id: "liabilities",
      icon: liabilities.change < 0 ? "✅" : "⚠️",
      tone: liabilities.change < 0 ? "positive" : "negative",
      text: `Your liabilities ${liabilities.change < 0 ? "reduced" : "increased"} by ${formatCurrency(
        Math.abs(liabilities.change),
      )}.`,
    });
  }

  const assetMilestone = crossedMilestone(first.totalAssets, last.totalAssets);
  if (assetMilestone) {
    insights.push({
      id: "assets-milestone",
      icon: "🏆",
      tone: "positive",
      text: `Your assets crossed ${formatCompact(assetMilestone)}.`,
    });
  }

  for (const category of categoryTrends(first.assetCategories, last.assetCategories)) {
    const shareMove = category.sharePercentAfter - category.sharePercentBefore;
    if (Math.abs(shareMove) < 3) continue;
    insights.push({
      id: `allocation-${category.id}`,
      icon: "🧩",
      tone: "neutral",
      text: `Your ${category.label.toLowerCase()} allocation ${
        shareMove > 0 ? "increased" : "decreased"
      } from ${category.sharePercentBefore.toFixed(0)}% to ${category.sharePercentAfter.toFixed(0)}%.`,
    });
  }

  for (const goal of last.goals) {
    const from = first.goals.find((g) => g.id === goal.id);
    if (!from) continue;
    const move = goal.progressPercent - from.progressPercent;
    if (Math.abs(move) < 1) continue;
    insights.push({
      id: `goal-${goal.id}`,
      icon: "🎯",
      tone: move > 0 ? "positive" : "negative",
      text: `Your "${goal.name}" progress ${move > 0 ? "increased" : "decreased"} by ${Math.abs(
        move,
      ).toFixed(0)}%.`,
    });
  }

  return insights;
}

/** Categories that moved the most between the two snapshots. */
export function biggestMovers(
  trends: CategoryTrend[],
  count = 3,
): { increases: CategoryTrend[]; decreases: CategoryTrend[] } {
  const moved = trends.filter((trend) => trend.change !== 0);
  return {
    increases: [...moved]
      .filter((trend) => trend.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, count),
    decreases: [...moved]
      .filter((trend) => trend.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, count),
  };
}
