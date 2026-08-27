"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Field, Select, TextArea, TextInput } from "@/components/form";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatCard,
} from "@/components/ui";
import {
  calculateAllocationAmount,
  expenseCategories,
} from "@/lib/cash-flow";
import {
  formatCurrency,
  formatDate,
  formatMonthYear,
  formatPercent,
} from "@/lib/format";
import { reloadStore, requestJson, useStore } from "@/lib/store";
import type {
  AllocationMode,
  CashFlowSummary,
  CashFlowType,
} from "@/lib/types";

const transactionLabels: Record<CashFlowType, string> = {
  expense: "Expense",
  "asset-investment": "Asset investment",
  "liability-payment": "Liability payment",
};

function monthDate(month: string) {
  const today = new Date().toISOString().slice(0, 10);
  return today.startsWith(month) ? today : `${month}-01`;
}

function monthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return undefined;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0))
    .toISOString()
    .slice(8, 10);
  return `${month}-${lastDay}`;
}

function allocationHint(mode: AllocationMode, value: number) {
  return mode === "percentage" ? `${value}% of salary` : "Fixed amount";
}

export default function CashFlowPage() {
  const { assets, liabilities, loaded } = useStore();
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [summary, setSummary] = useState<CashFlowSummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [salaryCreditDay, setSalaryCreditDay] = useState("1");
  const [monthIncome, setMonthIncome] = useState("");
  const [type, setType] = useState<CashFlowType>("expense");
  const [allocationMode, setAllocationMode] =
    useState<AllocationMode>("amount");
  const [allocationValue, setAllocationValue] = useState("");
  const [category, setCategory] = useState<string>(expenseCategories[0]);
  const [targetId, setTargetId] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState("");

  const loadSummary = useCallback(async () => {
    const next = await requestJson<CashFlowSummary>(
      `/api/cash-flow?month=${month}`,
    );
    setSummary(next);
    setMonthIncome(String(next.income || ""));
    if (next.account) {
      setAccountName(next.account.accountName);
      setAccountLast4(next.account.accountLast4);
      setMonthlyIncome(String(next.account.monthlyIncome));
      setSalaryCreditDay(String(next.account.salaryCreditDay));
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    void requestJson<CashFlowSummary>(`/api/cash-flow?month=${month}`)
      .then((next) => {
        if (cancelled) return;
        setSummary(next);
        setMonthIncome(String(next.income || ""));
        if (next.account) {
          setAccountName(next.account.accountName);
          setAccountLast4(next.account.accountLast4);
          setMonthlyIncome(String(next.account.monthlyIncome));
          setSalaryCreditDay(String(next.account.salaryCreditDay));
        }
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load salary activity.",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const availableTargets = useMemo(
    () =>
      type === "asset-investment"
        ? assets
        : liabilities.filter((liability) => liability.outstandingAmount > 0),
    [assets, liabilities, type],
  );

  const selectedTargetId =
    type === "expense"
      ? ""
      : availableTargets.some((target) => target.id === targetId)
        ? targetId
        : (availableTargets[0]?.id ?? "");

  const estimatedAmount = calculateAllocationAmount(
    summary?.income ?? 0,
    allocationMode,
    Number(allocationValue),
  );

  async function saveAccount(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await requestJson("/api/cash-flow/account", {
        method: "PUT",
        body: JSON.stringify({
          accountName,
          accountLast4,
          monthlyIncome: Number(monthlyIncome),
          salaryCreditDay: Number(salaryCreditDay),
        }),
      });
      setEditingAccount(false);
      await loadSummary();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the salary account.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveMonthIncome(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await requestJson("/api/cash-flow/month", {
        method: "PUT",
        body: JSON.stringify({ month, income: Number(monthIncome) }),
      });
      await loadSummary();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update this month's income.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addTransaction(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await requestJson("/api/cash-flow/transactions", {
        method: "POST",
        body: JSON.stringify({
          month,
          date,
          type,
          category,
          description,
          allocationMode,
          allocationValue: Number(allocationValue),
          targetId: selectedTargetId || undefined,
        }),
      });
      setAllocationValue("");
      setDescription("");
      await Promise.all([reloadStore(), loadSummary()]);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not allocate this money.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!loaded || loading) return null;

  if (!summary?.account || editingAccount) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Salary & cash flow"
          subtitle="Set up the account where your monthly salary arrives."
        />
        {error ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        <Card className="max-w-2xl">
          <form className="space-y-4" onSubmit={saveAccount}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Account name" hint="For example, HDFC salary account">
                <TextInput
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="Salary account"
                  required
                />
              </Field>
              <Field
                label="Account number"
                hint="Only the last 4 digits are stored"
              >
                <TextInput
                  value={accountLast4}
                  onChange={(event) => setAccountLast4(event.target.value)}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="1234"
                  required
                />
              </Field>
              <Field label="Monthly take-home salary">
                <TextInput
                  value={monthlyIncome}
                  onChange={(event) => setMonthlyIncome(event.target.value)}
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="75000"
                  required
                />
              </Field>
              <Field label="Usual salary credit day">
                <TextInput
                  value={salaryCreditDay}
                  onChange={(event) => setSalaryCreditDay(event.target.value)}
                  type="number"
                  min="1"
                  max="31"
                  required
                />
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              Monthly income is the default for new months. You can adjust any
              individual month after setup.
            </p>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save salary account"}
              </Button>
              {summary?.account ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingAccount(false)}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>
    );
  }

  const expenseTotal = summary.totals.expense;
  const savingsRate =
    summary.income > 0 ? (summary.remaining / summary.income) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary & cash flow"
        subtitle="Allocate salary to spending, investments and debt repayments."
        action={
          <div className="flex items-center gap-2">
            <TextInput
              type="month"
              value={month}
              onChange={(event) => {
                const nextMonth = event.target.value;
                if (!nextMonth) return;
                setMonth(nextMonth);
                setDate(monthDate(nextMonth));
                setLoading(true);
                setError("");
              }}
              aria-label="Cash flow month"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingAccount(true)}
            >
              Edit account
            </Button>
          </div>
        }
      />

      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {summary.account.accountName} · ••••{" "}
            {summary.account.accountLast4}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Usually credited on day {summary.account.salaryCreditDay}
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={saveMonthIncome}
        >
          <Field label={`${formatMonthYear(`${month}-01`)} income`}>
            <TextInput
              type="number"
              min="0.01"
              step="0.01"
              value={monthIncome}
              onChange={(event) => setMonthIncome(event.target.value)}
              className="w-44"
              required
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={saving}>
            Update
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income" value={formatCurrency(summary.income)} />
        <StatCard
          label="Allocated"
          value={formatCurrency(summary.allocated)}
          hint={`${formatPercent(
            summary.income > 0
              ? (summary.allocated / summary.income) * 100
              : 0,
          )} of income`}
        />
        <StatCard
          label="Still available"
          value={formatCurrency(summary.remaining)}
          tone={summary.remaining > 0 ? "positive" : "neutral"}
        />
        <StatCard
          label="Unallocated rate"
          value={formatPercent(savingsRate)}
          hint="Money not assigned yet"
          tone={savingsRate > 0 ? "positive" : "neutral"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Allocate this month&apos;s salary
          </h2>
          <form className="mt-4 space-y-4" onSubmit={addTransaction}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Use the money for">
                <Select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as CashFlowType)
                  }
                >
                  {Object.entries(transactionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Transaction date">
                <TextInput
                  type="date"
                  value={date}
                  min={`${month}-01`}
                  max={monthEnd(month)}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </Field>
              <Field label="Allocation method">
                <Select
                  value={allocationMode}
                  onChange={(event) =>
                    setAllocationMode(event.target.value as AllocationMode)
                  }
                >
                  <option value="amount">Fixed amount</option>
                  <option value="percentage">Percentage of salary</option>
                </Select>
              </Field>
              <Field
                label={
                  allocationMode === "percentage"
                    ? "Salary percentage"
                    : "Amount"
                }
                hint={
                  estimatedAmount > 0
                    ? `${formatCurrency(estimatedAmount)} will be allocated`
                    : undefined
                }
              >
                <TextInput
                  type="number"
                  min="0.01"
                  max={allocationMode === "percentage" ? "100" : undefined}
                  step="0.01"
                  value={allocationValue}
                  onChange={(event) =>
                    setAllocationValue(event.target.value)
                  }
                  placeholder={
                    allocationMode === "percentage" ? "10" : "5000"
                  }
                  required
                />
              </Field>
              {type === "expense" ? (
                <Field label="Expense category">
                  <Select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {expenseCategories.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <Field
                  label={
                    type === "asset-investment" ? "Asset" : "Liability"
                  }
                  hint={
                    type === "asset-investment"
                      ? "Live price or NAV is fetched when available"
                      : undefined
                  }
                >
                  <Select
                    value={selectedTargetId}
                    onChange={(event) => setTargetId(event.target.value)}
                    required
                  >
                    {availableTargets.length === 0 ? (
                      <option value="">
                        No {type === "asset-investment" ? "assets" : "liabilities"}{" "}
                        available
                      </option>
                    ) : null}
                    {availableTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            <Field label="Note" hint="Optional">
              <TextArea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                placeholder="What was this money used for?"
              />
            </Field>
            <Button
              type="submit"
              disabled={
                saving ||
                estimatedAmount <= 0 ||
                estimatedAmount > summary.remaining ||
                (type !== "expense" && !selectedTargetId)
              }
            >
              {saving ? "Allocating..." : "Allocate money"}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">
            Monthly allocation
          </h2>
          <div className="mt-4 space-y-4">
            {(
              [
                ["Expenses", summary.totals.expense],
                ["Investments", summary.totals["asset-investment"]],
                ["Debt repayments", summary.totals["liability-payment"]],
                ["Still available", Math.max(summary.remaining, 0)],
              ] as const
            ).map(([label, amount]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="text-slate-600">{label}</span>
                  <span className="font-medium text-slate-900">
                    {formatCurrency(amount)}
                  </span>
                </div>
                <ProgressBar
                  percent={
                    summary.income > 0 ? (amount / summary.income) * 100 : 0
                  }
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Expense analytics
          </h2>
          <p className="text-sm text-slate-500">
            Where your day-to-day spending went this month.
          </p>
        </div>
        {summary.expenseCategories.length === 0 ? (
          <EmptyState
            title="No expenses recorded"
            message="Add an expense allocation to start seeing category analytics."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.expenseCategories.map((item) => (
              <Card key={item.category}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{item.category}</p>
                  <p className="text-sm text-slate-500">
                    {formatPercent(
                      expenseTotal > 0
                        ? (item.amount / expenseTotal) * 100
                        : 0,
                    )}
                  </p>
                </div>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {formatCurrency(item.amount)}
                </p>
                <div className="mt-3">
                  <ProgressBar
                    percent={
                      expenseTotal > 0
                        ? (item.amount / expenseTotal) * 100
                        : 0
                    }
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Transaction history
          </h2>
          <p className="text-sm text-slate-500">
            Every salary allocation and its calculation for this month.
          </p>
        </div>
        {summary.transactions.length === 0 ? (
          <EmptyState
            title="No allocations yet"
            message="Your expenses, investments and repayments will appear here."
          />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Allocation</th>
                  <th className="px-5 py-3">Details</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-5 py-3 text-slate-600">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge>{transactionLabels[transaction.type]}</Badge>
                      <p className="mt-1 text-xs text-slate-500">
                        {allocationHint(
                          transaction.allocationMode,
                          transaction.allocationValue,
                        )}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">
                        {transaction.targetName ?? transaction.category}
                      </p>
                      {transaction.description ? (
                        <p className="text-xs text-slate-500">
                          {transaction.description}
                        </p>
                      ) : null}
                      <p className="mt-1 max-w-xl text-xs text-slate-400">
                        {transaction.calculation}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
