"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, tryRefresh } from "@/lib/auth-client";
import type { MeResponse } from "@/lib/auth-client";
import { LoginScreen } from "./login-screen";

interface AuthCtx {
  me: MeResponse;
  setMe: (me: MeResponse) => void;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthGate");
  return ctx;
}

type Phase = "loading" | "login" | "ready";

/**
 * Top-level gate: restores the session (silent refresh), shows the login
 * screen when unauthenticated, and provides the identity to the app shell.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);

  const refreshMe = useCallback(async () => {
    const res = await api<MeResponse>("/api/auth/me");
    setMe(res);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<MeResponse>("/api/auth/me");
        if (!cancelled) { setMe(res); setPhase("ready"); }
      } catch {
        // Access token expired → try one silent refresh, then retry /me.
        const ok = await tryRefresh();
        if (ok) {
          try {
            const res = await api<MeResponse>("/api/auth/me", {}, false);
            if (!cancelled) { setMe(res); setPhase("ready"); }
            return;
          } catch { /* fall through */ }
        }
        if (!cancelled) setPhase("login");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setMe(null);
    setPhase("login");
  }, []);

  if (phase === "loading" || (phase === "ready" && !me)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background" role="status" aria-live="polite">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-lg shadow-emerald-900/20">
          <ShieldCheck className="h-7 w-7" aria-hidden />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t("loading")}
        </div>
      </div>
    );
  }

  if (phase === "login") {
    return (
      <LoginScreen
        onAuthenticated={async (res) => {
          setMe(res);
          setPhase("ready");
        }}
      />
    );
  }

  return (
    <Ctx.Provider value={{ me: me!, setMe, refreshMe, logout }}>
      {children}
    </Ctx.Provider>
  );
}
