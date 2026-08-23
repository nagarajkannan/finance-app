"use client";

import { useMemo, useState } from "react";
import { NetWorthTrend } from "@/components/snapshots/trend-chart";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import {
  biggestMovers,
  categoryTrends,
  financialInsights,
  growthSummary,
  RANGES,
  RANGE_LABELS,
  sortByDate,
  withinRange,
  type CategoryTrend,
  type RangeId,
} from "@/lib/analytics";
import {
  formatCompact,
  formatCurrency,
  formatDateTime,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
} from "@/lib/format";
import { useSnapshots } from "@/lib/snapshot-client";

function toneClass(value: number, goodWhenUp = true): string {
  if (value === 0) return "text-slate-900";
  return (goodWhenUp ? value > 0 : value < 0) ? "text-emerald-600" : "text-rose-600";
}

function Metric({
  label,
  value,
  hint,
  tone = "text-slate-900",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${tone}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </Card>
  );
}

function TrendTable({
  title,
  subtitle,
  trends,
  goodWhenUp,
}: {
  title: string;
  subtitle: string;
  trends: CategoryTrend[];
  goodWhenUp: boolean;
}) {
  if (trends.length === 0) return null;
  const movers = biggestMovers(trends);

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="pb-2">Category</th>
            <th className="pb-2 text-right">Start</th>
            <th className="pb-2 text-right">Now</th>
            <th className="pb-2 text-right">Change</th>
            <th className="pb-2 text-right">Allocation</th>
          </tr>
        </thead>
        <tbody>
          {trends.map((trend) => (
            <tr key={trend.id} className="border-b border-slate-50 last:border-0">
              <td className="py-2 pr-4 text-slate-700">{trend.label}</td>
              <td className="py-2 text-right text-slate-500">
                {formatCurrency(trend.before)}
              </td>
              <td className="py-2 text-right text-slate-500">
                {formatCurrency(trend.after)}
              </td>
              <td className={`py-2 text-right font-medium ${toneClass(trend.change, goodWhenUp)}`}>
                {formatSignedCurrency(trend.change)}
              </td>
              <td className="py-2 text-right text-slate-400">
                {formatPercent(trend.sharePercentBefore)} →{" "}
                {formatPercent(trend.sharePercentAfter)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {movers.increases.length > 0 || movers.decreases.length > 0 ? (
        <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2">
          {movers.increases.length > 0 ? (
            <p className="text-slate-600">
              Biggest increases:{" "}
              <span className="font-medium text-slate-900">
                {movers.increases
                  .map((trend) => `${trend.label} ${formatSignedCurrency(trend.change)}`)
                  .join(", ")}
              </span>
            </p>
          ) : null}
          {movers.decreases.length > 0 ? (
            <p className="text-slate-600">
              Biggest decreases:{" "}
              <span className="font-medium text-slate-900">
                {movers.decreases
                  .map((trend) => `${trend.label} ${formatSignedCurrency(trend.change)}`)
                  .join(", ")}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export default function AnalyticsPage() {
  const { snapshots, loaded, error } = useSnapshots();
  const [range, setRange] = useState<RangeId>("1Y");

  const inRange = useMemo(() => withinRange(snapshots, range), [snapshots, range]);
  const summary = useMemo(() => growthSummary(inRange), [inRange]);
  const allTime = useMemo(() => growthSummary(sortByDate(snapshots)), [snapshots]);
  const insights = useMemo(() => financialInsights(inRange), [inRange]);

  const assetTrends = useMemo(
    () =>
      summary
        ? categoryTrends(summary.first.assetCategories, summary.last.assetCategories)
        : [],
    [summary],
  );
  const liabilityTrends = useMemo(
    () =>
      summary
        ? categoryTrends(
            summary.first.liabilityCategories,
            summary.last.liabilityCategories,
          )
        : [],
    [summary],
  );

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Everything here is read from your saved snapshots."
        action={<LinkButton href="/snapshots/compare" variant="secondary">Compare snapshots</LinkButton>}
      />

      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
      ) : null}

      {snapshots.length === 0 ? (
        <EmptyState
          title="No snapshots yet"
          message="Analytics are built from snapshot history. Take your first snapshot to get started."
          action={<LinkButton href="/snapshots">Take a snapshot</LinkButton>}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {RANGES.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setRange(id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  range === id
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {RANGE_LABELS[id]}
              </button>
            ))}
          </div>

          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Net worth trend</h2>
            {inRange.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No snapshots in this period. Pick a longer range.
              </p>
            ) : (
              <div className="mt-3">
                <NetWorthTrend snapshots={inRange} />
              </div>
            )}
          </Card>

          {summary ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label="Net worth now"
                  value={formatCompact(summary.last.netWorth)}
                  hint={`As of ${formatDateTime(summary.last.capturedAt)}`}
                />
                <Metric
                  label={`Growth over ${RANGE_LABELS[range]}`}
                  value={formatSignedCurrency(summary.period.change)}
                  hint={`${formatSignedPercent(summary.period.changePercent, 1)} across ${summary.days} days`}
                  tone={toneClass(summary.period.change)}
                />
                <Metric
                  label="Change since previous snapshot"
                  value={
                    summary.sincePrevious
                      ? formatSignedCurrency(summary.sincePrevious.change)
                      : "—"
                  }
                  hint={
                    summary.sincePrevious
                      ? formatSignedPercent(summary.sincePrevious.changePercent, 1)
                      : "Only one snapshot in this period"
                  }
                  tone={toneClass(summary.sincePrevious?.change ?? 0)}
                />
                <Metric
                  label="Total growth (all snapshots)"
                  value={allTime ? formatSignedCurrency(allTime.period.change) : "—"}
                  hint={
                    allTime
                      ? `${formatSignedPercent(allTime.period.changePercent, 1)} since ${formatDateTime(allTime.first.capturedAt)}`
                      : undefined
                  }
                  tone={toneClass(allTime?.period.change ?? 0)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Metric
                  label="Assets over this period"
                  value={formatSignedCurrency(summary.assets.change)}
                  hint={`${formatCompact(summary.assets.before)} → ${formatCompact(summary.assets.after)}`}
                  tone={toneClass(summary.assets.change)}
                />
                <Metric
                  label="Liabilities over this period"
                  value={formatSignedCurrency(summary.liabilities.change)}
                  hint={`${formatCompact(summary.liabilities.before)} → ${formatCompact(summary.liabilities.after)}`}
                  tone={toneClass(summary.liabilities.change, false)}
                />
              </div>

              <Card>
                <h2 className="text-lg font-semibold text-slate-900">Insights</h2>
                {insights.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Insights appear once there are at least two snapshots in the period.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {insights.map((insight) => (
                      <li
                        key={insight.id}
                        className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        <span aria-hidden>{insight.icon}</span>
                        <span>{insight.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <TrendTable
                title="Asset trends"
                subtitle={`Category values on ${formatDateTime(summary.first.capturedAt)} compared with ${formatDateTime(summary.last.capturedAt)}.`}
                trends={assetTrends}
                goodWhenUp
              />
              <TrendTable
                title="Liability trends"
                subtitle="A negative change means you owe less than you did."
                trends={liabilityTrends}
                goodWhenUp={false}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
