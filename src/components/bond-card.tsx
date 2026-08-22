"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { valueDebtAsset } from "@/lib/debt";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { fetchQuote } from "@/lib/market/client";
import type { BondQuote } from "@/lib/market/bonds";
import { useStore } from "@/lib/store";
import type { Asset } from "@/lib/types";

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

function Row({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
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

export function BondCard({ asset }: { asset: Asset }) {
  const { updateAsset } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const details = asset.debtDetails?.kind === "bond" ? asset.debtDetails : undefined;
  const assetId = asset.id;

  const refresh = useCallback(async () => {
    if (!details?.isin) return;
    setRefreshing(true);
    try {
      const quote = (await fetchQuote("bond", details.isin)) as BondQuote;
      const updated = {
        ...details,
        instrumentName: quote.name || details.instrumentName,
        couponRate: quote.couponRate || details.couponRate,
        interestType: quote.interestType || details.interestType,
        payout: quote.frequency || details.payout,
        faceValue: quote.faceValue || details.faceValue,
        maturityDate: quote.maturityDate || details.maturityDate,
        currentPrice: quote.price > 0 ? quote.price : details.currentPrice,
        priceUpdatedAt: quote.price > 0 ? quote.asOf : details.priceUpdatedAt,
      };
      const valuation = valueDebtAsset(updated);
      await updateAsset(assetId, {
        name: updated.instrumentName || asset.name,
        debtDetails: updated,
        investedAmount: valuation.invested,
        currentValue: valuation.currentValue,
      });
      setError("");
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "The bond price could not be refreshed.",
      );
    } finally {
      setRefreshing(false);
    }
  }, [asset.name, assetId, details, updateAsset]);

  const priceUpdatedAt = details?.priceUpdatedAt ?? "";
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!details?.isin) return;
    const last = priceUpdatedAt ? Date.parse(priceUpdatedAt) : 0;
    if (Date.now() - last < STALE_AFTER_MS) return;
    const timer = window.setTimeout(() => void refreshRef.current(), 0);
    return () => window.clearTimeout(timer);
  }, [details?.isin, priceUpdatedAt]);

  if (!details) return null;

  const valuation = valueDebtAsset(details);
  const interestEarned =
    valuation.interestEarned ?? valuation.currentValue - valuation.invested;
  const totalReturn = valuation.totalReturnPercent ?? 0;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {details.instrumentName || asset.name}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {details.isin ? `${details.isin} · ` : ""}
            value today is the market price plus interest earned since you
            bought it
            {priceUpdatedAt
              ? `, last fetched ${formatDateTime(priceUpdatedAt)}`
              : ""}
            .
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => void refresh()}
          disabled={refreshing || !details.isin}
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
        <Row label="Invested amount" value={formatCurrency(valuation.invested)} />
        <Row label="Current value" value={formatCurrency(valuation.currentValue)} />
        <Row
          label="Interest earned"
          value={formatCurrency(interestEarned)}
          tone={interestEarned >= 0 ? "positive" : "negative"}
        />
        <Row label="Interest rate" value={`${details.couponRate}%`} />
        <Row
          label="Maturity date"
          value={details.maturityDate ? formatDate(details.maturityDate) : "—"}
        />
        <Row
          label="Total return"
          value={`${totalReturn.toFixed(2)}%`}
          tone={totalReturn >= 0 ? "positive" : "negative"}
        />
        <Row
          label="Current market price"
          value={
            details.currentPrice && details.currentPrice > 0
              ? formatCurrency(details.currentPrice)
              : "—"
          }
        />
        <Row
          label="Last price updated"
          value={priceUpdatedAt ? formatDate(priceUpdatedAt) : "—"}
        />
        <Row
          label="Face value"
          value={details.faceValue ? formatCurrency(details.faceValue) : "—"}
        />
      </div>
    </Card>
  );
}
