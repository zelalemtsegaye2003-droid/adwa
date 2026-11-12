import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { randomCode } from "@/lib/awareness-server";

export const runtime = "nodejs";

/**
 * POST /api/awareness/classes/[id]/learners — bulk-issue pseudonymised
 * participant codes for a class. The codes are printed on paper slips and
 * handed out by the teacher; consent starts PENDING until the signed
 * parental form is recorded (POST /api/awareness/consent).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;
  const { user } = guard;
  const { id } = await ctx.params;

  const parsed = await parseBody(req, (raw) => {
    const n = (raw as Record<string, unknown>).count;
    if (!Number.isInteger(n) || (n as number) < 1 || (n as number) > 60) return null;
    return { count: n as number };
  });
  if ("error" in parsed) return parsed.error;

  const klass = await db.awarenessClass.findUnique({ where: { id }, include: { school: true } });
  if (!klass) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const codes: string[] = [];
  for (let i = 0; i < parsed.data.count; i++) {
    let code = randomCode("AW", 6);
    for (let t = 0; t < 5; t++) {
      const clash = await db.awarenessLearner.findUnique({ where: { code } });
      if (!clash) break;
      code = randomCode("AW", 6);
    }
    await db.awarenessLearner.create({
      data: { classId: klass.id, code, grade: klass.grade, consent: "PENDING" },
    });
    codes.push(code);
  }

  await audit({
    type: "AWARENESS_LEARNERS_ISSUED",
    userId: user.id,
    email: user.email,
    organizationId: null,
    detail: `${codes.length} participant codes issued for ${klass.name} at ${klass.school.name}`,
  });

  return NextResponse.json({ issued: codes.length, codes }, { status: 201 });
}
