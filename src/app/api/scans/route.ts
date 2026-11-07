import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const scans = await db.scan.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      organization: { select: { id: true, name: true, nameAm: true, sector: true, tier: true } },
    },
  });
  return NextResponse.json({ scans });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const organizationId = body.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const count = await db.scan.count({ where: { organizationId } });
  const scan = await db.scan.create({
    data: {
      organizationId,
      name: body.name?.trim() || `Compliance assessment #${count + 1} — 47 rules`,
      status: "in_progress",
    },
  });
  // Create empty result rows for every active rule
  const rules = await db.rule.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  await db.scanResult.createMany({
    data: rules.map((r) => ({ scanId: scan.id, ruleId: r.id, answer: "na", score: 0 })),
  });
  return NextResponse.json({ scan }, { status: 201 });
}
