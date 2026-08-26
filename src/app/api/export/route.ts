import { NextResponse } from "next/server";
import { buildExport } from "@/lib/server/exports";
import { authErrorResponse, requireUnlockedUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Downloads assets, liabilities and goals as one Excel workbook. */
export async function GET() {
  try {
    const user = await requireUnlockedUser();
    const file = await buildExport(user.id);

    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return (
      authErrorResponse(error) ??
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}
