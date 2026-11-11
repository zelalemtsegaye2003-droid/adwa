"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { I18nProvider, useI18n } from "@/lib/i18n";

function VerifyEmailInner() {
  const { t } = useI18n();
  const [state, setState] = useState<"verifying" | "done" | "invalid">("verifying");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    let cancelled = false;
    // Async flow — state updates land in promise callbacks, never
    // synchronously inside the effect body (avoids cascading renders).
    Promise.resolve(token).then(async (t) => {
      if (!t) {
        if (!cancelled) setState("invalid");
        return;
      }
      try {
        const res = await fetch("/api/auth/verify-email/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t }),
        });
        const dto = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setState("done");
        } else {
          setState("invalid");
          setMessage(dto?.error?.message ?? null);
        }
      } catch {
        if (cancelled) return;
        setState("invalid");
        setMessage("Network error — please retry.");
      }
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-4 dark:from-emerald-950 dark:to-background">
      <Card className="w-full max-w-md border-emerald-200/70 shadow-lg shadow-emerald-900/5 dark:border-emerald-900">
        <CardHeader className="space-y-1">
          <div className="mb-1 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide">Adwa Cyber</span>
          </div>
          <CardTitle>{t("verifyTitle")}</CardTitle>
          <CardDescription>
            {state === "verifying" ? t("verifying") : state === "done" ? t("verifyDone") : message ?? t("resetInvalid")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          {state === "verifying" && <Loader2 className="h-8 w-8 animate-spin text-emerald-700 dark:text-emerald-400" aria-label={t("verifying")} />}
          {state === "done" && <CheckCircle2 className="h-10 w-10 text-emerald-600" aria-hidden />}
          {state === "invalid" && <AlertTriangle className="h-10 w-10 text-amber-500" aria-hidden />}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <I18nProvider>
      <VerifyEmailInner />
    </I18nProvider>
  );
}
