/**
 * D6 production seeding guard (docs/DECISIONS.md).
 *
 *  - "bootstrap" scope (catalogue, pilot users, SOC fixture, gate criteria):
 *    allowed in production only when SEED_ON_BOOT=1 (the docker entrypoint
 *    sets it for pilot bring-up) or ALLOW_DEMO_SEED=1.
 *  - "demo" scope (evidence packs, awareness RCT dataset, Track C timeline,
 *    SLA fixtures): production requires the explicit ALLOW_DEMO_SEED=1.
 *
 * Dev (NODE_ENV != production) always passes.
 */
export function assertSeedAllowed(scope: "bootstrap" | "demo"): void {
  if (process.env.NODE_ENV !== "production") return;
  const bootstrapOk = process.env.SEED_ON_BOOT === "1" || process.env.ALLOW_DEMO_SEED === "1";
  const demoOk = process.env.ALLOW_DEMO_SEED === "1";
  const ok = scope === "bootstrap" ? bootstrapOk : demoOk;
  if (!ok) {
    console.error(
      `[seed-guard] ${scope} seeding refused: NODE_ENV=production without ` +
        (scope === "bootstrap" ? "SEED_ON_BOOT=1" : "ALLOW_DEMO_SEED=1") +
        " (decision D6 — see docs/DECISIONS.md)."
    );
    process.exit(1);
  }
  if (process.env.ALLOW_DEMO_SEED === "1") {
    console.warn(`[seed-guard] ${scope} seeding FORCED in production via ALLOW_DEMO_SEED=1 — never do this on a real tenant database.`);
  }
}
