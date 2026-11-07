import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

/** GET /api/rules — the 47-rule catalogue (any authenticated user). */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, "catalogue:view");
  if (guard.error) return guard.error;

  const article = req.nextUrl.searchParams.get("article");
  const pillar = req.nextUrl.searchParams.get("pillar");
  const severity = req.nextUrl.searchParams.get("severity");
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase();

  const rules = await db.rule.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const filtered = rules.filter((r) => {
    if (article && r.article !== article) return false;
    if (pillar && r.pillar !== pillar) return false;
    if (severity && r.severity !== severity) return false;
    if (q && !`${r.code} ${r.titleEn} ${r.titleAm} ${r.statementEn} ${r.article}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const articles = [...new Set(rules.map((r) => r.article))];
  return NextResponse.json({ rules: filtered, total: rules.length, articles });
}
