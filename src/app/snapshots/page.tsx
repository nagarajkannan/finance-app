"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExportCard } from "@/components/snapshots/export-card";
import { ScheduleCard } from "@/components/snapshots/schedule-card";
import { Button, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { sortByDate } from "@/lib/analytics";
import {
  formatCompact,
  formatDateTime,
  formatSignedCurrency,
} from "@/lib/format";
import { useSnapshots } from "@/lib/snapshot-client";

const fieldClass =
  "rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none";

function toneClass(value: number): string {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-slate-500";
}

export default function SnapshotsPage() {
  const {
    snapshots,
    schedule,
    loaded,
    error,
    takeSnapshot,
    deleteSnapshot,
    saveSchedule,
  } = useSnapshots();

  const [name, setName] = useState("");
  const [taking, setTaking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  /** Change is measured against the snapshot before it, in real order. */
  const rows = useMemo(() => {
    const ordered = sortByDate(snapshots);
    return ordered
      .map((snapshot, index) => ({
        snapshot,
        change:
          index > 0 ? snapshot.netWorth - ordered[index - 1].netWorth : null,
      }))
      .filter(({ snapshot }) => {
        const day = snapshot.capturedAt.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      })
      .reverse();
  }, [snapshots, from, to]);

  const take = async () => {
    setTaking(true);
    setActionError(null);
    try {
      await takeSnapshot(name);
      setName("");
    } catch (takeError) {
      setActionError(
        takeError instanceof Error ? takeError.message : "Could not take a snapshot.",
      );
    } finally {
      setTaking(false);
    }
  };

  const remove = async (id: string) => {
    setActionError(null);
    try {
      await deleteSnapshot(id);
      setSelected((current) => current.filter((value) => value !== id));
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the snapshot.",
      );
    }
  };

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id].slice(-2),
    );
  };

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Snapshots"
        subtitle="A saved copy of your totals at a moment in time. Your assets, liabilities and goals are never changed by this."
        action={<LinkButton href="/analytics" variant="secondary">View analytics</LinkButton>}
      />

      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grow">
            <label className="text-sm font-medium text-slate-700" htmlFor="snapshot-name">
              Name or note (optional)
            </label>
            <input
              id="snapshot-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Before the house down payment"
              className={`mt-1 w-full ${fieldClass}`}
            />
          </div>
          <Button type="button" onClick={() => void take()} disabled={taking}>
            {taking ? "Taking…" : "📸 Take snapshot"}
          </Button>
        </div>
        {actionError ? (
          <p className="mt-3 text-sm text-rose-600">{actionError}</p>
        ) : null}
      </Card>

      {schedule ? <ScheduleCard schedule={schedule} onSave={saveSchedule} /> : null}

      <ExportCard />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="from">
                From
              </label>
              <input
                id="from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className={`mt-1 block ${fieldClass}`}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="to">
                To
              </label>
              <input
                id="to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className={`mt-1 block ${fieldClass}`}
              />
            </div>
            {from || to ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setFrom("");
                  setTo("");
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
          {selected.length === 2 ? (
            <LinkButton href={`/snapshots/compare?a=${selected[0]}&b=${selected[1]}`}>
              Compare selected
            </LinkButton>
          ) : (
            <p className="text-sm text-slate-500">
              Tick two snapshots to compare them.
            </p>
          )}
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title={snapshots.length === 0 ? "No snapshots yet" : "Nothing in this date range"}
          message={
            snapshots.length === 0
              ? "Take your first snapshot to start tracking how your net worth moves over time."
              : "Change the dates to see the snapshots you have taken."
          }
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Compare</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Net worth</th>
                <th className="px-4 py-3 text-right">Assets</th>
                <th className="px-4 py-3 text-right">Liabilities</th>
                <th className="px-4 py-3 text-right">Change</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ snapshot, change }) => (
                <tr key={snapshot.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select snapshot from ${formatDateTime(snapshot.capturedAt)}`}
                      checked={selected.includes(snapshot.id)}
                      onChange={() => toggle(snapshot.id)}
                      className="size-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/snapshots/${snapshot.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {formatDateTime(snapshot.capturedAt)}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {snapshot.name || (snapshot.source === "scheduled" ? "Scheduled" : "Manual")}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatCompact(snapshot.netWorth)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatCompact(snapshot.totalAssets)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatCompact(snapshot.totalLiabilities)}
                  </td>
                  <td className={`px-4 py-3 text-right ${change === null ? "text-slate-400" : toneClass(change)}`}>
                    {change === null ? "—" : formatSignedCurrency(change)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/snapshots/${snapshot.id}`}
                        className="text-sm font-medium text-slate-600 hover:text-slate-900"
                      >
                        View
                      </Link>
                      {snapshot.driveFileUrl ? (
                        <a
                          href={snapshot.driveFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-slate-600 hover:text-slate-900"
                        >
                          Excel
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void remove(snapshot.id)}
                        className="text-sm font-medium text-rose-600 hover:text-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
