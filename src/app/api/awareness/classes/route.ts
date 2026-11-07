import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";
import { randomCode } from "@/lib/awareness-server";

export const runtime = "nodejs";

/**
 * POST /api/awareness/classes — create a class within a school. groupType
 * (TREATMENT | CONTROL) implements the RQ2 control-group design; the join
 * code is generated server-side and handed to the teacher on paper slips.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, (raw) => {
    const b = raw as Record<string, unknown>;
    const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
    if (
      !str(b.schoolId) || !str(b.name) ||
      !Number.isInteger(b.grade) || (b.grade as number) < 1 || (b.grade as number) > 12 ||
      (b.groupType !== "TREATMENT" && b.groupType !== "CONTROL")
    ) return null;
    return {
      schoolId: String(b.schoolId),
      name: String(b.name).trim(),
      grade: b.grade as number,
      groupType: b.groupType as string,
      teacherName: typeof b.teacherName === "string" && b.teacherName.trim() ? b.teacherName.trim() : null,
    };
  });
  if ("error" in parsed) return parsed.error;

  const school = await db.awarenessSchool.findUnique({ where: { id: parsed.data.schoolId } });
  if (!school) return NextResponse.json({ error: "School not found" }, { status: 404 });

  const dup = await db.awarenessClass.findFirst({
    where: { schoolId: school.id, name: parsed.data.name },
  });
  if (dup) return NextResponse.json({ error: { code: "DUPLICATE", message: "This class name already exists at the school." } }, { status: 409 });

  let joinCode = randomCode("ADWA", 8);
  for (let i = 0; i < 5; i++) {
    const clash = await db.awarenessClass.findUnique({ where: { joinCode } });
    if (!clash) break;
    joinCode = randomCode("ADWA", 8);
  }

  const klass = await db.awarenessClass.create({ data: { ...parsed.data, joinCode } });

  await audit({
    type: "AWARENESS_CLASS_CREATED",
    userId: user.id,
    email: user.email,
    organizationId: null,
    detail: `Class ${klass.name} [${klass.groupType}] at ${school.name} — join code ${klass.joinCode}`,
  });

  return NextResponse.json({ class: { id: klass.id, name: klass.name, joinCode: klass.joinCode, groupType: klass.groupType } }, { status: 201 });
}
