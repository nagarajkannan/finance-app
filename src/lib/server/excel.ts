import writeXlsxFile from "write-excel-file/node";
import type { Row, Sheet } from "write-excel-file/node";
import {
  assetProfitLoss,
  assetProfitLossPercent,
  goalProgress,
  totalOutstanding,
  totalsForAssets,
} from "@/lib/calculations";
import { getCategory } from "@/lib/types";
import type { Asset, Goal, Liability } from "@/lib/types";

/**
 * One workbook with three sheets — Assets, Liabilities and Goals — built from
 * the same records a snapshot freezes, so a saved file and a snapshot taken at
 * the same moment always agree.
 */

const HEADER = {
  fontWeight: "bold",
  backgroundColor: "#e2e8f0",
  align: "left",
} as const;

const MONEY_FORMAT = "#,##0.00";
const PERCENT_FORMAT = "0.00";

function header(labels: string[]): Row {
  return labels.map((value) => ({ value, type: String, ...HEADER }));
}

function money(value: number) {
  return { value: Number.isFinite(value) ? value : 0, type: Number, format: MONEY_FORMAT };
}

function percent(value: number) {
  return {
    value: Number.isFinite(value) ? value : 0,
    type: Number,
    format: PERCENT_FORMAT,
  };
}

function text(value: string) {
  return { value: value || "", type: String };
}

function totalLabel(value: string) {
  return { value, type: String, fontWeight: "bold" } as const;
}

function totalMoney(value: number) {
  return { ...money(value), fontWeight: "bold" } as const;
}

function assetSheet(assets: Asset[]): Sheet<Buffer> {
  const totals = totalsForAssets(assets);
  const data: Row[] = [
    header([
      "Name",
      "Category",
      "Type",
      "Institution",
      "Invested",
      "Current value",
      "Profit / loss",
      "Profit / loss %",
      "Start date",
      "Source",
      "Notes",
    ]),
    ...assets.map((asset) => [
      text(asset.name),
      text(getCategory(asset.categoryId)?.name ?? asset.categoryId),
      text(asset.type),
      text(asset.institution),
      money(asset.investedAmount),
      money(asset.currentValue),
      money(assetProfitLoss(asset)),
      percent(assetProfitLossPercent(asset)),
      text(asset.startDate),
      text(asset.source?.provider ?? "Manual"),
      text(asset.notes),
    ]),
    [
      totalLabel("Total"),
      null,
      null,
      null,
      totalMoney(totals.invested),
      totalMoney(totals.current),
      totalMoney(totals.profitLoss),
      { ...percent(totals.profitLossPercent), fontWeight: "bold" },
    ],
  ];

  return {
    sheet: "Assets",
    data,
    columns: [
      { width: 30 },
      { width: 16 },
      { width: 20 },
      { width: 20 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
      { width: 40 },
    ],
  };
}

function liabilitySheet(liabilities: Liability[]): Sheet<Buffer> {
  const data: Row[] = [
    header([
      "Name",
      "Type",
      "Lender",
      "Original amount",
      "Outstanding",
      "Interest rate %",
      "EMI",
      "Start date",
      "End date",
      "Notes",
    ]),
    ...liabilities.map((liability) => [
      text(liability.name),
      text(liability.type),
      text(liability.lender),
      money(liability.originalAmount),
      money(liability.outstandingAmount),
      percent(liability.interestRate),
      money(liability.emiAmount),
      text(liability.startDate),
      text(liability.endDate),
      text(liability.notes),
    ]),
    [
      totalLabel("Total"),
      null,
      null,
      totalMoney(liabilities.reduce((sum, l) => sum + l.originalAmount, 0)),
      totalMoney(totalOutstanding(liabilities)),
      null,
      totalMoney(liabilities.reduce((sum, l) => sum + l.emiAmount, 0)),
    ],
  ];

  return {
    sheet: "Liabilities",
    data,
    columns: [
      { width: 30 },
      { width: 18 },
      { width: 22 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
      { width: 40 },
    ],
  };
}

function goalSheet(goals: Goal[], assets: Asset[]): Sheet<Buffer> {
  const data: Row[] = [
    header([
      "Goal",
      "Target amount",
      "Current amount",
      "Remaining",
      "Progress %",
      "Target date",
      "Linked assets",
      "Description",
    ]),
    ...goals.map((goal) => {
      const progress = goalProgress(goal, assets);
      return [
        text(goal.name),
        money(goal.targetAmount),
        money(progress.currentAmount),
        money(progress.remainingAmount),
        percent(progress.progressPercent),
        text(goal.targetDate),
        text(progress.linkedAssets.map((asset) => asset.name).join(", ")),
        text(goal.description),
      ];
    }),
  ];

  return {
    sheet: "Goals",
    data,
    columns: [
      { width: 30 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 12 },
      { width: 12 },
      { width: 45 },
      { width: 40 },
    ],
  };
}

export interface ExportRecords {
  assets: Asset[];
  liabilities: Liability[];
  goals: Goal[];
}

export function buildWorkbook(records: ExportRecords): Promise<Buffer> {
  const sheets: Sheet<Buffer>[] = [
    assetSheet(records.assets),
    liabilitySheet(records.liabilities),
    goalSheet(records.goals, records.assets),
  ];
  return writeXlsxFile(sheets).toBuffer();
}

/** IST date and time, so a file saved at 20:00 IST is named for that evening. */
export function exportFileName(capturedAt: Date): string {
  const ist = new Date(capturedAt.getTime() + 330 * 60 * 1000);
  const stamp = ist.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  return `my-money-${stamp}.xlsx`;
}
