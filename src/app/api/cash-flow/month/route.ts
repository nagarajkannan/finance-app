import { NextResponse } from "next/server";
import { isMonth } from "@/lib/cash-flow";
import { db } from "@/lib/db";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const user = await requireUnlockedUser();
    const payload = (await request.json()) as Record<string, unknown>;
    const month = typeof payload.month === "string" ? payload.month : "";
    const income = Number(payload.income);

    if (!isMonth(month)) {
      throw new Error("Month must use the YYYY-MM format.");
    }
    if (!(income > 0) || !Number.isFinite(income)) {
      throw new Error("Income must be greater than zero.");
    }

    const allocated = await db.cashFlowTransaction.aggregate({
      where: { userId: user.id, month },
      _sum: { amount: true },
    });
    if (income < Number(allocated._sum.amount ?? 0)) {
      throw new Error(
        "Income cannot be lower than the money already allocated this month.",
      );
    }

    const record = await db.salaryMonth.upsert({
      where: { userId_month: { userId: user.id, month } },
      create: { userId: user.id, month, income },
      update: { income },
    });

    return NextResponse.json({ month: record.month, income: record.income });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 400 },
      )
    );
  }
}
