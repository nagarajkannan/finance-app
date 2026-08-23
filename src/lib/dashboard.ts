import { totalsForAssets } from "./calculations";
import { valueDebtAsset } from "./debt";
import { isPhysicalGold } from "./gold";
import type { Asset, Goal, Liability } from "./types";

export type AllocationId =
  | "mutual-funds"
  | "fd"
  | "gold"
  | "bonds"
  | "stocks"
  | "cash"
  | "other";

export interface AllocationSlice {
  id: AllocationId;
  label: string;
  icon: string;
  color: string;
  assets: Asset[];
  invested: number;
  current: number;
  profit: number;
  percent: number;
}

export interface UpcomingEvent {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  amount: number;
  date: string;
  href: string;
}

export interface GoalInsight {
  goal: Goal;
  icon: string;
  currentAmount: number;
  remainingAmount: number;
  progressPercent: number;
  monthsLeft: number;
  requiredPerMonth: number;
  currentPerMonth: number;
  onTrack: boolean;
}

export interface GoldSplit {
  physical: number;
  digital: number;
  etf: number;
  total: number;
  invested: number;
  profit: number;
  grams: number;
}

export interface RiskSlice {
  id: "equity" | "debt" | "gold" | "cash" | "other";
  label: string;
  icon: string;
  percent: number;
  current: number;
  exposure: "Low" | "Moderate" | "High";
}

const ALLOCATION_META: Record<
  AllocationId,
  { label: string; icon: string; color: string }
> = {
  "mutual-funds": { label: "Mutual Funds", icon: "📊", color: "#059669" },
  fd: { label: "FD / RD", icon: "🏦", color: "#0284c7" },
  gold: { label: "Gold", icon: "🪙", color: "#d97706" },
  bonds: { label: "Bonds", icon: "📜", color: "#7c3aed" },
  stocks: { label: "Stocks", icon: "📈", color: "#2563eb" },
  cash: { label: "Cash", icon: "💵", color: "#64748b" },
  other: { label: "Other", icon: "📦", color: "#78716c" },
};

const LIABILITY_ICON: Record<string, string> = {
  "Home Loan": "🏠",
  "Vehicle Loan": "🚗",
  "Personal Loan": "👤",
  "Education Loan": "🎓",
  "Credit Card": "💳",
  "Gold Loan": "🪙",
  "Business Loan": "💼",
  "Friends / Family": "🤝",
  Other: "📋",
};

function looksLikeGold(asset: Asset): boolean {
  if (isPhysicalGold(asset.categoryId, asset.type)) return true;
  if (asset.type === "Digital Gold" || asset.type === "ETF / SGB / MF") return true;
  return /gold|bees|sgb/i.test(`${asset.name} ${asset.type}`);
}

export function allocationIdFor(asset: Asset): AllocationId {
  if (looksLikeGold(asset)) return "gold";
  if (asset.type === "Equity Mutual Fund") return "mutual-funds";
  if (asset.type === "Direct Stock" || asset.type === "ETF Fund") return "stocks";
  if (asset.type === "Bonds") return "bonds";
  if (asset.type === "FD / RD") return "fd";
  if (asset.categoryId === "cash") return "cash";
  if (asset.debtDetails?.kind === "fd" || asset.debtDetails?.kind === "rd") {
    return "fd";
  }
  return "other";
}

export function allocationSlices(assets: Asset[]): AllocationSlice[] {
  const total = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const grouped = new Map<AllocationId, Asset[]>();
  for (const asset of assets) {
    const id = allocationIdFor(asset);
    grouped.set(id, [...(grouped.get(id) ?? []), asset]);
  }

  const order: AllocationId[] = [
    "mutual-funds",
    "fd",
    "gold",
    "bonds",
    "stocks",
    "cash",
    "other",
  ];

  return order
    .map((id) => {
      const list = grouped.get(id) ?? [];
      const totals = totalsForAssets(list);
      return {
        id,
        ...ALLOCATION_META[id],
        assets: list,
        invested: totals.invested,
        current: totals.current,
        profit: totals.profitLoss,
        percent: total > 0 ? (totals.current / total) * 100 : 0,
      };
    })
    .filter((slice) => slice.assets.length > 0);
}

export function goldSplit(assets: Asset[]): GoldSplit {
  const goldAssets = assets.filter((asset) => looksLikeGold(asset));
  const physical = goldAssets.filter((asset) =>
    isPhysicalGold(asset.categoryId, asset.type),
  );
  const digital = goldAssets.filter((asset) => asset.type === "Digital Gold");
  const etf = goldAssets.filter(
    (asset) =>
      !isPhysicalGold(asset.categoryId, asset.type) &&
      asset.type !== "Digital Gold",
  );
  const totals = totalsForAssets(goldAssets);
  const grams = physical.reduce(
    (sum, asset) => sum + (asset.goldDetails?.weightGrams ?? 0),
    0,
  );
  return {
    physical: totalsForAssets(physical).current,
    digital: totalsForAssets(digital).current,
    etf: totalsForAssets(etf).current,
    total: totals.current,
    invested: totals.invested,
    profit: totals.profitLoss,
    grams,
  };
}

function ymd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nextOnDayOfMonth(day: number, from: Date): Date {
  const clamped = Math.min(Math.max(Math.round(day) || 1, 1), 28);
  const candidate = new Date(from.getFullYear(), from.getMonth(), clamped);
  if (candidate.getTime() <= from.getTime()) {
    return new Date(from.getFullYear(), from.getMonth() + 1, clamped);
  }
  return candidate;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function nextCouponDate(
  start: Date,
  payout: string,
  from: Date,
  maturity?: Date,
): Date | null {
  const months =
    payout === "monthly"
      ? 1
      : payout === "quarterly"
        ? 3
        : payout === "half-yearly"
          ? 6
          : payout === "yearly"
            ? 12
            : 0;
  if (!months) return null;
  let cursor = new Date(start);
  let guard = 0;
  while (cursor.getTime() <= from.getTime() && guard < 240) {
    cursor = addMonths(cursor, months);
    guard += 1;
  }
  if (maturity && cursor.getTime() > maturity.getTime()) return null;
  return cursor;
}

export function upcomingEvents(
  assets: Asset[],
  windowDays: number,
  asOf: Date = new Date(),
): UpcomingEvent[] {
  const until = new Date(asOf.getTime() + windowDays * 86_400_000);
  const events: UpcomingEvent[] = [];

  for (const asset of assets) {
    const details = asset.debtDetails;
    if (!details) continue;
    const valuation = valueDebtAsset(details, asOf);
    const maturity = parseDate(valuation.maturityDate ?? "");
    if (
      maturity &&
      maturity.getTime() >= asOf.getTime() &&
      maturity.getTime() <= until.getTime()
    ) {
      events.push({
        id: `${asset.id}-maturity`,
        icon: details.kind === "bond" ? "📜" : "🏦",
        title: asset.name,
        subtitle:
          details.kind === "bond"
            ? "Bond matures"
            : details.kind === "rd"
              ? "RD matures"
              : "Matures",
        amount: valuation.maturityValue ?? asset.currentValue,
        date: ymd(maturity),
        href: `/assets/${asset.id}`,
      });
    }

    if (details.kind === "rd" && details.monthlyDeposit > 0) {
      const start = parseDate(details.startDate);
      if (start) {
        const next = nextOnDayOfMonth(start.getDate(), asOf);
        if (next.getTime() <= until.getTime()) {
          events.push({
            id: `${asset.id}-rd`,
            icon: "💸",
            title: asset.name,
            subtitle: "Next RD payment",
            amount: details.monthlyDeposit,
            date: ymd(next),
            href: `/assets/${asset.id}`,
          });
        }
      }
    }

    if (details.kind === "bond" && details.payout !== "cumulative") {
      const start = parseDate(details.startDate);
      const mat = parseDate(details.maturityDate);
      if (start) {
        const next = nextCouponDate(start, details.payout, asOf, mat ?? undefined);
        if (next && next.getTime() <= until.getTime()) {
          const quantity =
            details.quantity > 0
              ? details.quantity
              : details.buyPrice > 0 && (details.investedAmount ?? 0) > 0
                ? (details.investedAmount ?? 0) / details.buyPrice
                : 0;
          const coupon =
            details.faceValue *
            quantity *
            (details.couponRate / 100) *
            (details.payout === "monthly"
              ? 1 / 12
              : details.payout === "quarterly"
                ? 1 / 4
                : details.payout === "half-yearly"
                  ? 1 / 2
                  : 1);
          events.push({
            id: `${asset.id}-coupon`,
            icon: "🔔",
            title: asset.name,
            subtitle: "Bond interest",
            amount: coupon,
            date: ymd(next),
            href: `/assets/${asset.id}`,
          });
        }
      }
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function dayFromDate(value: string): number {
  const date = parseDate(value);
  return date ? date.getDate() : 1;
}

export function nextEmiDate(liability: Liability, from: Date = new Date()): Date {
  return nextOnDayOfMonth(dayFromDate(liability.startDate), from);
}

export function totalMonthlyEmi(liabilities: Liability[]): number {
  return liabilities.reduce((sum, item) => sum + (item.emiAmount || 0), 0);
}

export function liabilityIcon(type: string): string {
  return LIABILITY_ICON[type] ?? "📋";
}

function goalIcon(name: string): string {
  const text = name.toLowerCase();
  if (/house|home|flat|building/.test(text)) return "🏠";
  if (/car|vehicle|bike/.test(text)) return "🚗";
  if (/educat|college|school/.test(text)) return "🎓";
  if (/retir|pension/.test(text)) return "🌴";
  if (/wedding|marri/.test(text)) return "💍";
  if (/travel|trip|vacation/.test(text)) return "✈️";
  if (/emergency/.test(text)) return "🛟";
  return "🎯";
}

function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    (to.getDate() - from.getDate()) / 30;
  return Math.max(months, 0);
}

export function goalInsights(goals: Goal[], assets: Asset[]): GoalInsight[] {
  const asOf = new Date();
  return goals.map((goal) => {
    const linked = assets.filter((asset) => goal.linkedAssetIds.includes(asset.id));
    const currentAmount = linked.reduce((sum, asset) => sum + asset.currentValue, 0);
    const remainingAmount = Math.max(goal.targetAmount - currentAmount, 0);
    const target = parseDate(goal.targetDate) ?? asOf;
    const monthsLeft = monthsBetween(asOf, target);
    const requiredPerMonth =
      monthsLeft > 0 ? remainingAmount / monthsLeft : remainingAmount;
    const currentPerMonth = linked.reduce((sum, asset) => {
      const sip = asset.equityDetails?.sipAmount ?? 0;
      const rd =
        asset.debtDetails?.kind === "rd" ? asset.debtDetails.monthlyDeposit : 0;
      return sum + sip + rd;
    }, 0);
    const expectedByNow =
      goal.targetAmount *
      Math.min(
        monthsBetween(parseDate(goal.createdAt) ?? asOf, asOf) /
          Math.max(monthsBetween(parseDate(goal.createdAt) ?? asOf, target), 0.01),
        1,
      );
    const onTrack =
      remainingAmount <= 0 ||
      currentPerMonth + 1 >= requiredPerMonth ||
      currentAmount >= expectedByNow;

    return {
      goal,
      icon: goalIcon(goal.name),
      currentAmount,
      remainingAmount,
      progressPercent:
        goal.targetAmount > 0
          ? Math.min((currentAmount / goal.targetAmount) * 100, 100)
          : 0,
      monthsLeft,
      requiredPerMonth,
      currentPerMonth,
      onTrack,
    };
  });
}

function exposure(percent: number): "Low" | "Moderate" | "High" {
  if (percent >= 45) return "High";
  if (percent >= 20) return "Moderate";
  return "Low";
}

export function portfolioRisk(assets: Asset[]): RiskSlice[] {
  const total = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const buckets: Record<RiskSlice["id"], number> = {
    equity: 0,
    debt: 0,
    gold: 0,
    cash: 0,
    other: 0,
  };

  for (const asset of assets) {
    const id = allocationIdFor(asset);
    if (id === "gold") buckets.gold += asset.currentValue;
    else if (id === "cash") buckets.cash += asset.currentValue;
    else if (id === "mutual-funds" || id === "stocks") {
      buckets.equity += asset.currentValue;
    } else if (id === "fd" || id === "bonds" || asset.categoryId === "debt") {
      buckets.debt += asset.currentValue;
    } else {
      buckets.other += asset.currentValue;
    }
  }

  const meta: Record<
    RiskSlice["id"],
    { label: string; icon: string }
  > = {
    equity: { label: "Equity", icon: "📈" },
    debt: { label: "Debt", icon: "🏦" },
    gold: { label: "Gold", icon: "🪙" },
    cash: { label: "Cash", icon: "💵" },
    other: { label: "Other", icon: "📦" },
  };

  return (Object.keys(meta) as RiskSlice["id"][])
    .map((id) => {
      const current = buckets[id];
      const percent = total > 0 ? (current / total) * 100 : 0;
      return {
        id,
        ...meta[id],
        current,
        percent,
        exposure: exposure(percent),
      };
    })
    .filter((slice) => slice.current > 0 || slice.id !== "other");
}

const SNAP_KEY = "mm_networth_month";

export function monthNetWorthChange(netWorth: number): {
  change: number;
  hasBaseline: boolean;
} {
  if (typeof window === "undefined") {
    return { change: 0, hasBaseline: false };
  }
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  try {
    const raw = window.localStorage.getItem(SNAP_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as { month?: string; start?: number })
      : {};
    if (parsed.month === month && Number.isFinite(parsed.start)) {
      return { change: netWorth - Number(parsed.start), hasBaseline: true };
    }
    window.localStorage.setItem(
      SNAP_KEY,
      JSON.stringify({ month, start: netWorth }),
    );
    return { change: 0, hasBaseline: false };
  } catch {
    return { change: 0, hasBaseline: false };
  }
}

const GOLD_RATE_KEY = "mm_gold_rate_22k";

export function goldRateDelta(current: number): {
  previous: number;
  change: number;
  percent: number;
} | null {
  if (typeof window === "undefined" || !(current > 0)) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = window.localStorage.getItem(GOLD_RATE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as {
          price?: number;
          previous?: number;
          day?: string;
        })
      : {};
    const lastPrice = Number(parsed.price);
    const previous =
      parsed.day === today && Number.isFinite(Number(parsed.previous))
        ? Number(parsed.previous)
        : Number.isFinite(lastPrice) && parsed.day !== today
          ? lastPrice
          : Number(parsed.previous);

    window.localStorage.setItem(
      GOLD_RATE_KEY,
      JSON.stringify({
        price: current,
        previous: Number.isFinite(previous) ? previous : current,
        day: today,
      }),
    );

    if (!Number.isFinite(previous) || previous <= 0 || previous === current) {
      return null;
    }
    const change = current - previous;
    return {
      previous,
      change,
      percent: (change / previous) * 100,
    };
  } catch {
    return null;
  }
}
