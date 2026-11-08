/**
 * Adwa Cyber — Rules Engine seed: evidence ↔ obligation links.
 *
 * 1. Corrects evidence tags to reference REAL rule codes (NBE-05, NBE-21,
 *    NBE-24, NBE-28, ART17-02, ART52-01…) so auto-linking is meaningful.
 * 2. Runs the auto-tag reconciliation for every document (source=AUTO_TAG).
 * 3. Adds one MANUAL link (CBE ICT Risk Appetite v2.0 → NBE-14) to demo the
 *    manual curation path.
 *
 * Usage: node scripts/seed-evidence-links.cjs
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

// doc title fragment → replacement tags (all codes must exist in the catalogue)
const TAG_FIXES = [
  ["Information Security Policy v3.2", "NBE-05, NBE-17, board-approved"],
  ["Security Awareness Training Records", "ART52-01, awareness, Q3-2026"],
  ["ICT Risk Appetite Statement v2.0", "NBE-12, risk-appetite, board-approved"],
  ["External Penetration Test Report 2026", "pentest, NBE-21, external-audit"],
  ["CBE Disaster Recovery Plan 2026", "NBE-28, continuity, board-approved"],
  ["Branch Access Review Log Q4 2026", "ART17-02, access-review"],
  ["Incident Response Tabletop Drill", "NBE-24, incident-response, drill"],
  ["Branch Firewall Rules Export", "ART17-02, firewall, config"],
  ["ISO/IEC 27001:2022 Certificate", "NBE-21, ISO-27001, certificate"],
];

function parseRuleRefs(tags) {
  if (!tags) return [];
  return [...new Set(
    tags.split(",").map((s) => s.trim())
      .filter((s) => /^([A-Za-z]{2,10}-\d{1,3}|[A-Za-z]{2,10}\d{1,3}-\d{1,3})$/.test(s))
      .map((s) => s.toUpperCase())
  )];
}

async function main() {
  console.log("── Rules Engine seed ──");

  // 1. Fix tags
  for (const [fragment, tags] of TAG_FIXES) {
    const doc = await db.evidenceDocument.findFirst({ where: { title: { contains: fragment } } });
    if (!doc) { console.log(`  ? no doc matching "${fragment}"`); continue; }
    if (doc.tags === tags) { console.log(`  = "${doc.title}" tags already correct`); continue; }
    await db.evidenceDocument.update({ where: { id: doc.id }, data: { tags } });
    console.log(`  ~ "${doc.title}" tags → ${tags}`);
  }

  // 2. Auto-tag reconcile every document
  const docs = await db.evidenceDocument.findMany({ select: { id: true, title: true, organizationId: true } });
  // Pick a system user for AUTO_TAG links: prefer the org admin of the doc's tenant.
  const admins = await db.user.findMany({
    where: { role: { in: ["ORG_ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, email: true, organizationId: true },
  });
  const superAdmin = admins.find((a) => a.email === "admin@adwacyber.et") ?? admins[0];

  for (const doc of docs) {
    const full = await db.evidenceDocument.findUnique({ where: { id: doc.id }, select: { tags: true } });
    const refs = parseRuleRefs(full.tags);
    if (!refs.length) { console.log(`  – "${doc.title}": no rule-code tags`); continue; }
    const rules = await db.rule.findMany({ where: { isActive: true, code: { in: refs } }, select: { id: true, code: true } });
    const existing = await db.evidenceLink.findMany({ where: { evidenceId: doc.id, source: "AUTO_TAG" }, select: { ruleId: true } });
    const existingIds = new Set(existing.map((l) => l.ruleId));

    const owner = admins.find((a) => a.organizationId === doc.organizationId) ?? superAdmin;
    let created = 0;
    for (const rule of rules) {
      if (existingIds.has(rule.id)) continue;
      await db.evidenceLink.create({
        data: { ruleId: rule.id, evidenceId: doc.id, linkType: "SATISFIES", source: "AUTO_TAG", createdById: owner.id },
      });
      created++;
      console.log(`  + AUTO "${doc.title.slice(0, 38)}" → ${rule.code}`);
    }
    // drop stale auto links
    const wanted = new Set(rules.map((r) => r.id));
    const orphan = [...existingIds].filter((id) => !wanted.has(id));
    if (orphan.length) {
      await db.evidenceLink.deleteMany({ where: { evidenceId: doc.id, source: "AUTO_TAG", ruleId: { in: orphan } } });
      console.log(`  − removed ${orphan.length} orphaned AUTO_TAG link(s) from "${doc.title.slice(0, 38)}"`);
    }
    if (!created && !orphan.length) console.log(`  = "${doc.title.slice(0, 38)}" auto-links up to date`);
  }

  // 3. One MANUAL link: CBE ICT Risk Appetite v2.0 → NBE-14 (board risk reporting)
  const appetite = await db.evidenceDocument.findFirst({ where: { title: { contains: "ICT Risk Appetite Statement v2.0" } } });
  const nbe14 = await db.rule.findUnique({ where: { code: "NBE-14" } });
  const cbeAdmin = await db.user.findUnique({ where: { email: "admin@cbe.com.et" } });
  if (appetite && nbe14 && cbeAdmin) {
    const exists = await db.evidenceLink.findUnique({ where: { ruleId_evidenceId: { ruleId: nbe14.id, evidenceId: appetite.id } } });
    if (!exists) {
      await db.evidenceLink.create({
        data: { ruleId: nbe14.id, evidenceId: appetite.id, linkType: "SUPPORTS", source: "MANUAL", createdById: cbeAdmin.id },
      });
      console.log(`  + MANUAL "ICT Risk Appetite v2.0" → NBE-14 (SUPPORTS, by CBE admin)`);
    } else {
      console.log("  = MANUAL link NBE-14 already present");
    }
  }

  // 4. Summary
  const total = await db.evidenceLink.count();
  console.log(`\nDone. ${total} evidence link(s) in total.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
