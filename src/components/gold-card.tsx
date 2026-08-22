"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { valueGoldAsset } from "@/lib/gold";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { fetchGoldQuote } from "@/lib/market/client";
import { useStore } from "@/lib/store";
import type { Asset } from "@/lib/types";

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`text-sm font-medium ${
          tone === "positive"
            ? "text-emerald-600"
            : tone === "negative"
              ? "text-rose-600"
              : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatGramPrice(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function GoldCard({ asset }: { asset: Asset }) {
  const { updateAsset } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const details = asset.goldDetails;
  const assetId = asset.id;

  const refresh = useCallback(async () => {
    if (!details) return;
    setRefreshing(true);
    try {
      const quote = await fetchGoldQuote(details.purity);
      const updated = {
        ...details,
        pricePerGram: quote.pricePerGram,
        priceUpdatedAt: quote.asOf,
      };
      const valuation = valueGoldAsset(updated);
      await updateAsset(assetId, {
        goldDetails: updated,
        investedAmount: valuation.invested,
        currentValue: valuation.currentValue,
      });
      setError("");
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "The gold price could not be refreshed.",
      );
    } finally {
      setRefreshing(false);
    }
  }, [assetId, details, updateAsset]);

  const priceUpdatedAt = details?.priceUpdatedAt ?? "";
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!details) return;
    const last = priceUpdatedAt ? Date.parse(priceUpdatedAt) : 0;
    if (Date.now() - last < STALE_AFTER_MS) return;
    const timer = window.setTimeout(() => void refreshRef.current(), 0);
    return () => window.clearTimeout(timer);
  }, [details, priceUpdatedAt]);

  if (!details) return null;

  const valuation = valueGoldAsset(details);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Physical gold</h2>
          <p className="mt-1 text-sm text-slate-500">
            Metal value is {details.weightGrams} g × today&apos;s {details.purity}{" "}
            Chennai / India jewellery rate. GST and making charges are extra, and
            buyback can be lower
            {priceUpdatedAt
              ? `, last fetched ${formatDateTime(priceUpdatedAt)}`
              : ""}
            .
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh price"}
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Row label="Purity" value={details.purity} />
        <Row label="Weight" value={`${details.weightGrams} g`} />
        <Row
          label="Purchase date"
          value={details.purchaseDate ? formatDate(details.purchaseDate) : "—"}
        />
        <Row label="Amount paid" value={formatCurrency(valuation.invested)} />
        <Row
          label={`Current ${details.purity} price / g`}
          value={
            details.pricePerGram > 0
              ? formatGramPrice(details.pricePerGram)
              : "—"
          }
        />
        <Row label="Current metal value" value={formatCurrency(valuation.currentValue)} />
        <Row
          label="Profit / loss"
          value={formatCurrency(valuation.profit)}
          tone={valuation.profit >= 0 ? "positive" : "negative"}
        />
        <Row
          label="Return"
          value={`${valuation.returnPercent.toFixed(2)}%`}
          tone={valuation.returnPercent >= 0 ? "positive" : "negative"}
        />
        {details.makingCharges ? (
          <Row
            label="Making charges"
            value={formatCurrency(details.makingCharges)}
          />
        ) : null}
        {details.gst ? (
          <Row label="GST" value={formatCurrency(details.gst)} />
        ) : null}
      </div>
    </Card>
  );
}
