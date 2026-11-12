import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";

export const runtime = "nodejs";

/** GET /api/awareness/schools — pilot schools with classes and join codes. */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;

  const schools = await db.awarenessSchool.findMany({
    orderBy: { name: "asc" },
    include: {
      classes: {
        orderBy: [{ grade: "asc" }, { name: "asc" }],
        include: { _count: { select: { learners: true } } },
      },
    },
  });

  const consentRows = await db.awarenessLearner.groupBy({
    by: ["classId", "consent"],
    _count: { _all: true },
  });

  return NextResponse.json({
    schools: schools.map((s) => ({
      id: s.id,
      name: s.name,
      nameAm: s.nameAm,
      subCity: s.subCity,
      address: s.address,
      contactPerson: s.contactPerson,
      contactPhone: s.contactPhone,
      isActive: s.isActive,
      classes: s.classes.map((c) => {
        const cc = { GRANTED: 0, PENDING: 0, DENIED: 0 };
        for (const row of consentRows) {
          if (row.classId === c.id && row.consent in cc) cc[row.consent as keyof typeof cc] = row._count._all;
        }
        return {
          id: c.id,
          name: c.name,
          grade: c.grade,
          groupType: c.groupType,
          joinCode: c.joinCode,
          teacherName: c.teacherName,
          isActive: c.isActive,
          learners: c._count.learners,
          consent: cc,
        };
      }),
    })),
  });
}

/** POST /api/awareness/schools — onboard a pilot school. */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, (raw) => {
    const b = raw as Record<string, unknown>;
    const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
    if (!str(b.name) || !str(b.nameAm) || !str(b.subCity)) return null;
    return {
      name: String(b.name).trim(),
      nameAm: String(b.nameAm).trim(),
      subCity: String(b.subCity).trim(),
      address: typeof b.address === "string" && b.address.trim() ? b.address.trim() : null,
      contactPerson: typeof b.contactPerson === "string" && b.contactPerson.trim() ? b.contactPerson.trim() : null,
      contactPhone: typeof b.contactPhone === "string" && b.contactPhone.trim() ? b.contactPhone.trim() : null,
    };
  });
  if ("error" in parsed) return parsed.error;

  const dup = await db.awarenessSchool.findUnique({ where: { name: parsed.data.name } });
  if (dup) return NextResponse.json({ error: { code: "DUPLICATE", message: "A school with this name already exists." } }, { status: 409 });

  const school = await db.awarenessSchool.create({ data: parsed.data });

  await audit({
    type: "AWARENESS_SCHOOL_CREATED",
    userId: user.id,
    email: user.email,
    organizationId: null,
    detail: `School onboarded: ${school.name} (${school.subCity})`,
  });

  return NextResponse.json({ school: { id: school.id, name: school.name } }, { status: 201 });
}
