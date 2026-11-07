import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const orgs = await db.organization.findMany({
    orderBy: { createdAt: "asc" },
    include: { scans: { orderBy: { startedAt: "desc" }, take: 1 } },
  });
  return NextResponse.json({
    organizations: orgs.map((o) => ({
      ...o,
      latestScan: o.scans[0] ?? null,
      scanCount: o.scans.length,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }
  const org = await db.organization.create({
    data: {
      name: body.name.trim(),
      nameAm: body.nameAm?.trim() ?? "",
      sector: body.sector ?? "Other",
      tier: body.tier ?? "mid-market",
      contactEmail: body.contactEmail?.trim() || null,
      notes: body.notes?.trim() || null,
      status: "onboarding",
    },
  });
  return NextResponse.json({ organization: org }, { status: 201 });
}
