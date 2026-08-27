import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeSalaryAccount } from "@/lib/server/records";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

interface AccountInput {
  accountName: string;
  accountLast4: string;
  monthlyIncome: number;
  salaryCreditDay: number;
}

function sanitize(payload: unknown): AccountInput {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Salary account details are required.");
  }

  const value = payload as Record<string, unknown>;
  const accountName =
    typeof value.accountName === "string" ? value.accountName.trim() : "";
  const accountLast4 =
    typeof value.accountLast4 === "string"
      ? value.accountLast4.replace(/\D/g, "").slice(-4)
      : "";
  const monthlyIncome = Number(value.monthlyIncome);
  const salaryCreditDay = Math.trunc(Number(value.salaryCreditDay));

  if (!accountName) throw new Error("Enter a name for the salary account.");
  if (accountLast4.length !== 4) {
    throw new Error("Enter the last four digits of the account number.");
  }
  if (!(monthlyIncome > 0) || !Number.isFinite(monthlyIncome)) {
    throw new Error("Monthly income must be greater than zero.");
  }
  if (salaryCreditDay < 1 || salaryCreditDay > 31) {
    throw new Error("Salary credit day must be between 1 and 31.");
  }

  return {
    accountName,
    accountLast4,
    monthlyIncome,
    salaryCreditDay,
  };
}

export async function PUT(request: Request) {
  try {
    const user = await requireUnlockedUser();
    const input = sanitize(await request.json());
    const account = await db.salaryAccount.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...input },
      update: input,
    });

    return NextResponse.json(normalizeSalaryAccount(account));
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
