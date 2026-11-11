"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { I18nProvider, useI18n } from "@/lib/i18n";

function ResetPasswordInner() {
  const { t, lang } = useI18n();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  React.useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const dto = await res.json();
      if (!res.ok) {
        setError(dto?.error?.message ?? "Reset failed.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error — please retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-4 dark:from-emerald-950 dark:to-background">
      <Card className="w-full max-w-md border-emerald-200/70 shadow-lg shadow-emerald-900/5 dark:border-emerald-900">
        <CardHeader className="space-y-1">
          <div className="mb-1 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide">Adwa Cyber</span>
          </div>
          <CardTitle>{t("resetPasswordTitle")}</CardTitle>
          <CardDescription>{t("resetPasswordSub")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t("resetDone")}</span>
            </div>
          ) : token === null ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t("resetInvalid")}</span>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("newPassword")}</Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required
                    className="pl-9 pr-10" placeholder="••••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                  />
                  <button
                    type="button" onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === "en" ? "At least 10 characters with letters and numbers." : "ቢያንስ 10 ፊደላት ከቁጥር ጋር።"}
                </p>
              </div>
              <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <KeyRound className="mr-2 h-4 w-4" aria-hidden />}
                {t("resetSubmit")}
              </Button>
            </form>
          )}
          <Button variant="ghost" className="w-full" onClick={() => { window.location.href = "/"; }}>
            {t("backToSignIn")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <I18nProvider>
      <ResetPasswordInner />
    </I18nProvider>
  );
}
