import type { Asset } from "./types";

export type CompoundingFrequency =
  | "monthly"
  | "quarterly"
  | "half-yearly"
  | "yearly";

export const COMPOUNDING_OPTIONS: {
  value: CompoundingFrequency;
  label: string;
}[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half-yearly", label: "Half yearly" },
  { value: "yearly", label: "Yearly" },
];

export const PERIODS_PER_YEAR: Record<CompoundingFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  "half-yearly": 2,
  yearly: 1,
};

export type TenureUnit = "days" | "months" | "years";

export const TENURE_UNIT_OPTIONS: { value: TenureUnit; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];

export type BondPayout =
  | "monthly"
  | "quarterly"
  | "half-yearly"
  | "yearly"
  | "cumulative";

export type BondInterestType = "fixed" | "floating" | "zero";

export const BOND_PAYOUT_OPTIONS: { value: BondPayout; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half-yearly", label: "Half yearly" },
  { value: "yearly", label: "Yearly" },
  { value: "cumulative", label: "Kept in the bond (cumulative)" },
];

export const BOND_INTEREST_TYPE_OPTIONS: {
  value: BondInterestType;
  label: string;
}[] = [
  { value: "fixed", label: "Fixed" },
  { value: "floating", label: "Floating" },
  { value: "zero", label: "Zero coupon" },
];

/** Tenure entered in days, months or years. */
export interface Tenure {
  tenureValue: number;
  tenureUnit: TenureUnit;
  /** Older assets stored the tenure in months or years. */
  tenureMonths?: number;
  tenureYears?: number;
}

export type DebtDetails =
  | ({
      kind: "fd";
      principal: number;
      annualRate: number;
      compounding: CompoundingFrequency;
      startDate: string;
    } & Tenure)
  | ({
      kind: "rd";
      monthlyDeposit: number;
      annualRate: number;
      compounding: CompoundingFrequency;
      startDate: string;
    } & Tenure)
  | {
      kind: "bond";
      isin?: string;
      instrumentName?: string;
      faceValue: number;
      quantity: number;
      buyPrice: number;
      /** Principal put in. Used when quantity is derived from amount ÷ purchase price. */
      investedAmount?: number;
      couponRate: number;
      interestType?: BondInterestType;
      payout: BondPayout;
      startDate: string;
      maturityDate: string;
      currentPrice?: number;
      priceUpdatedAt?: string;
    }
  | ({
      kind: "govt-scheme";
      contributionType: "lumpsum" | "yearly";
      amount: number;
      annualRate: number;
      startDate: string;
    } & Tenure)
  | {
      kind: "insurance";
      annualPremium: number;
      premiumTermYears: number;
      policyTermYears: number;
      maturityAmount: number;
      startDate: string;
    }
  | {
      kind: "debt-mf";
      units: number;
      buyNav: number;
      currentNav: number;
      startDate: string;
    }
  | ({
      kind: "other-debt";
      principal: number;
      annualRate: number;
      interestType: "simple" | "compound";
      startDate: string;
    } & Tenure);

export type DebtKind = DebtDetails["kind"];

/** Debt asset types that are calculated from how the instrument actually works. */
export const DEBT_KIND_BY_TYPE: Record<string, DebtKind> = {
  "FD / RD": "fd",
  Bonds: "bond",
  "Government Schemes": "govt-scheme",
  Insurance: "insurance",
  "MF / ETF": "debt-mf",
  "Other Debt": "other-debt",
};

export function debtKindForType(
  categoryId: string,
  type: string,
): DebtKind | undefined {
  if (categoryId !== "debt") return undefined;
  return DEBT_KIND_BY_TYPE[type];
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.25;
const MONTHS_PER_YEAR = 12;

const YEARS_PER_UNIT: Record<TenureUnit, number> = {
  days: 1 / DAYS_PER_YEAR,
  months: 1 / MONTHS_PER_YEAR,
  years: 1,
};

/** Tenure in years, falling back to the months / years fields of older assets. */
export function tenureYears(tenure: Tenure): number {
  if (Number.isFinite(tenure.tenureValue) && tenure.tenureValue > 0) {
    return tenure.tenureValue * YEARS_PER_UNIT[tenure.tenureUnit ?? "months"];
  }
  if (tenure.tenureMonths) return tenure.tenureMonths / MONTHS_PER_YEAR;
  if (tenure.tenureYears) return tenure.tenureYears;
  return 0;
}

export function formatTenure(tenure: Tenure): string {
  const years = tenureYears(tenure);
  if (years <= 0) return "no tenure set";
  if (Number.isFinite(tenure.tenureValue) && tenure.tenureValue > 0) {
    return `${tenure.tenureValue} ${tenure.tenureUnit ?? "months"}`;
  }
  if (tenure.tenureMonths) return `${tenure.tenureMonths} months`;
  return `${tenure.tenureYears} years`;
}

function yearsBetween(from: string, to: Date): number {
  if (!from) return 0;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max((to.getTime() - start.getTime()) / MS_PER_DAY / DAYS_PER_YEAR, 0);
}

function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function compoundedValue(
  principal: number,
  annualRate: number,
  frequency: CompoundingFrequency,
  years: number,
): number {
  const periods = PERIODS_PER_YEAR[frequency];
  const rate = annualRate / 100 / periods;
  return principal * (1 + rate) ** (periods * years);
}

function addDays(date: string, days: number): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setDate(parsed.getDate() + Math.round(days));
  return parsed.toISOString().slice(0, 10);
}

/** Maturity date for a tenure entered in days, months or years. */
function maturityDateFor(startDate: string, tenure: Tenure): string {
  return addDays(startDate, tenureYears(tenure) * DAYS_PER_YEAR);
}

export interface DebtValuation {
  /** Money actually put in so far. */
  invested: number;
  /** Value as of today, derived from the instrument's own rules. */
  currentValue: number;
  /** Coupons earned (or accretion) since purchase. */
  interestEarned?: number;
  /** (Current value − invested) ÷ invested. */
  totalReturnPercent?: number;
  /** Value at the end of the tenure, when the instrument has one. */
  maturityValue?: number;
  maturityDate?: string;
  /** Human readable notes shown next to the calculated value. */
  explanation: string[];
}

function bondQuantity(details: Extract<DebtDetails, { kind: "bond" }>): number {
  if (details.quantity > 0) return details.quantity;
  const unit = details.buyPrice > 0 ? details.buyPrice : details.faceValue;
  const invested = details.investedAmount ?? 0;
  if (invested > 0 && unit > 0) return invested / unit;
  return 0;
}

function valueBond(
  details: Extract<DebtDetails, { kind: "bond" }>,
  asOf: Date,
): DebtValuation {
  const quantity = bondQuantity(details);
  const unitCost = details.buyPrice > 0 ? details.buyPrice : details.faceValue;
  const invested = round(
    details.investedAmount && details.investedAmount > 0
      ? details.investedAmount
      : unitCost * quantity,
  );
  const faceTotal = round(details.faceValue * quantity);
  const maturity = details.maturityDate ? new Date(details.maturityDate) : null;
  const end =
    maturity && !Number.isNaN(maturity.getTime()) && maturity < asOf
      ? maturity
      : asOf;
  const elapsed = yearsBetween(details.startDate, end);
  const totalYears = details.maturityDate
    ? Math.max(
        (new Date(details.maturityDate).getTime() -
          new Date(details.startDate || details.maturityDate).getTime()) /
          MS_PER_DAY /
          DAYS_PER_YEAR,
        0,
      )
    : 0;
  const interestType =
    details.interestType ??
    (details.payout === "cumulative" || !(details.couponRate > 0)
      ? "zero"
      : "fixed");
  const unitPrice =
    details.currentPrice && details.currentPrice > 0
      ? details.currentPrice
      : unitCost;
  const marketValue = round(quantity * unitPrice);
  const compounding =
    details.payout === "cumulative" || interestType === "zero";

  let interestEarned = 0;
  let currentValue = marketValue;
  let maturityValue = faceTotal;

  if (compounding) {
    if (details.couponRate > 0 && details.payout === "cumulative") {
      currentValue = round(
        compoundedValue(invested, details.couponRate, "yearly", elapsed),
      );
      maturityValue = round(
        compoundedValue(invested, details.couponRate, "yearly", totalYears),
      );
      if (details.currentPrice && details.currentPrice > 0) {
        currentValue = marketValue;
      }
    } else if (totalYears > 0) {
      const progress = Math.min(elapsed / totalYears, 1);
      currentValue = round(invested + (faceTotal - invested) * progress);
      if (details.currentPrice && details.currentPrice > 0) {
        currentValue = marketValue;
      }
    }
    interestEarned = round(currentValue - invested);
  } else {
    interestEarned = round(faceTotal * (details.couponRate / 100) * elapsed);
    currentValue = round(marketValue + interestEarned);
    maturityValue = faceTotal;
  }

  const totalReturnPercent =
    invested > 0 ? ((currentValue - invested) / invested) * 100 : 0;
  const payoutLabel =
    details.payout === "cumulative" ? "kept in the bond" : `paid ${details.payout}`;

  return {
    invested,
    currentValue,
    interestEarned,
    totalReturnPercent,
    maturityValue,
    maturityDate: details.maturityDate,
    explanation: compounding
      ? [
          `Zero / cumulative: value moves from what you paid towards face value (or compounds at ${details.couponRate}% if a coupon is set).`,
          details.currentPrice && details.currentPrice > 0
            ? `Today's market price of ₹${details.currentPrice} per bond is used when Bond Central / BSE has a quote.`
            : "No live market price yet, so the value is worked out from the coupon and dates.",
        ]
      : [
          `Interest earned = face value × ${details.couponRate}% × years held, ${payoutLabel}.`,
          details.currentPrice && details.currentPrice > 0
            ? `Current value = ${quantity} × ₹${details.currentPrice} (market) + interest earned.`
            : `Current value = amount invested + interest earned so far.`,
        ],
  };
}

export function valueDebtAsset(
  details: DebtDetails,
  asOf: Date = new Date(),
): DebtValuation {
  switch (details.kind) {
    case "fd": {
      const totalYears = tenureYears(details);
      const elapsed = Math.min(yearsBetween(details.startDate, asOf), totalYears);
      const currentValue = compoundedValue(
        details.principal,
        details.annualRate,
        details.compounding,
        elapsed,
      );
      const maturityValue = compoundedValue(
        details.principal,
        details.annualRate,
        details.compounding,
        totalYears,
      );
      return {
        invested: details.principal,
        currentValue,
        maturityValue,
        maturityDate: maturityDateFor(details.startDate, details),
        explanation: [
          `${details.annualRate}% a year, compounded ${details.compounding}.`,
          `${(elapsed * DAYS_PER_YEAR).toFixed(0)} of ${(totalYears * DAYS_PER_YEAR).toFixed(0)} days completed (tenure ${formatTenure(details)}).`,
        ],
      };
    }
    case "rd": {
      const totalYears = tenureYears(details);
      const totalInstallments = Math.max(
        Math.round(totalYears * MONTHS_PER_YEAR),
        0,
      );
      const held = yearsBetween(details.startDate, asOf);
      const elapsedMonths = Math.floor(held * MONTHS_PER_YEAR);
      const installmentsPaid = details.startDate
        ? Math.min(Math.max(elapsedMonths + 1, 0), totalInstallments)
        : 0;
      const periods = PERIODS_PER_YEAR[details.compounding];
      const rate = details.annualRate / 100 / periods;
      let currentValue = 0;
      for (let i = 0; i < installmentsPaid; i += 1) {
        const heldYears = Math.max(held - i / MONTHS_PER_YEAR, 0);
        currentValue += details.monthlyDeposit * (1 + rate) ** (periods * heldYears);
      }
      let maturityValue = 0;
      for (let i = 0; i < totalInstallments; i += 1) {
        const heldYears = (totalInstallments - i) / MONTHS_PER_YEAR;
        maturityValue +=
          details.monthlyDeposit * (1 + rate) ** (periods * heldYears);
      }
      return {
        invested: details.monthlyDeposit * installmentsPaid,
        currentValue,
        maturityValue,
        maturityDate: maturityDateFor(details.startDate, details),
        explanation: [
          `${installmentsPaid} of ${totalInstallments} monthly deposits paid (tenure ${formatTenure(details)}).`,
          `Each deposit earns ${details.annualRate}% a year, compounded ${details.compounding}.`,
        ],
      };
    }
    case "bond":
      return valueBond(details, asOf);
    case "govt-scheme": {
      const totalYears = tenureYears(details);
      const elapsed = Math.min(yearsBetween(details.startDate, asOf), totalYears);
      if (details.contributionType === "lumpsum") {
        return {
          invested: details.amount,
          currentValue: compoundedValue(
            details.amount,
            details.annualRate,
            "yearly",
            elapsed,
          ),
          maturityValue: compoundedValue(
            details.amount,
            details.annualRate,
            "yearly",
            totalYears,
          ),
          maturityDate: maturityDateFor(details.startDate, details),
          explanation: [
            `One time deposit growing at ${details.annualRate}% a year, compounded yearly.`,
            `${(elapsed * DAYS_PER_YEAR).toFixed(0)} of ${(totalYears * DAYS_PER_YEAR).toFixed(0)} days completed (tenure ${formatTenure(details)}).`,
          ],
        };
      }
      const totalContributions = Math.max(Math.ceil(totalYears), 0);
      const contributionsMade = details.startDate
        ? Math.min(Math.floor(elapsed) + 1, totalContributions)
        : 0;
      let currentValue = 0;
      for (let year = 0; year < contributionsMade; year += 1) {
        currentValue += compoundedValue(
          details.amount,
          details.annualRate,
          "yearly",
          Math.max(elapsed - year, 0),
        );
      }
      let maturityValue = 0;
      for (let year = 0; year < totalContributions; year += 1) {
        maturityValue += compoundedValue(
          details.amount,
          details.annualRate,
          "yearly",
          Math.max(totalYears - year, 0),
        );
      }
      return {
        invested: details.amount * contributionsMade,
        currentValue,
        maturityValue,
        maturityDate: maturityDateFor(details.startDate, details),
        explanation: [
          `${contributionsMade} of ${totalContributions} yearly deposits made (tenure ${formatTenure(details)}).`,
          `Balance grows at ${details.annualRate}% a year, compounded yearly.`,
        ],
      };
    }
    case "insurance": {
      const elapsed = Math.min(
        yearsBetween(details.startDate, asOf),
        details.policyTermYears,
      );
      const premiumsPaid = details.startDate
        ? Math.min(Math.floor(elapsed) + 1, details.premiumTermYears)
        : 0;
      const invested = details.annualPremium * premiumsPaid;
      const totalPremiums = details.annualPremium * details.premiumTermYears;
      const growth = details.maturityAmount - totalPremiums;
      const share =
        details.policyTermYears > 0 ? elapsed / details.policyTermYears : 0;
      const currentValue = Math.max(invested + growth * share, 0);
      return {
        invested,
        currentValue,
        maturityValue: details.maturityAmount,
        maturityDate: addDays(
          details.startDate,
          details.policyTermYears * DAYS_PER_YEAR,
        ),
        explanation: [
          `${premiumsPaid} of ${details.premiumTermYears} yearly premiums paid.`,
          `Estimated value moves from premiums paid towards the maturity amount over ${details.policyTermYears} years.`,
        ],
      };
    }
    case "debt-mf": {
      return {
        invested: details.units * details.buyNav,
        currentValue: details.units * details.currentNav,
        explanation: [
          `${details.units} units at a NAV of ${details.currentNav}.`,
          `Bought at an average NAV of ${details.buyNav}.`,
        ],
      };
    }
    case "other-debt": {
      const totalYears = tenureYears(details);
      const elapsed = Math.min(yearsBetween(details.startDate, asOf), totalYears);
      const value = (years: number) =>
        details.interestType === "simple"
          ? details.principal * (1 + (details.annualRate / 100) * years)
          : compoundedValue(details.principal, details.annualRate, "yearly", years);
      return {
        invested: details.principal,
        currentValue: value(elapsed),
        maturityValue: value(totalYears),
        maturityDate: maturityDateFor(details.startDate, details),
        explanation: [
          `${details.annualRate}% a year, ${details.interestType} interest.`,
          `${(elapsed * DAYS_PER_YEAR).toFixed(0)} of ${(totalYears * DAYS_PER_YEAR).toFixed(0)} days completed (tenure ${formatTenure(details)}).`,
        ],
      };
    }
  }
}

export interface DebtFormula {
  title: string;
  /** The formula itself, one line per case. */
  lines: string[];
  /** What each symbol means. */
  where: string[];
}

/** Shown above the inputs so the maths behind each debt type is visible. */
export const DEBT_FORMULAS: Record<DebtKind, DebtFormula> = {
  fd: {
    title: "Fixed deposit",
    lines: [
      "Value today = P × (1 + r/n)^(n × t)",
      "Maturity value = P × (1 + r/n)^(n × T)",
    ],
    where: [
      "P = amount deposited",
      "r = interest rate a year (7% → 0.07)",
      "n = times interest is added a year (quarterly → 4)",
      "t = years completed so far (days ÷ 365.25)",
      "T = full tenure in years",
    ],
  },
  rd: {
    title: "Recurring deposit",
    lines: [
      "Value today = Σ D × (1 + r/n)^(n × tᵢ) for every deposit made",
      "Maturity value = Σ D × (1 + r/n)^(n × (T − i/12)) for all deposits",
    ],
    where: [
      "D = monthly deposit",
      "tᵢ = years the i-th deposit has been held",
      "r, n = rate a year and times interest is added a year",
      "T = full tenure in years",
    ],
  },
  bond: {
    title: "Bond",
    lines: [
      "Interest earned = F × Q × c × t",
      "Current value = Q × P + interest earned (coupons paid out)",
      "Zero / cumulative → value accretes or compounds; live price used when listed",
    ],
    where: [
      "F = face value, Q = number of bonds (amount invested ÷ purchase price)",
      "c = coupon rate a year, t = years from purchase to today (capped at maturity)",
      "P = today's market price from BSE via Bond Central, or the price you paid",
    ],
  },
  "govt-scheme": {
    title: "Government scheme (PPF, NSC, KVP, SSY)",
    lines: [
      "One time deposit → Value today = A × (1 + r)^t",
      "Yearly deposit → Value today = Σ A × (1 + r)^(t − k) for each year k already deposited",
    ],
    where: [
      "A = deposit amount",
      "r = interest rate a year, added yearly",
      "t = years completed so far",
    ],
  },
  insurance: {
    title: "Endowment / traditional policy",
    lines: [
      "Premiums paid = Pr × years of premium paid",
      "Value today = Premiums paid + (M − Pr × N) × t/T",
    ],
    where: [
      "Pr = premium a year, N = years you pay premium",
      "M = guaranteed maturity amount, T = policy term in years",
      "t = years completed so far",
      "This is an estimate — a real surrender value depends on the insurer",
    ],
  },
  "debt-mf": {
    title: "Debt mutual fund / ETF",
    lines: [
      "Value today = Units × NAV today",
      "Money put in = Units × average buy NAV",
    ],
    where: [
      "NAV = net asset value of one unit",
      "Nothing is compounded — the NAV already includes the interest earned",
    ],
  },
  "other-debt": {
    title: "Other debt",
    lines: [
      "Simple → Value today = P × (1 + r × t)",
      "Compound → Value today = P × (1 + r)^t",
    ],
    where: [
      "P = amount lent or invested",
      "r = interest rate a year",
      "t = years completed so far (days ÷ 365.25)",
    ],
  },
};

/** Recomputes invested and current value for assets whose value is calculated. */
export function deriveAsset(asset: Asset, asOf: Date = new Date()): Asset {
  if (!asset.debtDetails) return asset;
  const valuation = valueDebtAsset(asset.debtDetails, asOf);
  return {
    ...asset,
    investedAmount: round(valuation.invested),
    currentValue: round(valuation.currentValue),
  };
}
