/**
 * Adwa Cyber — Track C gate-criteria seeder (proposal Phases 4–5 governance).
 * Idempotent upsert keyed on (phase, code): definitions can evolve with the
 * roadmap without touching recorded status/notes/targetDate.
 * Usage: npx tsx scripts/seed-gates.ts
 */
import { PrismaClient } from "@prisma/client";
import { GATE_CRITERIA } from "../src/lib/governance/gates";
import { assertSeedAllowed } from "./seed-guard";

const db = new PrismaClient();

// D6 guard — refuses to seed a production DB without explicit opt-in
assertSeedAllowed("bootstrap");

(async () => {
  let created = 0;
  let refreshed = 0;
  for (const c of GATE_CRITERIA) {
    const existing = await db.expansionGate.findUnique({
      where: { phase_code: { phase: c.phase, code: c.code } },
    });
    if (!existing) {
      await db.expansionGate.create({
        data: {
          phase: c.phase,
          code: c.code,
          titleEn: c.titleEn,
          titleAm: c.titleAm,
          detailEn: c.detailEn,
          detailAm: c.detailAm,
          category: c.category,
          blocking: c.blocking,
          status: c.initialStatus,
          notes: c.notes ?? null,
        },
      });
      created++;
    } else {
      // Refresh definitions only; recorded status/notes/targetDate are
      // governance state and survive re-seeding.
      await db.expansionGate.update({
        where: { id: existing.id },
        data: {
          titleEn: c.titleEn,
          titleAm: c.titleAm,
          detailEn: c.detailEn,
          detailAm: c.detailAm,
          category: c.category,
          blocking: c.blocking,
        },
      });
      refreshed++;
    }
  }
  console.log(
    `Track C gates: ${created} created, ${refreshed} refreshed (${GATE_CRITERIA.length} criteria across P4_ACFS + P5_CII).`
  );
  await db.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
