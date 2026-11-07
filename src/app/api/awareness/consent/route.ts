import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, parseBody } from "@/lib/auth/guard";
import { audit } from "@/lib/auth/audit";

export const runtime = "nodejs";

/**
 * GET /api/awareness/consent — the parental-consent register (proposal
 * ethics: parental consent in schools). Filters: ?schoolId= &classId=
 * &status=GRANTED|PENDING|DENIED. The register stores only pseudonymised
 * participant codes and an opaque reference to the signed paper form.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;

  const sp = req.nextUrl.searchParams;
  const schoolId = sp.get("school") || undefined;
  const classId = sp.get("class") || undefined;
  const status = sp.get("status") || undefined;

  const where: Record<string, unknown> = {};
  if (classId) where.classId = classId;
  else if (schoolId) where.class = { schoolId };
  if (status && ["GRANTED", "PENDING", "DENIED"].includes(status)) where.consent = status;

  const rows = await db.awarenessLearner.findMany({
    where,
    orderBy: { code: "asc" },
    include: { class: { include: { school: true } } },
  });

  return NextResponse.json({
    learners: rows.map((l) => ({
      id: l.id,
      code: l.code,
      grade: l.grade,
      consent: l.consent,
      consentAt: l.consentAt,
      consentRef: l.consentRef,
      className: l.class.name,
      groupType: l.class.groupType,
      schoolName: l.class.school.name,
      createdAt: l.createdAt,
    })),
  });
}

/** POST /api/awareness/consent — record a parental consent decision. */
export async function POST(req: NextRequest) {
  const guard = await requireAuth(req, "awareness:manage");
  if (guard.error) return guard.error;
  const { user } = guard;

  const parsed = await parseBody(req, (raw) => {
    const b = raw as Record<string, unknown>;
    if (
      typeof b.learnerId !== "string" || !b.learnerId ||
      (b.decision !== "GRANTED" && b.decision !== "DENIED")
    ) return null;
    return {
      learnerId: b.learnerId,
      decision: b.decision as "GRANTED" | "DENIED",
      consentRef: typeof b.consentRef === "string" && b.consentRef.trim() ? b.consentRef.trim() : null,
    };
  });
  if ("error" in parsed) return parsed.error;

  const learner = await db.awarenessLearner.findUnique({
    where: { id: parsed.data.learnerId },
    include: { class: { include: { school: true } } },
  });
  if (!learner) return NextResponse.json({ error: "Learner not found" }, { status: 404 });

  const updated = await db.awarenessLearner.update({
    where: { id: learner.id },
    data: {
      consent: parsed.data.decision,
      consentAt: new Date(),
      consentRef: parsed.data.consentRef ?? learner.consentRef,
    },
  });

  await audit({
    type: "AWARENESS_CONSENT_RECORDED",
    userId: user.id,
    email: user.email,
    organizationId: null,
    detail: `Consent ${updated.consent} recorded for ${updated.code} (${learner.class.school.name}, ${learner.class.name})${parsed.data.consentRef ? ` ref=${parsed.data.consentRef}` : ""}`,
  });

  return NextResponse.json({ learner: { id: updated.id, code: updated.code, consent: updated.consent } });
}
