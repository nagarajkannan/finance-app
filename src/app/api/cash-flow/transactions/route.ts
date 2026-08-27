import { NextResponse } from "next/server";
import {
  applyAssetInvestment,
  calculateAllocationAmount,
  expenseCategories,
  isMonth,
  type CashFlowTransactionInput,
} from "@/lib/cash-flow";
import { db } from "@/lib/db";
import { deriveAsset } from "@/lib/derive";
import { bondQuote } from "@/lib/market/bonds";
import { fundQuote } from "@/lib/market/funds";
import { goldQuote } from "@/lib/market/gold";
import { stockQuote } from "@/lib/market/stocks";
import {
  normalizeAsset,
  normalizeCashFlowTransaction,
} from "@/lib/server/records";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";
import type { Asset, CashFlowType } from "@/lib/types";
import { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const transactionTypes: CashFlowType[] = [
  "expense",
  "asset-investment",
  "liability-payment",
];

function sanitize(payload: unknown): CashFlowTransactionInput {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Allocation details are required.");
  }

  const value = payload as Record<string, unknown>;
  const type =
    typeof value.type === "string" &&
    transactionTypes.includes(value.type as CashFlowType)
      ? (value.type as CashFlowType)
      : undefined;
  const allocationMode =
    value.allocationMode === "percentage" ? "percentage" : "amount";
  const input: CashFlowTransactionInput = {
    month: typeof value.month === "string" ? value.month : "",
    date: typeof value.date === "string" ? value.date : "",
    type: type ?? "expense",
    category: typeof value.category === "string" ? value.category.trim() : "",
    description:
      typeof value.description === "string" ? value.description.trim() : "",
    allocationMode,
    allocationValue: Number(value.allocationValue),
    targetId:
      typeof value.targetId === "string" ? value.targetId.trim() : undefined,
  };

  if (!type) throw new Error("Choose a valid allocation type.");
  if (!isMonth(input.month)) {
    throw new Error("Month must use the YYYY-MM format.");
  }
  const parsedDate = new Date(`${input.date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== input.date ||
    input.date.slice(0, 7) !== input.month
  ) {
    throw new Error("The transaction date must be inside the selected month.");
  }
  if (
    !(input.allocationValue > 0) ||
    !Number.isFinite(input.allocationValue)
  ) {
    throw new Error("Enter an amount or percentage greater than zero.");
  }
  if (
    input.allocationMode === "percentage" &&
    input.allocationValue > 100
  ) {
    throw new Error("A percentage allocation cannot be greater than 100%.");
  }
  if (
    input.type === "expense" &&
    !expenseCategories.includes(
      input.category as (typeof expenseCategories)[number],
    )
  ) {
    throw new Error("Choose a valid expense category.");
  }
  if (input.type !== "expense" && !input.targetId) {
    throw new Error("Choose the asset or liability to pay.");
  }

  return input;
}

async function latestAssetPrice(asset: Asset) {
  try {
    if (asset.equityDetails?.instrumentId) {
      const details = asset.equityDetails;
      const quote =
        details.kind === "mutual-fund"
          ? await fundQuote(details.instrumentId)
          : await stockQuote(details.instrumentId, details.kind);
      return quote.price;
    }
    if (asset.goldDetails) {
      return (await goldQuote(asset.goldDetails.purity)).pricePerGram;
    }
    if (asset.debtDetails?.kind === "bond" && asset.debtDetails.isin) {
      return (await bondQuote(asset.debtDetails.isin)).price;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function jsonValue(value: object | undefined) {
  return (value ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue;
}

export async function POST(request: Request) {
  try {
    const user = await requireUnlockedUser();
    const input = sanitize(await request.json());
    const [account, sourceAsset] = await Promise.all([
      db.salaryAccount.findUnique({ where: { userId: user.id } }),
      input.type === "asset-investment" && input.targetId
        ? db.asset.findFirst({
            where: { id: input.targetId, userId: user.id },
          })
        : Promise.resolve(null),
    ]);

    if (!account) {
      throw new Error("Set up your salary account before allocating money.");
    }
    if (input.type === "asset-investment" && !sourceAsset) {
      throw new Error("Asset not found.");
    }

    const marketPrice = sourceAsset
      ? await latestAssetPrice(normalizeAsset(sourceAsset))
      : undefined;

    const record = await db.$transaction(
      async (tx) => {
        const salaryMonth = await tx.salaryMonth.upsert({
          where: {
            userId_month: { userId: user.id, month: input.month },
          },
          create: {
            userId: user.id,
            month: input.month,
            income: account.monthlyIncome,
          },
          update: {},
        });
        const amount = calculateAllocationAmount(
          Number(salaryMonth.income),
          input.allocationMode,
          input.allocationValue,
        );
        const allocated = await tx.cashFlowTransaction.aggregate({
          where: { userId: user.id, month: input.month },
          _sum: { amount: true },
        });
        const remaining =
          Number(salaryMonth.income) - Number(allocated._sum.amount ?? 0);
        if (!(amount > 0)) throw new Error("The allocation amount is zero.");
        if (amount > remaining + 0.001) {
          throw new Error(
            `Only ₹${Math.max(remaining, 0).toFixed(2)} remains for this month.`,
          );
        }

        let targetId: string | undefined;
        let targetName: string | undefined;
        let quantityAdded: number | undefined;
        let quantityUnit: string | undefined;
        let pricePerUnit: number | undefined;
        let assetValueBefore: number | undefined;
        let assetValueAfter: number | undefined;
        let liabilityOutstandingBefore: number | undefined;
        let liabilityOutstandingAfter: number | undefined;
        let calculation = `₹${amount.toFixed(2)} recorded under ${input.category}.`;

        if (input.type === "asset-investment" && input.targetId) {
          const owned = await tx.asset.findFirst({
            where: { id: input.targetId, userId: user.id },
          });
          if (!owned) throw new Error("Asset not found.");

          const before = deriveAsset(normalizeAsset(owned));
          const investment = applyAssetInvestment(
            before,
            amount,
            marketPrice,
          );
          await tx.asset.update({
            where: { id: owned.id },
            data: {
              investedAmount: investment.asset.investedAmount,
              currentValue: investment.asset.currentValue,
              debtDetails: jsonValue(investment.asset.debtDetails),
              equityDetails: jsonValue(investment.asset.equityDetails),
              goldDetails: jsonValue(investment.asset.goldDetails),
            },
          });

          targetId = owned.id;
          targetName = owned.name;
          quantityAdded = investment.quantityAdded;
          quantityUnit = investment.quantityUnit;
          pricePerUnit = investment.pricePerUnit;
          assetValueBefore = before.currentValue;
          assetValueAfter = investment.asset.currentValue;
          calculation = investment.calculation;
        }

        if (input.type === "liability-payment" && input.targetId) {
          const liability = await tx.liability.findFirst({
            where: { id: input.targetId, userId: user.id },
          });
          if (!liability) throw new Error("Liability not found.");

          const outstanding = Number(liability.outstandingAmount);
          if (amount > outstanding + 0.001) {
            throw new Error(
              `The payment cannot exceed the ₹${outstanding.toFixed(2)} outstanding balance.`,
            );
          }
          const updatedOutstanding = Math.max(outstanding - amount, 0);
          await tx.liability.update({
            where: { id: liability.id },
            data: { outstandingAmount: updatedOutstanding },
          });

          targetId = liability.id;
          targetName = liability.name;
          liabilityOutstandingBefore = outstanding;
          liabilityOutstandingAfter = updatedOutstanding;
          calculation = `Outstanding balance reduced from ₹${outstanding.toFixed(2)} to ₹${updatedOutstanding.toFixed(2)}.`;
        }

        return tx.cashFlowTransaction.create({
          data: {
            userId: user.id,
            month: input.month,
            date: input.date,
            type: input.type,
            category:
              input.type === "expense"
                ? input.category
                : input.type === "asset-investment"
                  ? "Investment"
                  : "Debt repayment",
            description: input.description,
            amount,
            allocationMode: input.allocationMode,
            allocationValue: input.allocationValue,
            targetId,
            targetName,
            quantityAdded,
            quantityUnit,
            pricePerUnit,
            assetValueBefore,
            assetValueAfter,
            liabilityOutstandingBefore,
            liabilityOutstandingAfter,
            calculation,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(normalizeCashFlowTransaction(record), {
      status: 201,
    });
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
