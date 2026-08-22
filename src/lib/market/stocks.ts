import type { InstrumentKind, InstrumentOption, InstrumentQuote } from "./types";

const SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search";
const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

/** Yahoo answers with 429 to the default fetch agent. */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

interface SearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
  exchDisp?: string;
}

interface ChartResponse {
  chart?: {
    result?: {
      meta?: {
        symbol?: string;
        longName?: string;
        shortName?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        instrumentType?: string;
        fullExchangeName?: string;
      };
    }[];
    error?: { description?: string };
  };
}

/** Only Indian listings are useful here: NSE symbols end in .NS, BSE ones in .BO. */
function isIndian(symbol: string): boolean {
  return symbol.endsWith(".NS") || symbol.endsWith(".BO");
}

/**
 * Yahoo lists NSE/BSE ETFs as EQUITY, not ETF. Names and tickers still say
 * ETF / BeES, so those are what we use to tell them apart from shares.
 */
const ETF_TEXT = /\bETF\b|BEES|EXCHANGE[\s-]?TRADED/i;

function looksLikeEtf(quote: SearchQuote & { symbol: string }): boolean {
  if (quote.quoteType === "ETF") return true;
  return ETF_TEXT.test(
    [quote.symbol, quote.shortname, quote.longname].filter(Boolean).join(" "),
  );
}

function kindOf(quote: SearchQuote & { symbol: string }): InstrumentKind {
  return looksLikeEtf(quote) ? "etf" : "stock";
}

async function yahooQuotes(query: string, limit: number): Promise<SearchQuote[]> {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&quotesCount=${limit}&newsCount=0`;
  const response = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`The symbol search failed (${response.status}).`);
  }
  const body = (await response.json()) as { quotes?: SearchQuote[] };
  return body.quotes ?? [];
}

export async function searchStocks(
  query: string,
  kind: InstrumentKind,
  limit = 25,
): Promise<InstrumentOption[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const searches = [trimmed];
  if (kind === "etf" && !ETF_TEXT.test(trimmed)) {
    searches.push(`${trimmed} ETF`);
  }

  const seen = new Set<string>();
  const quotes: (SearchQuote & { symbol: string })[] = [];
  for (const term of searches) {
    for (const quote of await yahooQuotes(term, limit)) {
      if (
        !quote.symbol ||
        seen.has(quote.symbol) ||
        !isIndian(quote.symbol) ||
        !["EQUITY", "ETF"].includes(quote.quoteType ?? "")
      ) {
        continue;
      }
      seen.add(quote.symbol);
      quotes.push(quote as SearchQuote & { symbol: string });
    }
  }

  return quotes
    .map((quote) => ({
      kind: kindOf(quote),
      id: quote.symbol,
      name: quote.longname ?? quote.shortname ?? quote.symbol,
      detail: quote.exchDisp ?? quote.exchange ?? "",
    }))
    .filter((option) => option.kind === kind)
    .slice(0, limit);
}

export async function stockQuote(
  symbol: string,
  kind: InstrumentKind,
): Promise<InstrumentQuote> {
  const url = `${CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const response = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No live price came back for ${symbol} (${response.status}).`);
  }

  const body = (await response.json()) as ChartResponse;
  const meta = body.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number") {
    throw new Error(
      body.chart?.error?.description ?? `No live price is available for ${symbol}.`,
    );
  }

  return {
    kind,
    id: meta?.symbol ?? symbol,
    name: meta?.longName ?? meta?.shortName ?? symbol,
    detail: meta?.fullExchangeName ?? "",
    price,
    asOf: meta?.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
  };
}
