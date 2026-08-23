"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  allocationSlices,
  goldRateDelta,
  goldSplit,
  goalInsights,
  liabilityIcon,
  monthNetWorthChange,
  nextEmiDate,
  portfolioRisk,
  totalMonthlyEmi,
  upcomingEvents,
  type AllocationSlice,
} from "@/lib/dashboard";
import { totalOutstanding, totalsForAssets } from "@/lib/calculations";
import {
  formatCompact,
  formatCurrency,
  formatDate,
  formatMonthYear,
  formatPercent,
  formatSignedCurrency,
  formatSignedPercent,
} from "@/lib/format";
import { fetchGoldQuote } from "@/lib/market/client";
import type { Asset, Goal, Liability } from "@/lib/types";
import { Card, EmptyState, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { DonutChart } from "./donut";

const UPCOMING_WINDOWS = [
  { days: 30, label: "Next 30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
] as const;

function ymdLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toneClass(value: number): string {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-slate-900";
}

function SectionTitle({
  icon,
  title,
  action,
}: {
  icon: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-slate-900">
        <span className="mr-2" aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      {action}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const color =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : "text-slate-900";
  return (
    <Card>
      <p className="text-sm text-slate-500">
        <span className="mr-1.5" aria-hidden>
          {icon}
        </span>
        {label}
      </p>
      <p className={`mt-2 text-xl font-semibold ${color}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </Card>
  );
}

function AllocationRow({ slice }: { slice: AllocationSlice }) {
  const [open, setOpen] = useState(false);
  const profitTone = toneClass(slice.profit);

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: slice.color }}
        />
        <span className="w-8 text-lg" aria-hidden>
          {slice.icon}
        </span>
        <span className="flex-1 font-medium text-slate-900">{slice.label}</span>
        <span className="hidden text-sm text-slate-500 sm:inline">
          {slice.assets.length} {slice.assets.length === 1 ? "holding" : "holdings"}
        </span>
        <span className="w-24 text-right font-semibold text-slate-900">
          {formatCompact(slice.current)}
        </span>
        <span className="w-14 text-right text-sm text-slate-500">
          {slice.percent.toFixed(0)}%
        </span>
        <span className="w-6 text-center text-slate-400">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <div className="mb-3 ml-6 space-y-1 rounded-xl bg-slate-50 p-3">
          {slice.assets.map((asset) => {
            const profit = asset.currentValue - asset.investedAmount;
            return (
              <Link
                key={asset.id}
                href={`/assets/${asset.id}`}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white"
              >
                <span className="min-w-0 truncate text-slate-800">{asset.name}</span>
                <span className="shrink-0 text-slate-700">
                  {formatCompact(asset.currentValue)}
                </span>
                <span className={`w-20 shrink-0 text-right ${toneClass(profit)}`}>
                  {formatSignedCurrency(profit)}
                </span>
              </Link>
            );
          })}
          <p className={`px-2 pt-1 text-xs ${profitTone}`}>
            Bucket P/L {formatSignedCurrency(slice.profit)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardView({
  assets,
  liabilities,
  goals,
}: {
  assets: Asset[];
  liabilities: Liability[];
  goals: Goal[];
}) {
  const assetTotals = totalsForAssets(assets);
  const outstanding = totalOutstanding(liabilities);
  const netWorth = assetTotals.current - outstanding;
  const debtToAsset =
    assetTotals.current > 0 ? (outstanding / assetTotals.current) * 100 : 0;
  const slices = useMemo(() => allocationSlices(assets), [assets]);
  const gold = useMemo(() => goldSplit(assets), [assets]);
  const risk = useMemo(() => portfolioRisk(assets), [assets]);
  const insights = useMemo(() => goalInsights(goals, assets), [goals, assets]);
  const monthlyEmi = totalMonthlyEmi(liabilities);

  const [windowDays, setWindowDays] = useState<(typeof UPCOMING_WINDOWS)[number]["days"]>(
    30,
  );
  const events = useMemo(
    () => upcomingEvents(assets, windowDays),
    [assets, windowDays],
  );
  const [monthChange, setMonthChange] = useState({ change: 0, hasBaseline: false });
  const [goldQuote, setGoldQuote] = useState<{
    pricePerGram: number;
    asOf: string;
    market?: string;
  } | null>(null);
  const [goldDelta, setGoldDelta] = useState<{
    change: number;
    percent: number;
  } | null>(null);

  useEffect(() => {
    setMonthChange(monthNetWorthChange(netWorth));
  }, [netWorth]);

  useEffect(() => {
    let cancelled = false;
    fetchGoldQuote("22K")
      .then((quote) => {
        if (cancelled) return;
        setGoldQuote(quote);
        const delta = goldRateDelta(quote.pricePerGram);
        setGoldDelta(delta ? { change: delta.change, percent: delta.percent } : null);
      })
      .catch(() => {
        if (!cancelled) setGoldQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Dashboard"
        subtitle="A clear picture of your money: health, where it sits, and what is coming next."
      />

      <section>
        <SectionTitle icon="💚" title="Financial health" />
        <Card>
          <p className="text-sm text-slate-500">
            <span className="mr-1.5" aria-hidden>
              💰
            </span>
            Net worth
          </p>
          <p className={`mt-1 text-4xl font-semibold ${toneClass(netWorth)}`}>
            {formatCompact(netWorth)}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <span aria-hidden>💎</span> Assets{" "}
              <span className="font-semibold">{formatCompact(assetTotals.current)}</span>
            </p>
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <span aria-hidden>📉</span> Liabilities{" "}
              <span className="font-semibold">{formatCompact(outstanding)}</span>
            </p>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">
              <span className="mr-1.5" aria-hidden>
                📊
              </span>
              Net worth change
            </p>
            <p className={`mt-1 text-lg font-semibold ${toneClass(monthChange.change)}`}>
              {monthChange.hasBaseline
                ? `${formatSignedCurrency(monthChange.change)} this month ${monthChange.change >= 0 ? "↑" : "↓"}`
                : "Snapshot started this month — change will show on your next visits"}
            </p>
          </div>
        </Card>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Metric
            icon="⚖️"
            label="Debt-to-asset ratio"
            value={assetTotals.current > 0 ? formatPercent(debtToAsset) : "—"}
            hint="Liabilities ÷ assets"
            tone={debtToAsset > 50 ? "negative" : "neutral"}
          />
          <Metric
            icon="📥"
            label="Total invested"
            value={formatCompact(assetTotals.invested)}
          />
          <Metric
            icon="💹"
            label="Total profit / loss"
            value={`${formatSignedCurrency(assetTotals.profitLoss)} (${formatSignedPercent(assetTotals.profitLossPercent)})`}
            tone={
              assetTotals.profitLoss > 0
                ? "positive"
                : assetTotals.profitLoss < 0
                  ? "negative"
                  : "neutral"
            }
          />
        </div>
      </section>

      <section>
        <SectionTitle
          icon="🧩"
          title="Asset allocation"
          action={
            <Link href="/assets" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              View all →
            </Link>
          }
        />
        {assets.length === 0 ? (
          <EmptyState
            title="No assets yet"
            message="Add what you own to see where your money sits."
            action={<LinkButton href="/assets/new">Add an asset</LinkButton>}
          />
        ) : (
          <Card>
            <p className="text-center text-sm text-slate-500">
              Where is my {formatCompact(assetTotals.current)}?
            </p>
            <div className="mt-4 grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
              <DonutChart
                slices={slices}
                label="Assets"
                value={formatCompact(assetTotals.current)}
              />
              <div>
                {slices.map((slice) => (
                  <AllocationRow key={slice.id} slice={slice} />
                ))}
              </div>
            </div>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle icon="📈" title="Investment performance" />
        {assets.length === 0 ? (
          <EmptyState
            title="Nothing to measure yet"
            message="Performance appears once you add investments."
          />
        ) : (
          <Card>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-slate-500">📥 Invested</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatCurrency(assetTotals.invested)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">💎 Current value</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {formatCurrency(assetTotals.current)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">💹 Profit / loss</p>
                <p className={`mt-1 text-xl font-semibold ${toneClass(assetTotals.profitLoss)}`}>
                  {formatSignedCurrency(assetTotals.profitLoss)}
                </p>
                <p className={`text-sm ${toneClass(assetTotals.profitLoss)}`}>
                  {formatSignedPercent(assetTotals.profitLossPercent)}
                </p>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-lg text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-2 font-medium">Asset</th>
                    <th className="pb-2 text-right font-medium">Invested</th>
                    <th className="pb-2 text-right font-medium">Current</th>
                    <th className="pb-2 text-right font-medium">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {slices.map((slice) => (
                    <tr key={slice.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5">
                        <span className="mr-1.5" aria-hidden>
                          {slice.icon}
                        </span>
                        {slice.label}
                      </td>
                      <td className="py-2.5 text-right">{formatCompact(slice.invested)}</td>
                      <td className="py-2.5 text-right">{formatCompact(slice.current)}</td>
                      <td className={`py-2.5 text-right ${toneClass(slice.profit)}`}>
                        {formatSignedCurrency(slice.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle icon="🔔" title="Upcoming money" />
        <div className="mb-3 flex flex-wrap gap-2">
          {UPCOMING_WINDOWS.map((option) => (
            <button
              key={option.days}
              type="button"
              onClick={() => setWindowDays(option.days)}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                windowDays === option.days
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {events.length === 0 ? (
          <EmptyState
            title="Nothing due in this window"
            message="FD maturities, bond interest and RD payments will show up here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link key={event.id} href={event.href} className="block">
                <Card className="h-full hover:border-slate-300">
                  <p className="text-sm font-medium text-slate-500">
                    <span className="mr-1.5" aria-hidden>
                      {event.icon}
                    </span>
                    {event.subtitle}
                  </p>
                  <p className="mt-2 truncate font-semibold text-slate-900">{event.title}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {formatCurrency(event.amount)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{formatDate(event.date)}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          icon="🏦"
          title="Liabilities"
          action={
            <Link
              href="/liabilities"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              View all →
            </Link>
          }
        />
        {liabilities.length === 0 ? (
          <EmptyState
            title="No loans tracked"
            message="Add a home loan, personal loan or other EMI to see what you owe."
            action={<LinkButton href="/liabilities/new">Add a liability</LinkButton>}
          />
        ) : (
          <div className="space-y-3">
            <Card>
              <p className="text-sm text-slate-500">
                <span className="mr-1.5" aria-hidden>
                  💸
                </span>
                Total EMI / month
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatCurrency(monthlyEmi)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {formatCompact(outstanding)} still owed across {liabilities.length}{" "}
                {liabilities.length === 1 ? "loan" : "loans"}
              </p>
            </Card>
            <div className="grid gap-3 lg:grid-cols-2">
              {liabilities.map((liability) => (
                <Link key={liability.id} href={`/liabilities/${liability.id}`} className="block">
                  <Card className="h-full hover:border-slate-300">
                    <p className="font-semibold text-slate-900">
                      <span className="mr-1.5" aria-hidden>
                        {liabilityIcon(liability.type)}
                      </span>
                      {liability.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{liability.type}</p>
                    <p className="mt-3 text-xl font-semibold text-rose-700">
                      {formatCurrency(liability.outstandingAmount)} remaining
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-slate-500">EMI</dt>
                        <dd className="font-medium text-slate-900">
                          {liability.emiAmount
                            ? formatCurrency(liability.emiAmount)
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Interest</dt>
                        <dd className="font-medium text-slate-900">
                          {liability.interestRate
                            ? `${liability.interestRate}%`
                            : "—"}
                        </dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-slate-500">Next EMI</dt>
                        <dd className="font-medium text-slate-900">
                          {formatDate(ymdLocal(nextEmiDate(liability)))}
                        </dd>
                      </div>
                    </dl>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          icon="🎯"
          title="Goals"
          action={
            <Link href="/goals" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              View all →
            </Link>
          }
        />
        {insights.length === 0 ? (
          <EmptyState
            title="No goals yet"
            message="Create a goal like “Build a house” and link the assets you are saving in for it."
            action={<LinkButton href="/goals/new">Create a goal</LinkButton>}
          />
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <Link key={insight.goal.id} href={`/goals/${insight.goal.id}`} className="block">
                <Card className="hover:border-slate-300">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      <span className="mr-1.5" aria-hidden>
                        {insight.icon}
                      </span>
                      {insight.goal.name}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        insight.onTrack
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {insight.onTrack ? "✓ On track" : "⚠ Needs attention"}
                    </span>
                  </div>
                  <div className="mt-4">
                    <ProgressBar percent={insight.progressPercent} />
                  </div>
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="flex justify-between gap-3 sm:block">
                      <dt className="text-slate-500">Target</dt>
                      <dd className="font-medium text-slate-900">
                        {formatCurrency(insight.goal.targetAmount)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 sm:block">
                      <dt className="text-slate-500">Current</dt>
                      <dd className="font-medium text-slate-900">
                        {formatCurrency(insight.currentAmount)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 sm:block">
                      <dt className="text-slate-500">Remaining</dt>
                      <dd className="font-medium text-slate-900">
                        {formatCurrency(insight.remainingAmount)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 sm:block">
                      <dt className="text-slate-500">Target date</dt>
                      <dd className="font-medium text-slate-900">
                        {formatMonthYear(insight.goal.targetDate)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 sm:block">
                      <dt className="text-slate-500">Required / month</dt>
                      <dd className="font-medium text-slate-900">
                        {formatCurrency(insight.requiredPerMonth)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 sm:block">
                      <dt className="text-slate-500">Current / month</dt>
                      <dd className="font-medium text-slate-900">
                        {formatCurrency(insight.currentPerMonth)}
                      </dd>
                    </div>
                  </dl>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle icon="🪙" title="Gold" />
        <Card>
          {goldQuote ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3">
              <div>
                <p className="text-sm text-amber-900">
                  <span className="mr-1.5" aria-hidden>
                    📍
                  </span>
                  22K jewellery rate
                  {goldQuote.market ? ` · ${goldQuote.market}` : ""}
                </p>
                <p className="mt-1 text-xl font-semibold text-amber-950">
                  {formatCurrency(goldQuote.pricePerGram)} / g
                </p>
              </div>
              <p
                className={`text-sm font-semibold ${
                  goldDelta
                    ? toneClass(goldDelta.change)
                    : "text-amber-800"
                }`}
              >
                {goldDelta
                  ? `${goldDelta.change >= 0 ? "📈" : "📉"} ${formatSignedCurrency(goldDelta.change)} (${formatSignedPercent(goldDelta.percent)}) vs last saved rate`
                  : "📌 Rate saved — comparison will appear next time it changes"}
              </p>
            </div>
          ) : null}
          {gold.total <= 0 ? (
            <p className="text-sm text-slate-500">
              Add physical gold, digital gold or a gold ETF to see this split.
            </p>
          ) : (
            <>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">🏅 Physical gold</dt>
                  <dd className="font-medium text-slate-900">
                    {formatCurrency(gold.physical)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">📱 Digital gold</dt>
                  <dd className="font-medium text-slate-900">
                    {formatCurrency(gold.digital)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-600">📊 Gold ETF / SGB / MF</dt>
                  <dd className="font-medium text-slate-900">{formatCurrency(gold.etf)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                  <dt className="font-medium text-slate-900">Total gold</dt>
                  <dd className="font-semibold text-slate-900">
                    {formatCurrency(gold.total)}
                  </dd>
                </div>
              </dl>
              <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">Gold invested</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {formatCurrency(gold.invested)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Current value</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {formatCurrency(gold.total)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Profit</dt>
                  <dd className={`mt-1 font-semibold ${toneClass(gold.profit)}`}>
                    {formatSignedCurrency(gold.profit)}
                  </dd>
                </div>
              </dl>
              {gold.grams > 0 ? (
                <p className="mt-4 text-sm text-slate-600">
                  <span className="mr-1.5" aria-hidden>
                    ⚖️
                  </span>
                  Physical gold quantity:{" "}
                  <span className="font-semibold text-slate-900">
                    {gold.grams.toFixed(1)} grams
                  </span>
                </p>
              ) : null}
            </>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle icon="🧭" title="Portfolio risk" />
        {assets.length === 0 ? (
          <EmptyState
            title="No portfolio yet"
            message="Risk mix is based on how your assets split across equity, debt, gold and cash."
          />
        ) : (
          <Card>
            <div className="space-y-3">
              {risk.map((slice) => (
                <div key={slice.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>
                      <span className="mr-1.5" aria-hidden>
                        {slice.icon}
                      </span>
                      {slice.label}
                    </span>
                    <span className="font-medium text-slate-900">
                      {slice.percent.toFixed(0)}% · {slice.exposure} exposure
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-700"
                      style={{ width: `${Math.min(slice.percent, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
