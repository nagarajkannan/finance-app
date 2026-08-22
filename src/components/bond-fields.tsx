"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Field, Select, TextInput } from "@/components/form";
import { InstrumentPicker } from "@/components/instrument-picker";
import { Button } from "@/components/ui";
import {
  BOND_INTEREST_TYPE_OPTIONS,
  BOND_PAYOUT_OPTIONS,
  valueDebtAsset,
  type BondInterestType,
  type BondPayout,
  type DebtDetails,
} from "@/lib/debt";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { fetchQuote } from "@/lib/market/client";
import type { BondQuote } from "@/lib/market/bonds";

type BondValues = Record<string, string>;

function num(values: BondValues, key: string): number {
  const parsed = Number(values[key]);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBondDetails(values: BondValues): DebtDetails {
  const buyPrice = num(values, "buyPrice");
  const invested = num(values, "investedAmount");
  const quantity =
    num(values, "quantity") > 0
      ? num(values, "quantity")
      : buyPrice > 0 && invested > 0
        ? invested / buyPrice
        : 0;

  return {
    kind: "bond",
    isin: values.isin ?? "",
    instrumentName: values.instrumentName ?? "",
    faceValue: num(values, "faceValue"),
    quantity,
    buyPrice,
    investedAmount: invested,
    couponRate: num(values, "couponRate"),
    interestType: (values.interestType || "fixed") as BondInterestType,
    payout: (values.payout || "yearly") as BondPayout,
    startDate: values.startDate ?? "",
    maturityDate: values.maturityDate ?? "",
    currentPrice: num(values, "currentPrice"),
    priceUpdatedAt: values.priceUpdatedAt ?? "",
  };
}

export function BondFields({
  values,
  onChange,
}: {
  values: BondValues;
  onChange: (key: string, value: string) => void;
}) {
  const [priceError, setPriceError] = useState("");
  const [loadingPrice, setLoadingPrice] = useState(false);
  const onChangeRef = useRef(onChange);
  const valuesRef = useRef(values);
  useEffect(() => {
    onChangeRef.current = onChange;
    valuesRef.current = values;
  }, [onChange, values]);

  const patch = useCallback(
    (next: Record<string, string>) => {
      for (const [key, value] of Object.entries(next)) {
        onChange(key, value);
      }
    },
    [onChange],
  );

  const refreshPrice = useCallback(async (isin: string, fillBlanks: boolean) => {
    if (!isin) return;
    setLoadingPrice(true);
    try {
      const quote = (await fetchQuote("bond", isin)) as BondQuote;
      setPriceError("");
      const current = valuesRef.current;
      const updates: Record<string, string> = {};
      if (fillBlanks || !current.instrumentName) updates.instrumentName = quote.name;
      if (fillBlanks || !current.couponRate) updates.couponRate = String(quote.couponRate);
      if (fillBlanks || !current.interestType) updates.interestType = quote.interestType;
      if (fillBlanks || !current.payout) updates.payout = quote.frequency;
      if (fillBlanks || !current.faceValue) updates.faceValue = String(quote.faceValue);
      if (fillBlanks || !current.maturityDate) updates.maturityDate = quote.maturityDate;
      if ((fillBlanks || !num(current, "buyPrice")) && quote.issuePrice > 0) {
        updates.buyPrice = String(quote.issuePrice);
      }
      if (quote.price > 0) {
        updates.currentPrice = String(quote.price);
        updates.priceUpdatedAt = quote.asOf;
      }
      for (const [key, value] of Object.entries(updates)) {
        onChangeRef.current(key, value);
      }
    } catch (error) {
      setPriceError(
        error instanceof Error ? error.message : "The bond lookup failed.",
      );
    } finally {
      setLoadingPrice(false);
    }
  }, []);

  const isin = values.isin ?? "";
  useEffect(() => {
    if (!isin) return;
    const timer = window.setTimeout(() => void refreshPrice(isin, false), 0);
    return () => window.clearTimeout(timer);
  }, [isin, refreshPrice]);

  const details = toBondDetails(values);
  const valuation = valueDebtAsset(details);
  const interestEarned = valuation.interestEarned ?? valuation.currentValue - valuation.invested;
  const totalReturn = valuation.totalReturnPercent ?? 0;

  return (
    <div className="space-y-4">
      <InstrumentPicker
        kind="bond"
        label="Bond name"
        hint="Search Bond Central by issuer or ISIN"
        placeholder="Example: Kosamattam or INE403Q07AW5"
        selectedId={isin}
        selectedName={values.instrumentName ?? ""}
        onSelect={(option) => {
          onChange("isin", option.id);
          onChange("instrumentName", option.name);
          void refreshPrice(option.id, true);
        }}
        onClear={() => {
          patch({
            isin: "",
            instrumentName: "",
            currentPrice: "",
            priceUpdatedAt: "",
          });
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ISIN" hint="Filled from Bond Central">
          <TextInput
            value={values.isin ?? ""}
            placeholder="INE123A01010"
            onChange={(e) => onChange("isin", e.target.value.toUpperCase())}
          />
        </Field>
        <Field label="Investment amount (₹)">
          <TextInput
            type="number"
            min="0"
            step="any"
            value={values.investedAmount ?? ""}
            placeholder="100000"
            onChange={(e) => onChange("investedAmount", e.target.value)}
          />
        </Field>
        <Field label="Purchase date">
          <TextInput
            type="date"
            value={values.startDate ?? ""}
            onChange={(e) => onChange("startDate", e.target.value)}
          />
        </Field>
        <Field label="Coupon / interest rate (% a year)">
          <TextInput
            type="number"
            min="0"
            step="any"
            value={values.couponRate ?? ""}
            placeholder="12"
            onChange={(e) => onChange("couponRate", e.target.value)}
          />
        </Field>
        <Field label="Interest type">
          <Select
            value={values.interestType ?? "fixed"}
            onChange={(e) => onChange("interestType", e.target.value)}
          >
            {BOND_INTEREST_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Interest payment frequency">
          <Select
            value={values.payout ?? "yearly"}
            onChange={(e) => onChange("payout", e.target.value)}
          >
            {BOND_PAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Maturity date">
          <TextInput
            type="date"
            value={values.maturityDate ?? ""}
            onChange={(e) => onChange("maturityDate", e.target.value)}
          />
        </Field>
        <Field
          label="Purchase price (₹)"
          hint="Price you paid per bond"
        >
          <TextInput
            type="number"
            min="0"
            step="any"
            value={values.buyPrice ?? ""}
            placeholder="1000"
            onChange={(e) => onChange("buyPrice", e.target.value)}
          />
        </Field>
        <Field label="Face value (₹)">
          <TextInput
            type="number"
            min="0"
            step="any"
            value={values.faceValue ?? ""}
            placeholder="1000"
            onChange={(e) => onChange("faceValue", e.target.value)}
          />
        </Field>
        <Field
          label="Current market price (₹)"
          hint={
            values.priceUpdatedAt
              ? `Last updated ${formatDateTime(values.priceUpdatedAt)}`
              : "Fetched from BSE when the ISIN is listed"
          }
        >
          <div className="flex gap-2">
            <TextInput
              type="number"
              min="0"
              step="any"
              value={values.currentPrice ?? ""}
              placeholder="0"
              onChange={(e) => onChange("currentPrice", e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!isin || loadingPrice}
              onClick={() => void refreshPrice(isin, false)}
            >
              {loadingPrice ? "…" : "Refresh"}
            </Button>
          </div>
        </Field>
      </div>

      {priceError ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {priceError} Coupon and dates from Bond Central are still used. You
          can type a market price yourself.
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">
          Calculated for you — you do not enter the value today
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Invested amount</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatCurrency(valuation.invested)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Current value</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatCurrency(valuation.currentValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Interest earned</p>
            <p
              className={`text-lg font-semibold ${
                interestEarned >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {formatCurrency(interestEarned)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Interest rate</p>
            <p className="text-lg font-semibold text-slate-900">
              {num(values, "couponRate")}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Maturity date</p>
            <p className="text-lg font-semibold text-slate-900">
              {values.maturityDate ? formatDate(values.maturityDate) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Total return</p>
            <p
              className={`text-lg font-semibold ${
                totalReturn >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {totalReturn.toFixed(2)}%
            </p>
          </div>
        </div>
        <ul className="mt-2 space-y-1 text-xs text-slate-500">
          {valuation.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
