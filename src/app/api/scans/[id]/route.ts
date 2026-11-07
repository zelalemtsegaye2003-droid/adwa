import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const scan = await db.scan.findUnique({
    where: { id },
    include: {
      organization: true,
      results: {
        include: { rule: true },
        orderBy: { rule: { sortOrder: "asc" } },
      },
    },
  });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  return NextResponse.json({ scan });
}
