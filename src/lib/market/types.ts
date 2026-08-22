/** Instruments the market lookup can search for. */
export type InstrumentKind = "mutual-fund" | "stock" | "etf" | "bond";

/** One row in the fund / stock dropdown. */
export interface InstrumentOption {
  kind: InstrumentKind;
  /** Scheme code for funds, exchange symbol (RELIANCE.NS) for stocks and ETFs. */
  id: string;
  name: string;
  /** Fund house, the exchange a stock trades on, or bond coupon / maturity. */
  detail: string;
}

/** Latest price for one instrument: NAV for funds, last traded price otherwise. */
export interface InstrumentQuote {
  kind: InstrumentKind;
  id: string;
  name: string;
  detail: string;
  price: number;
  /** When the price was published (NAV date) or fetched. */
  asOf: string;
}
