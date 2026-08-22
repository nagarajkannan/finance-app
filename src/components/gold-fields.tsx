"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Field, Select, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import {
  GOLD_PURITY_OPTIONS,
  valueGoldAsset,
  type GoldDetails,
  type GoldPurity,
} from "@/lib/gold";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { fetchGoldQuote } from "@/lib/market/client";

export type GoldValues = Record<string, string>;

export function defaultGoldValues(): GoldValues {
  return {
    purity: "22K",
    weightGrams: "",
    purchaseDate: "",
    amountPaid: "",
    makingCharges: "",
    gst: "",
    pricePerGram: "",
    priceUpdatedAt: "",
  };
}

export function goldValuesFromDetails(details: GoldDetails): GoldValues {
  return {
    purity: details.purity,
    weightGrams: String(details.weightGrams ?? ""),
    purchaseDate: details.purchaseDate ?? "",
    amountPaid: String(details.amountPaid ?? ""),
    makingCharges: details.makingCharges ? String(details.makingCharges) : "",
    gst: details.gst ? String(details.gst) : "",
    pricePerGram: details.pricePerGram ? String(details.pricePerGram) : "",
    priceUpdatedAt: details.priceUpdatedAt ?? "",
  };
}

function num(values: GoldValues, key: string): number {
  const parsed = Number(values[key]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildGoldDetails(values: GoldValues): GoldDetails {
  const making = num(values, "makingCharges");
  const gst = num(values, "gst");
  return {
    purity: (values.purity || "22K") as GoldPurity,
    weightGrams: num(values, "weightGrams"),
    purchaseDate: values.purchaseDate ?? "",
    amountPaid: num(values, "amountPaid"),
    ...(making > 0 ? { makingCharges: making } : {}),
    ...(gst > 0 ? { gst } : {}),
    pricePerGram: num(values, "pricePerGram"),
    priceUpdatedAt: values.priceUpdatedAt ?? "",
  };
}

function formatGramPrice(value: number): string {
  if (!(value > 0)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function GoldFields({
  values,
  onPatch,
}: {
  values: GoldValues;
  onPatch: (patch: GoldValues) => void;
}) {
  const [priceError, setPriceError] = useState("");
  const [loadingPrice, setLoadingPrice] = useState(false);
  const onPatchRef = useRef(onPatch);
  useEffect(() => {
    onPatchRef.current = onPatch;
  }, [onPatch]);

  const purity = (values.purity || "22K") as GoldPurity;

  const refreshPrice = useCallback(async (nextPurity: GoldPurity) => {
    setLoadingPrice(true);
    try {
      const quote = await fetchGoldQuote(nextPurity);
      setPriceError("");
      onPatchRef.current({
        pricePerGram: String(quote.pricePerGram),
        priceUpdatedAt: quote.asOf,
      });
    } catch (error) {
      setPriceError(
        error instanceof Error ? error.message : "The gold price lookup failed.",
      );
    } finally {
      setLoadingPrice(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshPrice(purity), 0);
    return () => window.clearTimeout(timer);
  }, [purity, refreshPrice]);

  const details = buildGoldDetails(values);
  const valuation = valueGoldAsset(details);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Each purchase is its own lot. If you buy more gold later, add another
        Physical Gold asset so the amount paid stays correct.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Purity">
          <Select
            value={purity}
            onChange={(e) => onPatch({ purity: e.target.value })}
          >
            {GOLD_PURITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Weight (grams)">
          <TextInput
            type="number"
            min="0"
            step="any"
            value={values.weightGrams ?? ""}
            placeholder="20"
            onChange={(e) => onPatch({ weightGrams: e.target.value })}
          />
        </Field>
        <Field label="Purchase date">
          <TextInput
            type="date"
            value={values.purchaseDate ?? ""}
            onChange={(e) => onPatch({ purchaseDate: e.target.value })}
          />
        </Field>
        <Field label="Amount paid (₹)">
          <TextInput
            type="number"
            min="0"
            step="any"
            value={values.amountPaid ?? ""}
            placeholder="240000"
            onChange={(e) => onPatch({ amountPaid: e.target.value })}
          />
        </Field>
        <Field label="Making charges (₹)" hint="Optional">
          <TextInput
            type="number"
            min="0"
            step="any"
            value={values.makingCharges ?? ""}
            placeholder="0"
            onChange={(e) => onPatch({ makingCharges: e.target.value })}
          />
        </Field>
        <Field label="GST (₹)" hint="Optional">
          <TextInput
            type="number"
            min="0"
            step="any"
            value={values.gst ?? ""}
            placeholder="0"
            onChange={(e) => onPatch({ gst: e.target.value })}
          />
        </Field>
        <Field
          label={`Current ${purity} price / gram`}
          hint={
            values.priceUpdatedAt
              ? `As of ${formatDateTime(values.priceUpdatedAt)}`
              : "Chennai / Tamil Nadu jewellery rate"
          }
        >
          <div className="flex gap-2">
            <TextInput
              readOnly
              value={
                num(values, "pricePerGram") > 0
                  ? formatGramPrice(num(values, "pricePerGram"))
                  : ""
              }
              placeholder="Fetching…"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={loadingPrice}
              onClick={() => void refreshPrice(purity)}
            >
              {loadingPrice ? "…" : "Refresh"}
            </Button>
          </div>
        </Field>
      </div>

      {priceError ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {priceError} You can still save the lot; the metal value will use what
          you paid until a price is available.
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">
          Calculated for you — you do not enter the value today
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Amount paid</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatCurrency(valuation.invested)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Current metal value</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatCurrency(valuation.currentValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Profit / loss</p>
            <p
              className={`text-lg font-semibold ${
                valuation.profit >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {formatCurrency(valuation.profit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Return</p>
            <p
              className={`text-lg font-semibold ${
                valuation.returnPercent >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {valuation.returnPercent.toFixed(2)}%
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
