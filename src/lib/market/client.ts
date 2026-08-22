"use client";

import type { InstrumentKind, InstrumentOption, InstrumentQuote } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok || body === null) {
    throw new Error(body?.error ?? "The market lookup failed.");
  }
  return body;
}

export async function searchInstruments(
  kind: InstrumentKind,
  query: string,
): Promise<InstrumentOption[]> {
  const { results } = await getJson<{ results: InstrumentOption[] }>(
    `/api/market/search?kind=${kind}&q=${encodeURIComponent(query)}`,
  );
  return results;
}

export async function fetchQuote(
  kind: InstrumentKind,
  id: string,
): Promise<InstrumentQuote> {
  return getJson<InstrumentQuote>(
    `/api/market/quote?kind=${kind}&id=${encodeURIComponent(id)}`,
  );
}

export async function fetchGoldQuote(purity: string): Promise<{
  purity: string;
  pricePerGram: number;
  asOf: string;
  market?: string;
}> {
  return getJson(`/api/market/gold?purity=${encodeURIComponent(purity)}`);
}
