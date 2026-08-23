"use client";

import { Badge, Card, EmptyState, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { formatCompact, formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import { useSnapshots } from "@/lib/snapshot-client";
import type { SnapshotCategory } from "@/lib/snapshots";

function CategoryTable({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: SnapshotCategory[];
  emptyMessage: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0">
                <td className="py-2 text-slate-700">{row.label}</td>
                <td className="py-2 text-right text-slate-400">
                  {total > 0 ? formatPercent((row.value / total) * 100) : "—"}
                </td>
                <td className="py-2 text-right font-medium text-slate-900">
                  {formatCurrency(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function SnapshotDetail({ snapshotId }: { snapshotId: string }) {
  const { snapshots, loaded } = useSnapshots();

  if (!loaded) return null;

  const snapshot = snapshots.find((entry) => entry.id === snapshotId);

  if (!snapshot) {
    return (
      <EmptyState
        title="Snapshot not found"
        message="It may have been deleted."
        action={<LinkButton href="/snapshots">Back to snapshots</LinkButton>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={snapshot.name || "Snapshot"}
        subtitle={`Taken ${formatDateTime(snapshot.capturedAt)}`}
        action={<LinkButton href="/snapshots" variant="secondary">Back</LinkButton>}
      />

      <div className="flex flex-wrap gap-2">
        <Badge>{snapshot.source === "scheduled" ? "Automatic" : "Manual"}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Net worth</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCompact(snapshot.netWorth)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Assets</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {formatCompact(snapshot.totalAssets)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Invested {formatCompact(snapshot.totalInvested)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Liabilities</p>
          <p className="mt-2 text-2xl font-semibold text-rose-600">
            {formatCompact(snapshot.totalLiabilities)}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryTable
          title="Assets by category"
          rows={snapshot.assetCategories}
          emptyMessage="No assets at this point in time."
        />
        <CategoryTable
          title="Liabilities by type"
          rows={snapshot.liabilityCategories}
          emptyMessage="No liabilities at this point in time."
        />
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Goal progress</h2>
        {snapshot.goals.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No goals at this point in time.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {snapshot.goals.map((goal) => (
              <div key={goal.id}>
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-900">{goal.name}</span>
                  <span className="text-slate-500">
                    {formatCurrency(goal.currentAmount)} of{" "}
                    {formatCurrency(goal.targetAmount)} ·{" "}
                    {formatPercent(goal.progressPercent)}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar percent={goal.progressPercent} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
