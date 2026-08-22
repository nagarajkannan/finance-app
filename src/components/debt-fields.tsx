"use client";

import { BondFields } from "@/components/bond-fields";
import { Field, Select, TextInput } from "@/components/form";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  COMPOUNDING_OPTIONS,
  DEBT_FORMULAS,
  TENURE_UNIT_OPTIONS,
  valueDebtAsset,
  type BondInterestType,
  type BondPayout,
  type CompoundingFrequency,
  type DebtDetails,
  type DebtKind,
  type TenureUnit,
} from "@/lib/debt";

export type DebtValues = Record<string, string>;

interface FieldSpec {
  key: string;
  label: string;
  hint?: string;
  input: "number" | "date" | "select" | "tenure";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

/** Amount plus a days / months / years unit, kept in `tenureValue` + `tenureUnit`. */
function tenureField(label: string): FieldSpec {
  return { key: "tenureValue", label, input: "tenure" };
}

const compoundingField: FieldSpec = {
  key: "compounding",
  label: "Interest is added",
  hint: "How often the bank compounds",
  input: "select",
  options: COMPOUNDING_OPTIONS,
};

/** Inputs that describe how each debt instrument actually works. */
export const DEBT_FIELDS: Record<DebtKind, FieldSpec[]> = {
  fd: [
    { key: "principal", label: "Amount deposited (₹)", input: "number" },
    {
      key: "annualRate",
      label: "Interest rate (% a year)",
      input: "number",
      placeholder: "7.1",
    },
    compoundingField,
    { key: "startDate", label: "Deposit date", input: "date" },
    tenureField("Tenure"),
  ],
  rd: [
    { key: "monthlyDeposit", label: "Monthly deposit (₹)", input: "number" },
    {
      key: "annualRate",
      label: "Interest rate (% a year)",
      input: "number",
      placeholder: "6.5",
    },
    compoundingField,
    { key: "startDate", label: "First deposit date", input: "date" },
    tenureField("Tenure"),
  ],
  bond: [],
  "govt-scheme": [
    {
      key: "contributionType",
      label: "How you deposit",
      input: "select",
      options: [
        { value: "lumpsum", label: "One time (NSC, KVP)" },
        { value: "yearly", label: "Every year (PPF, SSY)" },
      ],
    },
    { key: "amount", label: "Deposit amount (₹)", input: "number" },
    {
      key: "annualRate",
      label: "Interest rate (% a year)",
      input: "number",
      placeholder: "7.1",
    },
    { key: "startDate", label: "Started on", input: "date" },
    tenureField("Tenure"),
  ],
  insurance: [
    { key: "annualPremium", label: "Premium a year (₹)", input: "number" },
    {
      key: "premiumTermYears",
      label: "Years you pay premium",
      input: "number",
    },
    { key: "policyTermYears", label: "Policy term (years)", input: "number" },
    {
      key: "maturityAmount",
      label: "Amount you get at maturity (₹)",
      hint: "Guaranteed maturity benefit",
      input: "number",
    },
    { key: "startDate", label: "Policy start date", input: "date" },
  ],
  "debt-mf": [
    { key: "units", label: "Units held", input: "number" },
    { key: "buyNav", label: "Average buy NAV (₹)", input: "number" },
    { key: "currentNav", label: "Today's NAV (₹)", input: "number" },
    { key: "startDate", label: "Bought on", input: "date" },
  ],
  "other-debt": [
    { key: "principal", label: "Amount lent / invested (₹)", input: "number" },
    { key: "annualRate", label: "Interest rate (% a year)", input: "number" },
    {
      key: "interestType",
      label: "Interest type",
      input: "select",
      options: [
        { value: "compound", label: "Compound" },
        { value: "simple", label: "Simple" },
      ],
    },
    { key: "startDate", label: "Started on", input: "date" },
    tenureField("Tenure"),
  ],
};

export function defaultDebtValues(kind: DebtKind): DebtValues {
  const values: DebtValues = {};
  for (const field of DEBT_FIELDS[kind]) {
    values[field.key] =
      field.input === "select" ? (field.options?.[0]?.value ?? "") : "";
    if (field.input === "tenure") {
      values.tenureUnit = kind === "govt-scheme" ? "years" : "months";
    }
  }
  if (kind === "fd" || kind === "rd") values.compounding = "quarterly";
  if (kind === "bond") {
    values.interestType = "fixed";
    values.payout = "yearly";
    values.faceValue = "1000";
  }
  return values;
}

export function debtValuesFromDetails(details: DebtDetails): DebtValues {
  const values: DebtValues = {};
  for (const [key, value] of Object.entries(details)) {
    if (key === "kind") continue;
    values[key] = String(value);
  }
  // Assets saved before tenure units existed kept only months or years.
  if (!values.tenureValue || values.tenureValue === "0") {
    if (values.tenureMonths && values.tenureMonths !== "0") {
      values.tenureValue = values.tenureMonths;
      values.tenureUnit = "months";
    } else if (values.tenureYears && values.tenureYears !== "0") {
      values.tenureValue = values.tenureYears;
      values.tenureUnit = "years";
    }
  }
  return values;
}

function tenure(values: DebtValues) {
  return {
    tenureValue: num(values, "tenureValue"),
    tenureUnit: (values.tenureUnit ?? "months") as TenureUnit,
  };
}

function num(values: DebtValues, key: string): number {
  const parsed = Number(values[key]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildDebtDetails(
  kind: DebtKind,
  values: DebtValues,
): DebtDetails {
  switch (kind) {
    case "fd":
      return {
        kind,
        principal: num(values, "principal"),
        annualRate: num(values, "annualRate"),
        compounding: (values.compounding ?? "quarterly") as CompoundingFrequency,
        startDate: values.startDate ?? "",
        ...tenure(values),
      };
    case "rd":
      return {
        kind,
        monthlyDeposit: num(values, "monthlyDeposit"),
        annualRate: num(values, "annualRate"),
        compounding: (values.compounding ?? "quarterly") as CompoundingFrequency,
        startDate: values.startDate ?? "",
        ...tenure(values),
      };
    case "bond": {
      const buyPrice = num(values, "buyPrice");
      const invested = num(values, "investedAmount");
      const quantity =
        num(values, "quantity") > 0
          ? num(values, "quantity")
          : buyPrice > 0 && invested > 0
            ? invested / buyPrice
            : 0;
      return {
        kind,
        isin: values.isin ?? "",
        instrumentName: values.instrumentName ?? "",
        faceValue: num(values, "faceValue"),
        quantity,
        buyPrice,
        investedAmount: invested,
        couponRate: num(values, "couponRate"),
        interestType: (values.interestType || "fixed") as BondInterestType,
        payout: (values.payout ?? "yearly") as BondPayout,
        startDate: values.startDate ?? "",
        maturityDate: values.maturityDate ?? "",
        currentPrice: num(values, "currentPrice"),
        priceUpdatedAt: values.priceUpdatedAt ?? "",
      };
    }
    case "govt-scheme":
      return {
        kind,
        contributionType: (values.contributionType ?? "lumpsum") as
          | "lumpsum"
          | "yearly",
        amount: num(values, "amount"),
        annualRate: num(values, "annualRate"),
        startDate: values.startDate ?? "",
        ...tenure(values),
      };
    case "insurance":
      return {
        kind,
        annualPremium: num(values, "annualPremium"),
        premiumTermYears: num(values, "premiumTermYears"),
        policyTermYears: num(values, "policyTermYears"),
        maturityAmount: num(values, "maturityAmount"),
        startDate: values.startDate ?? "",
      };
    case "debt-mf":
      return {
        kind,
        units: num(values, "units"),
        buyNav: num(values, "buyNav"),
        currentNav: num(values, "currentNav"),
        startDate: values.startDate ?? "",
      };
    case "other-debt":
      return {
        kind,
        principal: num(values, "principal"),
        annualRate: num(values, "annualRate"),
        interestType: (values.interestType ?? "compound") as
          | "simple"
          | "compound",
        startDate: values.startDate ?? "",
        ...tenure(values),
      };
  }
}

/** Shows the maths used for this debt type, above the inputs. */
export function DebtFormulaPanel({
  kind,
  defaultOpen = false,
}: {
  kind: DebtKind;
  defaultOpen?: boolean;
}) {
  const formula = DEBT_FORMULAS[kind];
  return (
    <details
      open={defaultOpen}
      className="rounded-xl border border-slate-200 bg-white p-4 [&_summary]:list-none"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-slate-700">
        <span>How is this calculated? — {formula.title} formula</span>
        <span className="text-xs text-slate-400">show / hide</span>
      </summary>
      <div className="mt-3 space-y-3">
        <div className="space-y-1">
          {formula.lines.map((line) => (
            <p
              key={line}
              className="rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100"
            >
              {line}
            </p>
          ))}
        </div>
        <ul className="space-y-1 text-xs text-slate-500">
          {formula.where.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export function DebtFields({
  kind,
  values,
  onChange,
}: {
  kind: DebtKind;
  values: DebtValues;
  onChange: (key: string, value: string) => void;
}) {
  if (kind === "bond") {
    return <BondFields values={values} onChange={onChange} />;
  }

  const details = buildDebtDetails(kind, values);
  const valuation = valueDebtAsset(details);
  const profit = valuation.currentValue - valuation.invested;

  return (
    <div className="space-y-4">
      <DebtFormulaPanel kind={kind} />

      <div className="grid gap-4 sm:grid-cols-2">
        {DEBT_FIELDS[kind].map((field) => (
          <Field key={field.key} label={field.label} hint={field.hint}>
            {field.input === "tenure" ? (
              <div className="flex gap-2">
                <TextInput
                  type="number"
                  min="0"
                  step="any"
                  value={values.tenureValue ?? ""}
                  placeholder="0"
                  onChange={(e) => onChange("tenureValue", e.target.value)}
                />
                <Select
                  className="w-36"
                  value={values.tenureUnit ?? "months"}
                  onChange={(e) => onChange("tenureUnit", e.target.value)}
                >
                  {TENURE_UNIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : field.input === "select" ? (
              <Select
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                type={field.input}
                min={field.input === "number" ? "0" : undefined}
                step={field.input === "number" ? "any" : undefined}
                value={values[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
          </Field>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">
          Calculated for you — you do not enter the value today
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Money put in so far</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatCurrency(valuation.invested)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Value today</p>
            <p className="text-lg font-semibold text-slate-900">
              {formatCurrency(valuation.currentValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Interest earned so far</p>
            <p
              className={`text-lg font-semibold ${
                profit >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {formatCurrency(profit)}
            </p>
          </div>
        </div>
        {valuation.maturityValue !== undefined ? (
          <p className="mt-3 text-sm text-slate-600">
            At maturity{valuation.maturityDate ? ` on ${formatDate(valuation.maturityDate)}` : ""}:{" "}
            <span className="font-medium text-slate-900">
              {formatCurrency(valuation.maturityValue)}
            </span>
          </p>
        ) : null}
        <ul className="mt-2 space-y-1 text-xs text-slate-500">
          {valuation.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
