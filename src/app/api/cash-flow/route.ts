import { NextResponse } from "next/server";
import { isMonth } from "@/lib/cash-flow";
import { db } from "@/lib/db";
import {
  normalizeCashFlowTransaction,
  normalizeSalaryAccount,
} from "@/lib/server/records";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";
import type { CashFlowSummary, CashFlowType } from "@/lib/types";

export const dynamic = "force-dynamic";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function GET(request: Request) {
  try {
    const user = await requireUnlockedUser();
    const requestedMonth =
      new URL(request.url).searchParams.get("month") ?? currentMonth();
    if (!isMonth(requestedMonth)) {
      return NextResponse.json(
        { error: "Month must use the YYYY-MM format." },
        { status: 400 },
      );
    }

    const [account, salaryMonth, records] = await Promise.all([
      db.salaryAccount.findUnique({ where: { userId: user.id } }),
      db.salaryMonth.findUnique({
        where: { userId_month: { userId: user.id, month: requestedMonth } },
      }),
      db.cashFlowTransaction.findMany({
        where: { userId: user.id, month: requestedMonth },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    const transactions = records.map(normalizeCashFlowTransaction);
    const totals: Record<CashFlowType, number> = {
      expense: 0,
      "asset-investment": 0,
      "liability-payment": 0,
    };
    const categoryTotals = new Map<string, number>();

    for (const transaction of transactions) {
      totals[transaction.type] = round(
        totals[transaction.type] + transaction.amount,
      );
      if (transaction.type === "expense") {
        categoryTotals.set(
          transaction.category,
          round(
            (categoryTotals.get(transaction.category) ?? 0) +
              transaction.amount,
          ),
        );
      }
    }

    const income = Number(salaryMonth?.income ?? account?.monthlyIncome ?? 0);
    const allocated = round(
      totals.expense +
        totals["asset-investment"] +
        totals["liability-payment"],
    );
    const response: CashFlowSummary = {
      account: account ? normalizeSalaryAccount(account) : undefined,
      month: requestedMonth,
      income,
      allocated,
      remaining: round(income - allocated),
      totals,
      expenseCategories: [...categoryTotals.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((left, right) => right.amount - left.amount),
      transactions,
    };

    return NextResponse.json(response);
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 },
      )
    );
  }
}
