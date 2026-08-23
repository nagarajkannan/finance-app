"use client";

import Link from "next/link";
import { useMemo } from "react";
import { NetWorthTrend } from "@/components/snapshots/trend-chart";
import { Card, LinkButton } from "@/components/ui";
import { changeBetween, sortByDate } from "@/lib/analytics";
import {
  formatCompact,
  formatDateTime,
  formatSignedCurrency,
  formatSignedPercent,
} from "@/lib/format";
import { useSnapshots } from "@/lib/snapshot-client";
import type { Snapshot } from "@/lib/snapshots";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** The last snapshot taken a year or more before the newest one. */
function yearBefore(snapshots: Snapshot[], latest: Snapshot): Snapshot | null {
  const cutoff = new Date(latest.capturedAt).getTime() - YEAR_MS;
  const older = snapshots.filter(
    (snapshot) => new Date(snapshot.capturedAt).getTime() <= cutoff,
  );
  return older.length > 0 ? older[older.length - 1] : null;
}

function toneClass(value: number): string {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-slate-900";
}

/** The dashboard's window into snapshot history: where the net worth is heading. */
export function WealthTrend({ netWorth }: { netWorth: number }) {
  const { snapshots, schedule, loaded } = useSnapshots();
  const ordered = useMemo(() => sortByDate(snapshots), [snapshots]);

  if (!loaded) return null;

  const last = ordered[ordered.length - 1] ?? null;
  const yearAgo = last ? yearBefore(ordered, last) : null;
  const sinceLast = last ? changeBetween(last.netWorth, netWorth) : null;
  const overYear = yearAgo ? changeBetween(yearAgo.netWorth, netWorth) : null;

  return (
    <Card>
      {ordered.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Take a snapshot to start tracking how your net worth moves over time.
          </p>
          <LinkButton href="/snapshots">📸 Take snapshot</LinkButton>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">Net worth now</p>
              <p className={`mt-1 text-2xl font-semibold ${toneClass(netWorth)}`}>
                {formatCompact(netWorth)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Since last snapshot</p>
              <p
                className={`mt-1 text-2xl font-semibold ${toneClass(sinceLast?.change ?? 0)}`}
              >
                {sinceLast ? formatSignedCurrency(sinceLast.change) : "—"}
              </p>
              {sinceLast ? (
                <p className="mt-1 text-xs text-slate-400">
                  {formatSignedPercent(sinceLast.changePercent, 1)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-sm text-slate-500">Over 1 year</p>
              <p
                className={`mt-1 text-2xl font-semibold ${toneClass(overYear?.change ?? 0)}`}
              >
                {overYear ? formatSignedCurrency(overYear.change) : "—"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {overYear
                  ? formatSignedPercent(overYear.changePercent, 1)
                  : "No snapshot from a year ago yet"}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <NetWorthTrend snapshots={ordered} showBreakdown={false} />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
            <p>
              Last snapshot: {last ? formatDateTime(last.capturedAt) : "—"}
              {schedule?.nextRunAt
                ? ` · Next scheduled: ${formatDateTime(schedule.nextRunAt)}`
                : " · No automatic snapshots scheduled"}
            </p>
            <Link
              href="/analytics"
              className="font-medium text-slate-600 hover:text-slate-900"
            >
              View analytics →
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}
