/**
 * Adwa Cyber — Awareness Platform statistics engine (proposal Phase 3, Track B).
 *
 * Implements the RQ2 evaluation maths the proposal commits to for the school
 * pilot (§"Evaluation integrity", §4.4): paired pre/post knowledge assessments
 * with a control-group design analysed by one-way ANOVA.
 *
 *  - pairedT:  within-group pre vs post contrast (t, df, p)
 *  - anovaOneWay: between-group contrast on gain scores (F, df, p, η²)
 *  - gain summaries per group / per school for the evaluation dashboard
 *
 * p-values use the regularised incomplete beta function (Numerical Recipes
 * betacf) so no external dependency is required.
 */

export interface ScorePair {
  pre: number;
  post: number;
}

export interface GroupStat {
  n: number;
  meanPre: number;
  meanPost: number;
  meanGain: number;
  sdGain: number;
  minGain: number;
  maxGain: number;
}

export interface PairedTResult {
  n: number;
  meanGain: number;
  sdGain: number;
  t: number;
  df: number;
  p: number;
  significant: boolean; // α = 0.05, two-sided
}

export interface AnovaResult {
  groups: string[];
  k: number; // number of groups
  n: number; // total observations
  dfBetween: number;
  dfWithin: number;
  ssBetween: number;
  ssWithin: number;
  msBetween: number;
  msWithin: number;
  f: number;
  p: number;
  etaSquared: number; // effect size
  significant: boolean; // α = 0.05
  groupMeans: Record<string, number>;
}

const ALPHA = 0.05;

// ── Numerical Recipes: regularised incomplete beta ─────────────────────────
function gammaln(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
export function betai(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value for Student's t with df degrees of freedom. */
export function tDistTwoSidedP(t: number, df: number): number {
  if (!isFinite(t) || df <= 0) return NaN;
  return betai(df / 2, 0.5, df / (df + t * t));
}

/** Upper-tail p-value for the F distribution (d1 = numerator df). */
export function fDistUpperP(f: number, d1: number, d2: number): number {
  if (!isFinite(f) || f <= 0 || d1 <= 0 || d2 <= 0) return NaN;
  return betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * f));
}

// ── Descriptive helpers ────────────────────────────────────────────────────
export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const round4 = (x: number) => Math.round(x * 10000) / 10000;

/** Paired t-test on pre/post score pairs (RQ2 within-group contrast). */
export function pairedT(pairs: ScorePair[], alpha = ALPHA): PairedTResult | null {
  const n = pairs.length;
  if (n < 2) return null;
  const gains = pairs.map((p) => p.post - p.pre);
  const m = mean(gains);
  const s = sd(gains);
  const t = s > 0 ? m / (s / Math.sqrt(n)) : m === 0 ? 0 : m > 0 ? Infinity : -Infinity;
  const df = n - 1;
  const p = isFinite(t) ? tDistTwoSidedP(t, df) : 0;
  return {
    n,
    meanGain: round2(m),
    sdGain: round2(s),
    t: round4(t),
    df,
    p: round4(Math.max(0, Math.min(1, p))),
    significant: p < alpha,
  };
}

/**
 * One-way ANOVA across k groups of gain scores (RQ2 control-group contrast:
 * TREATMENT vs CONTROL on post-minus-pre). Also used per-school.
 */
export function anovaOneWay(grouped: Record<string, number[]>, alpha = ALPHA): AnovaResult | null {
  const groups = Object.keys(grouped).filter((g) => grouped[g].length > 0);
  const k = groups.length;
  const all = groups.flatMap((g) => grouped[g]);
  const n = all.length;
  if (k < 2 || n < k + 1) return null;

  const grand = mean(all);
  const groupMeans: Record<string, number> = {};
  let ssBetween = 0;
  let ssWithin = 0;
  for (const g of groups) {
    const xs = grouped[g];
    const gm = mean(xs);
    groupMeans[g] = round2(gm);
    ssBetween += xs.length * (gm - grand) * (gm - grand);
    for (const x of xs) ssWithin += (x - gm) * (x - gm);
  }
  const dfBetween = k - 1;
  const dfWithin = n - k;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const f = msWithin > 0 ? msBetween / msWithin : msBetween > 0 ? Infinity : 0;
  const p = isFinite(f) && f > 0 ? fDistUpperP(f, dfBetween, dfWithin) : f > 0 ? 0 : 1;
  const ssTotal = ssBetween + ssWithin;
  return {
    groups,
    k,
    n,
    dfBetween,
    dfWithin,
    ssBetween: round2(ssBetween),
    ssWithin: round2(ssWithin),
    msBetween: round2(msBetween),
    msWithin: round2(msWithin),
    f: round4(f),
    p: round4(Math.max(0, Math.min(1, p))),
    etaSquared: ssTotal > 0 ? round4(ssBetween / ssTotal) : 0,
    significant: p < alpha,
    groupMeans,
  };
}

/** Descriptive summary for one group of pre/post pairs. */
export function groupStat(pairs: ScorePair[]): GroupStat {
  const n = pairs.length;
  const gains = pairs.map((p) => p.post - p.pre);
  return {
    n,
    meanPre: round2(mean(pairs.map((p) => p.pre))),
    meanPost: round2(mean(pairs.map((p) => p.post))),
    meanGain: round2(mean(gains)),
    sdGain: round2(sd(gains)),
    minGain: gains.length ? round2(Math.min(...gains)) : 0,
    maxGain: gains.length ? round2(Math.max(...gains)) : 0,
  };
}

/** Histogram of gains in `bins` buckets of `width`, for the distribution chart. */
export function gainHistogram(gains: number[], width = 10): { label: string; count: number }[] {
  const buckets = new Map<number, number>();
  for (const g of gains) {
    const b = Math.floor(g / width) * width;
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const minB = Math.floor(Math.min(0, ...gains) / width) * width;
  const maxB = Math.ceil(Math.max(0, ...gains) / width) * width;
  const out: { label: string; count: number }[] = [];
  for (let b = minB; b <= maxB; b += width) {
    out.push({ label: `${b}–${b + width}`, count: buckets.get(b) ?? 0 });
  }
  return out;
}
