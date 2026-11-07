import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID = ["open", "in_progress", "remediated", "waived"];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (!VALID.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${VALID.join(", ")}` }, { status: 400 });
  }
  const result = await db.scanResult.update({
    where: { id },
    data: { status: body.status },
    include: { rule: true, scan: { include: { organization: true } } },
  });
  return NextResponse.json({ result });
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await db.scanResult.findUnique({
    where: { id },
    include: { rule: true, scan: { include: { organization: true } } },
  });
  if (!result) return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  return NextResponse.json({ result });
}
