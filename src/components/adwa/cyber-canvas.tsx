"use client";
/**
 * Adwa Cyber — ambient 3D cyber-operations background.
 *
 * A canvas-rendered wireframe globe (perspective-projected, slowly rotating)
 * with REAL geographic node coordinates and animated threat arcs converging on
 * Addis Ababa — the visual grammar of real SOC platforms (Kaspersky cybermap,
 * Norse attack map, CrowdStrike world view): a live operations feel behind the
 * workspace without hurting readability.
 *
 * Engineering notes:
 *  - pure 2D canvas with hand-rolled 3D projection — no WebGL/three.js dep,
 *    ~30fps cap, paused when the tab is hidden, static single frame under
 *    prefers-reduced-motion.
 *  - tinted by the ACTIVE module's accent colour (tab-theme.ts), so the whole
 *    atmosphere subtly changes per workspace tab.
 *  - pointer-events-none, aria-hidden — decoration only.
 */
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

/** Real city coordinates (lat°, lon°) — Addis Ababa is the featured hub. */
const NODES: { name: string; lat: number; lon: number; hub?: boolean }[] = [
  { name: "Addis Ababa", lat: 9.03, lon: 38.74, hub: true },
  { name: "Cairo", lat: 30.04, lon: 31.24 },
  { name: "Nairobi", lat: -1.29, lon: 36.82 },
  { name: "Johannesburg", lat: -26.2, lon: 28.05 },
  { name: "Dubai", lat: 25.2, lon: 55.27 },
  { name: "Riyadh", lat: 24.71, lon: 46.68 },
  { name: "Istanbul", lat: 41.01, lon: 28.98 },
  { name: "London", lat: 51.51, lon: -0.13 },
  { name: "Frankfurt", lat: 50.11, lon: 8.68 },
  { name: "Amsterdam", lat: 52.37, lon: 4.9 },
  { name: "Paris", lat: 48.86, lon: 2.35 },
  { name: "Moscow", lat: 55.76, lon: 37.62 },
  { name: "Mumbai", lat: 19.08, lon: 72.88 },
  { name: "Delhi", lat: 28.61, lon: 77.21 },
  { name: "Singapore", lat: 1.35, lon: 103.82 },
  { name: "Beijing", lat: 39.9, lon: 116.41 },
  { name: "Shanghai", lat: 31.23, lon: 121.47 },
  { name: "Tokyo", lat: 35.68, lon: 139.69 },
  { name: "Seoul", lat: 37.57, lon: 126.98 },
  { name: "Sydney", lat: -33.87, lon: 151.21 },
  { name: "New York", lat: 40.71, lon: -74.01 },
  { name: "Washington DC", lat: 38.91, lon: -77.04 },
  { name: "São Paulo", lat: -23.55, lon: -46.63 },
];

interface Vec3 { x: number; y: number; z: number }
const D2R = Math.PI / 180;
const TILT = -18 * D2R; // globe tilt around the X axis (north pole leans back)

function geoToUnit(lat: number, lon: number, spin: number): Vec3 {
  const phi = lat * D2R;
  const lam = (lon * D2R) + spin;
  const x = Math.cos(phi) * Math.cos(lam);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.sin(lam);
  // tilt around X
  return { x, y: y * Math.cos(TILT) - z * Math.sin(TILT), z: y * Math.sin(TILT) + z * Math.cos(TILT) };
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

interface Arc {
  from: number; to: number;
  t: number; speed: number; height: number;
  ripple: number; // seconds since arrival (<0 = not yet arrived)
}

function drawFrame(
  ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number,
  accent: string, dim: number, timeMs: number, arcs: Arc[], stars: { x: number; y: number; r: number; p: number }[],
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const spin = timeMs * 0.00004; // one revolution ≈ 26 min
  const [ar, ag, ab] = hexRgb(accent);
  const A = (a: number) => `rgba(${ar},${ag},${ab},${(a * dim).toFixed(3)})`;
  const SL = (a: number) => `rgba(148,163,184,${(a * dim).toFixed(3)})`;

  // Globe placement: right-of-centre so it doesn't fight the sidebar/content edge
  const R = Math.min(w, h) * 0.46;
  const cx = w * 0.74;
  const cy = h * 0.52;
  const PERSP = 3.2;
  const proj = (p: Vec3) => {
    const s = PERSP / (PERSP - p.z);
    return { x: cx + p.x * R * s, y: cy - p.y * R * s, s, z: p.z };
  };

  // ── Starfield (twinkling backdrop) ─────────────────────────────────────
  for (const st of stars) {
    const tw = 0.35 + 0.65 * Math.abs(Math.sin(timeMs * 0.00035 + st.p));
    ctx.fillStyle = SL(0.22 * tw);
    ctx.beginPath();
    ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Sphere limb (outline) ──────────────────────────────────────────────
  ctx.lineWidth = 1;
  ctx.strokeStyle = SL(0.35);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  // ── Wireframe: latitudes & longitudes ─────────────────────────────────
  const drawPoly = (pts: Vec3[]) => {
    let started = false;
    for (const p of pts) {
      const q = proj(p);
      if (q.z < -0.15) { started = false; continue; } // clip far side
      const alpha = 0.05 + Math.max(0, (q.z + 1) / 2) * 0.16;
      if (!started) {
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        started = true;
      } else ctx.lineTo(q.x, q.y);
      ctx.strokeStyle = SL(alpha);
    }
    ctx.stroke();
  };
  for (let latDeg = -60; latDeg <= 60; latDeg += 20) {
    const pts: Vec3[] = [];
    for (let lonDeg = -180; lonDeg <= 180; lonDeg += 5) pts.push(geoToUnit(latDeg, lonDeg, spin));
    drawPoly(pts);
  }
  for (let lonDeg = -180; lonDeg < 180; lonDeg += 20) {
    const pts: Vec3[] = [];
    for (let latDeg = -90; latDeg <= 90; latDeg += 5) pts.push(geoToUnit(latDeg, lonDeg, spin));
    drawPoly(pts);
  }

  // ── Nodes ──────────────────────────────────────────────────────────────
  const hub = NODES.find((n) => n.hub)!;
  const hubU = geoToUnit(hub.lat, hub.lon, spin);
  const hubQ = proj(hubU);
  const hubVisible = hubU.z > -0.05;

  for (const n of NODES) {
    if (n.hub) continue;
    const u = geoToUnit(n.lat, n.lon, spin);
    if (u.z < -0.05) continue;
    const q = proj(u);
    const a = 0.35 + Math.max(0, (u.z + 1) / 2) * 0.5;
    ctx.fillStyle = SL(a);
    ctx.beginPath();
    ctx.arc(q.x, q.y, 1.6 * q.s, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Threat arcs ────────────────────────────────────────────────────────
  const arcPts = (a: Arc, t: number) => {
    const A3 = geoToUnit(NODES[a.from].lat, NODES[a.from].lon, spin);
    const B3 = geoToUnit(NODES[a.to].lat, NODES[a.to].lon, spin);
    const angle = Math.acos(Math.min(1, Math.max(-1, A3.x * B3.x + A3.y * B3.y + A3.z * B3.z)));
    const lift = 1 + 0.18 + angle * 0.22 * a.height;
    const M: Vec3 = {
      x: (A3.x + B3.x) / 2, y: (A3.y + B3.y) / 2, z: (A3.z + B3.z) / 2,
    };
    const ml = Math.hypot(M.x, M.y, M.z) || 1;
    M.x = (M.x / ml) * lift; M.y = (M.y / ml) * lift; M.z = (M.z / ml) * lift;
    const it = 1 - t;
    return {
      x: it * it * A3.x + 2 * t * it * M.x + t * t * B3.x,
      y: it * it * A3.y + 2 * t * it * M.y + t * t * B3.y,
      z: it * it * A3.z + 2 * t * it * M.z + t * t * B3.z,
    };
  };

  for (const a of arcs) {
    const head = Math.min(1, a.t);
    // Trail: sample ~24 segments behind the head
    const TRAIL = 0.45;
    const start = Math.max(0, head - TRAIL);
    let prev: { x: number; y: number; z: number } | null = null;
    ctx.lineWidth = 1.1;
    for (let i = 0; i <= 24; i++) {
      const t = start + (head - start) * (i / 24);
      const p3 = arcPts(a, t);
      const q = proj(p3);
      if (prev) {
        const fade = i / 24; // brighter toward the head
        ctx.strokeStyle = A(0.1 + fade * 0.5);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
      prev = { x: q.x, y: q.y, z: q.z };
    }
    // Packet head — glowing dot
    if (head < 1) {
      const p3 = arcPts(a, head);
      const q = proj(p3);
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 6);
      g.addColorStop(0, A(0.95));
      g.addColorStop(0.4, A(0.45));
      g.addColorStop(1, A(0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Arrival ripple at the destination
    if (a.ripple >= 0 && a.ripple < 0.7) {
      const B3 = geoToUnit(NODES[a.to].lat, NODES[a.to].lon, spin);
      const q = proj(B3);
      const rr = 3 + a.ripple * 26;
      ctx.strokeStyle = A(0.5 * (1 - a.ripple / 0.7));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(q.x, q.y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ── The Addis Ababa hub (defended node) ────────────────────────────────
  if (hubVisible) {
    const pulse = 0.5 + 0.5 * Math.sin(timeMs * 0.002);
    const rr = 4 + pulse * 5;
    ctx.strokeStyle = A(0.55 * (1 - pulse * 0.7));
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(hubQ.x, hubQ.y, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = A(0.95);
    ctx.beginPath();
    ctx.arc(hubQ.x, hubQ.y, 2.4 * hubQ.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = A(0.75);
    ctx.font = "600 9px var(--font-geist-mono), ui-monospace, monospace";
    ctx.letterSpacing = "1.5px";
    ctx.fillText("ADDIS ABABA", hubQ.x + 9, hubQ.y + 3);
  }

  // ── Slow vertical scan bar across the full canvas ──────────────────────
  const scanY = ((timeMs * 0.018) % (h + 160)) - 80;
  const grad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
  grad.addColorStop(0, A(0));
  grad.addColorStop(0.5, A(0.06));
  grad.addColorStop(1, A(0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, scanY - 40, w, 80);
}

export function CyberCanvas({ accent, className }: { accent: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let hidden = document.hidden;

    const arcs: Arc[] = [];
    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.1 + 0.3, p: Math.random() * 10,
    }));
    const hubIdx = NODES.findIndex((n) => n.hub);

    const spawnArc = () => {
      if (arcs.length > 9) return;
      // 75% of traffic converges on the Addis Ababa hub (inbound), rest random
      let from = Math.floor(Math.random() * NODES.length);
      if (from === hubIdx) from = (from + 1) % NODES.length;
      const inbound = Math.random() < 0.75;
      const to = inbound ? hubIdx : Math.floor(Math.random() * NODES.length);
      if (to === from) return;
      arcs.push({ from, to, t: 0, speed: 0.00022 + Math.random() * 0.00025, height: 0.7 + Math.random() * 0.6, ripple: -1 });
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      const staticFrame = () => drawFrame(
        ctx, canvas.clientWidth, canvas.clientHeight, dpr, accent, dark ? 1 : 0.42, 12_000, arcs, stars,
      );
      if (reduced) staticFrame();
    };
    resize();

    const onVis = () => {
      hidden = document.hidden;
      if (!hidden && !reduced && !raf) raf = requestAnimationFrame(loop);
      if (hidden && raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    let last = 0;
    let spawnAcc = 0;
    const FRAME = 1000 / 30; // 30fps cap

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(64, now - last);
      if (dt < FRAME) return;
      last = now;

      // advance & prune arcs
      spawnAcc += dt;
      if (spawnAcc > 620) { spawnAcc = 0; spawnArc(); }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i];
        if (a.t < 1) a.t += a.speed * dt;
        else if (a.ripple < 0) a.ripple = 0;
        else a.ripple += dt / 1000;
        if (a.ripple > 0.75) arcs.splice(i, 1);
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      drawFrame(ctx, canvas.clientWidth, canvas.clientHeight, dpr, accent, dark ? 1 : 0.42, now, arcs, stars);
    };

    if (reduced) {
      // static scene only (one pre-populated arc set for composition)
      for (let i = 0; i < 6; i++) spawnArc();
      arcs.forEach((a) => (a.t = 0.2 + Math.random() * 0.6));
      resize();
    } else {
      raf = requestAnimationFrame(loop);
      window.addEventListener("resize", resize);
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, dark]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className ?? "pointer-events-none absolute inset-0 -z-10 h-full w-full"}
    />
  );
}
