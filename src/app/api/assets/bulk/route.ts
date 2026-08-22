import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeAsset } from "@/lib/server/records";
import { Prisma } from "@/generated/prisma/client";
import type { Asset } from "@/lib/types";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function assetData(asset: Asset) {
  return {
    name: asset.name ?? "",
    categoryId: asset.categoryId ?? "other",
    type: asset.type ?? "",
    institution: asset.institution ?? "",
    investedAmount: Number(asset.investedAmount ?? 0),
    currentValue: Number(asset.currentValue ?? 0),
    startDate: asset.startDate ?? "",
    notes: asset.notes ?? "",
    debtDetails: (asset.debtDetails ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
    equityDetails: (asset.equityDetails ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
    goldDetails: (asset.goldDetails ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
    source: (asset.source ?? Prisma.DbNull) as unknown as Prisma.InputJsonValue,
  };
}

/** Saves a whole merged asset list at once, which is what a Groww sync or a file import produces. */
export async function POST(request: Request) {
  try {
    const user = await requireUnlockedUser();
    const body = (await request.json()) as { assets?: unknown };

    if (!Array.isArray(body.assets)) {
      throw new Error("Expected an array of assets.");
    }

    const assets = body.assets as Asset[];
    const owned = new Set(
      (
        await db.asset.findMany({
          where: { userId: user.id },
          select: { id: true },
        })
      ).map((asset) => asset.id),
    );

    await db.$transaction(
      assets.map((asset) => {
        const data = assetData(asset);
        return owned.has(asset.id)
          ? db.asset.update({ where: { id: asset.id }, data })
          : db.asset.create({
              data: {
                id: asset.id,
                userId: user.id,
                ...data,
                createdAt: new Date(asset.createdAt ?? Date.now()),
              },
            });
      }),
    );

    const records = await db.asset.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(records.map(normalizeAsset));
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
