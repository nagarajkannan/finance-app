import { NextResponse } from "next/server";
import type { Asset, AssetCategoryId } from "@/lib/types";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeAsset } from "@/lib/server/records";
import { unlinkAssetFromGoals } from "@/lib/server/goal-links";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function sanitizeAssetInput(payload: unknown): Partial<Asset> {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Asset payload must be an object.");
  }

  const value = payload as Record<string, unknown>;

  return {
    name: typeof value.name === "string" ? value.name : undefined,
    categoryId: typeof value.categoryId === "string" ? (value.categoryId as AssetCategoryId) : undefined,
    type: typeof value.type === "string" ? value.type : undefined,
    institution: typeof value.institution === "string" ? value.institution : undefined,
    investedAmount: value.investedAmount !== undefined ? Number(value.investedAmount) : undefined,
    currentValue: value.currentValue !== undefined ? Number(value.currentValue) : undefined,
    startDate: typeof value.startDate === "string" ? value.startDate : undefined,
    notes: typeof value.notes === "string" ? value.notes : undefined,
    debtDetails: value.debtDetails !== undefined ? (value.debtDetails as Asset["debtDetails"]) : undefined,
    equityDetails:
      value.equityDetails !== undefined
        ? (value.equityDetails as Asset["equityDetails"])
        : undefined,
    goldDetails:
      value.goldDetails !== undefined
        ? (value.goldDetails as Asset["goldDetails"])
        : undefined,
    source: value.source !== undefined ? (value.source as Asset["source"]) : undefined,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUnlockedUser();
    const { id } = await params;
    const record = await db.asset.findFirst({ where: { id, userId: user.id } });

    if (!record) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    return NextResponse.json(normalizeAsset(record));
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unknown error" }, { status: 500 })
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUnlockedUser();
    const { id } = await params;
    const payload = sanitizeAssetInput(await request.json());

    const owned = await db.asset.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!owned) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const record = await db.asset.update({
      where: { id },
      data: {
        ...(payload.name !== undefined && { name: payload.name }),
        ...(payload.categoryId !== undefined && { categoryId: payload.categoryId }),
        ...(payload.type !== undefined && { type: payload.type }),
        ...(payload.institution !== undefined && { institution: payload.institution }),
        ...(payload.investedAmount !== undefined && {
          investedAmount: Number(payload.investedAmount),
        }),
        ...(payload.currentValue !== undefined && {
          currentValue: Number(payload.currentValue),
        }),
        ...(payload.startDate !== undefined && { startDate: payload.startDate }),
        ...(payload.notes !== undefined && { notes: payload.notes }),
        ...(payload.debtDetails !== undefined && {
          debtDetails: payload.debtDetails as unknown as Prisma.InputJsonValue,
        }),
        ...(payload.equityDetails !== undefined && {
          equityDetails: payload.equityDetails as unknown as Prisma.InputJsonValue,
        }),
        ...(payload.goldDetails !== undefined && {
          goldDetails: payload.goldDetails as unknown as Prisma.InputJsonValue,
        }),
        ...(payload.source !== undefined && {
          source: payload.source as unknown as Prisma.InputJsonValue,
        }),
      },
    });

    return NextResponse.json(normalizeAsset(record));
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUnlockedUser();
    const { id } = await params;

    await db.asset.deleteMany({ where: { id, userId: user.id } });
    await unlinkAssetFromGoals(user.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: "Unknown error" }, { status: 500 })
    );
  }
}
