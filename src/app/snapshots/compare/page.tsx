"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import {
  compareSnapshots,
  type Change,
  type CategoryTrend,
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
import type { Snapshot } from "@/lib/snapshots";

const selectClass =
  "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none";

function toneClass(value: number, goodWhenUp = true): string {
  if (value === 0) return "text-slate-500";
  const good = goodWhenUp ? value > 0 : value < 0;
  return good ? "text-emerald-600" : "text-rose-600";
}

function ChangeRow({
  label,
  change,
  goodWhenUp = true,
}: {
  label: string;
  change: Change;
  goodWhenUp?: boolean;
}) {
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="py-2 pr-4 font-medium text-slate-900">{label}</td>
      <td className="py-2 text-right text-slate-500">{formatCurrency(change.before)}</td>
      <td className="py-2 text-right text-slate-500">{formatCurrency(change.after)}</td>
      <td className={`py-2 text-right font-semibold ${toneClass(change.change, goodWhenUp)}`}>
        {formatSignedCurrency(change.change)}
        <span className="ml-1 text-xs font-normal">
          ({formatSignedPercent(change.changePercent, 1)})
        </span>
      </td>
    </tr>
  );
}

function CategoryChanges({
  title,
  trends,
  goodWhenUp,
}: {
  title: string;
  trends: CategoryTrend[];
  goodWhenUp: boolean;
}) {
  if (trends.length === 0) return null;

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="pb-2">Category</th>
            <th className="pb-2 text-right">Before</th>
            <th className="pb-2 text-right">After</th>
            <th className="pb-2 text-right">Change</th>
            <th className="pb-2 text-right">Share</th>
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
    </Card>
  );
}

function SnapshotPicker({
  id,
  label,
  value,
  snapshots,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  snapshots: Snapshot[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
      >
        {snapshots.map((snapshot) => (
          <option key={snapshot.id} value={snapshot.id}>
            {formatDateTime(snapshot.capturedAt)}
            {snapshot.name ? ` · ${snapshot.name}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function CompareView() {
  const params = useSearchParams();
  const { snapshots, loaded } = useSnapshots();
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");

  if (!loaded) return null;

  if (snapshots.length < 2) {
    return (
      <EmptyState
        title="Two snapshots are needed"
        message="Take at least two snapshots and you can compare any pair of them here."
        action={<LinkButton href="/snapshots">Go to snapshots</LinkButton>}
      />
    );
  }

  /** The chosen snapshot, else the one asked for in the link, else a sensible end of the range. */
  const pick = (chosen: string, linked: string | null, fallback: Snapshot) =>
    snapshots.find((snapshot) => snapshot.id === chosen) ??
    snapshots.find((snapshot) => snapshot.id === linked) ??
    fallback;

  const a = pick(first, params.get("a"), snapshots[0]);
  const b = pick(second, params.get("b"), snapshots[snapshots.length - 1]);

  const comparison = compareSnapshots(a, b);

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <SnapshotPicker
            id="first"
            label="Snapshot A"
            value={a.id}
            snapshots={snapshots}
            onChange={setFirst}
          />
          <SnapshotPicker
            id="second"
            label="Snapshot B"
            value={b.id}
            snapshots={snapshots}
            onChange={setSecond}
          />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          {formatDateTime(comparison.before.capturedAt)} →{" "}
          {formatDateTime(comparison.after.capturedAt)}
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Totals</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="pb-2">Measure</th>
              <th className="pb-2 text-right">Before</th>
              <th className="pb-2 text-right">After</th>
              <th className="pb-2 text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            <ChangeRow label="Assets" change={comparison.assets} />
            <ChangeRow
              label="Liabilities"
              change={comparison.liabilities}
              goodWhenUp={false}
            />
            <ChangeRow label="Net worth" change={comparison.netWorth} />
          </tbody>
        </table>
      </Card>

      <CategoryChanges
        title="Asset categories"
        trends={comparison.assetCategories}
        goodWhenUp
      />
      <CategoryChanges
        title="Liability types"
        trends={comparison.liabilityCategories}
        goodWhenUp={false}
      />

      {comparison.goals.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Goals</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {comparison.goals.map((goal) => (
                <tr key={goal.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 pr-4 text-slate-700">{goal.name}</td>
                  <td className="py-2 text-right text-slate-500">
                    {formatPercent(goal.beforePercent)} →{" "}
                    {formatPercent(goal.afterPercent)}
                  </td>
                  <td className={`py-2 text-right font-medium ${toneClass(goal.changePercent)}`}>
                    {formatSignedPercent(goal.changePercent, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <p className="text-sm text-slate-500">
        Net worth moved {formatSignedCurrency(comparison.netWorth.change)} (
        {formatCompact(comparison.before.netWorth)} →{" "}
        {formatCompact(comparison.after.netWorth)}) between these two snapshots.
      </p>
    </div>
  );
}

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare snapshots"
        subtitle="Pick any two snapshots to see exactly what moved between them."
        action={<LinkButton href="/snapshots" variant="secondary">Back</LinkButton>}
      />
      <Suspense fallback={null}>
        <CompareView />
      </Suspense>
    </div>
  );
}
