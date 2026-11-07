"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  ShieldCheck, RefreshCw, KeyRound, Loader2, Mail, Lock, Building2, User,
  AlertTriangle, Eye, EyeOff, Sparkles, Fingerprint, ScrollText, Languages,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";
import type { MeResponse } from "@/lib/auth-client";

interface CaptchaDto { captchaId: string; svg: string }

export interface DemoAccount { label: string; email: string; mfa?: boolean }

const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: "Platform Super Admin", email: "admin@adwacyber.et" },
  { label: "CBE — Org Admin", email: "admin@cbe.com.et" },
  { label: "CBE — Officer (MFA on)", email: "officer@cbe.com.et", mfa: true },
  { label: "Dashen — Auditor", email: "auditor@dashen.com.et" },
  { label: "Ethio Telecom — Viewer", email: "viewer@ethiotelecom.et" },
];
const ORG_DEMO_PASSWORD = "Adwa#Demo2026!";
const SUPER_DEMO_PASSWORD = "Adwa#Admin2026!";

type Step = "credentials" | "mfa" | "register";

export function LoginScreen({ onAuthenticated }: { onAuthenticated: (me: MeResponse) => void }) {
  const { t, lang, setLang } = useI18n();

  // ── state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaDto | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleMock, setGoogleMock] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const otpRef = useRef<HTMLDivElement>(null);

  // register form
  const [regOrgName, setRegOrgName] = useState("");
  const [regOrgNameAm, setRegOrgNameAm] = useState("");
  const [regSector, setRegSector] = useState("Banking");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const loadCaptcha = useCallback(async () => {
    setCaptchaAnswer("");
    try {
      const dto = await api<CaptchaDto>("/api/auth/captcha");
      setCaptcha(dto);
    } catch {
      setCaptcha(null);
    }
  }, []);

  useEffect(() => {
    loadCaptcha();
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((c: { googleEnabled: boolean; googleMock?: boolean }) => {
        setGoogleEnabled(c.googleEnabled);
        setGoogleMock(Boolean(c.googleMock));
      })
      .catch(() => undefined);
  }, [loadCaptcha]);

  useEffect(() => {
    if (step === "mfa") setTimeout(() => otpRef.current?.querySelector("input")?.focus(), 80);
  }, [step]);

  // Surface OAuth redirect failures in the same error area.
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("authError");
    if (err) {
      const messages: Record<string, string> = {
        google_not_configured: "Google Sign-In is not configured on this deployment yet.",
        google_state_mismatch: "Google sign-in state mismatch — please retry.",
        google_exchange_failed: "Google rejected the sign-in attempt.",
        google_verification_failed: "Google identity could not be verified.",
        google_no_account:
          "No Adwa Cyber account exists for this Google identity. Ask your administrator to provision it.",
        google_mfa_required:
          "This account enforces platform MFA — sign in with email + authenticator code instead.",
        account_disabled: "This account has been disabled.",
        rate_limited: "Too many attempts — please wait a minute.",
      };
      setError(messages[err] ?? `Sign-in failed: ${err}`);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const handleAuthSuccess = async () => {
    const me = await api<MeResponse>("/api/auth/me");
    onAuthenticated(me);
  };

  const submitCredentials = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!email || !password) {
      setError(lang === "en" ? "Enter your email and password." : "ኢሜይል እና የመግቢያ ቃል ያስፈልጋል።");
      return;
    }
    if (!captcha && !googleEnabled) return;
    if (!captchaAnswer.trim()) {
      setError(t("captchaPlaceholder"));
      return;
    }
    setBusy(true);
    try {
      const res = await api<{
        mfaRequired: boolean;
        mfaToken?: string;
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email, password, captchaId: captcha?.captchaId, captchaAnswer,
        }),
      });
      if (res.mfaRequired && res.mfaToken) {
        setMfaToken(res.mfaToken);
        setOtp("");
        setStep("mfa");
      } else {
        await handleAuthSuccess();
      }
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.message);
        if (err.code === "CAPTCHA_FAILED" || err.code === "INVALID_CREDENTIALS" || err.code === "ACCOUNT_LOCKED") {
          await loadCaptcha(); // always rotate challenge after a failure
        }
      } else {
        setError("Network error — please retry.");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitMfa = async (code: string) => {
    setError(null);
    if (code.length < 6) return;
    setBusy(true);
    try {
      await api("/api/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({ mfaToken, code }),
      });
      await handleAuthSuccess();
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.message);
        if (err.code === "MFA_TOKEN_INVALID") {
          setStep("credentials");
          await loadCaptcha();
        }
      } else {
        setError("Network error — please retry.");
      }
      setOtp("");
      setBusy(false);
    }
  };

  const submitRegister = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!captchaAnswer.trim()) {
      setError(t("captchaPlaceholder"));
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          organizationName: regOrgName,
          organizationNameAm: regOrgNameAm,
          sector: regSector,
          adminName: regName,
          adminEmail: regEmail,
          password: regPassword,
          captchaId: captcha?.captchaId,
          captchaAnswer,
        }),
      });
      await handleAuthSuccess();
    } catch (err) {
      if (err instanceof ApiCallError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
        await loadCaptcha();
      } else {
        setError("Network error — please retry.");
      }
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (acct: DemoAccount) => {
    setEmail(acct.email);
    setPassword(acct.mfa || acct.email.includes("adwacyber.et") ? SUPER_DEMO_PASSWORD : ORG_DEMO_PASSWORD);
    setDemoOpen(false);
  };

  // ── UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-background">
      {/* ── Brand panel ─────────────────────────────────────────────────── */}
      <aside className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-emerald-950 p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px 600px at -10% -10%, rgba(16,185,129,.35), transparent 60%), radial-gradient(900px 500px at 110% 110%, rgba(245,158,11,.22), transparent 55%)",
          }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
              <ShieldCheck className="h-6 w-6 text-emerald-300" aria-hidden />
            </div>
            <div>
              <p className="text-xl font-bold leading-tight">Adwa Cyber</p>
              <p className="text-sm text-emerald-200/80">{t("appSub")}</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md space-y-8">
          <blockquote className="space-y-3">
            <p className="text-3xl font-semibold leading-snug">
              {lang === "en" ? (
                <>Compliance automation for Proclamation 1321/2024 — secured by design.</>
              ) : (
                <>ለአዋጅ 1321/2024 ራስ-ሰር ቅጥ ማረጋገጫ — በዲዛይን የተጠበቀ።</>
              )}
            </p>
            <p className="text-emerald-200/70">
              {lang === "en"
                ? "47 machine-readable obligations, engine-scored assessments, bilingual reporting."
                : "47 ማሽን-ተንብያ ግዴታዎች፣ በሞተር የተመዘገቡ ፍተሻዎች፣ ባለሁለት ቋንቋ ሪፖርቶች።"}
            </p>
          </blockquote>
          <ul className="space-y-4 text-sm">
            {[
              { icon: Fingerprint, en: "Two-factor authentication (TOTP)", am: "የሁለት-ደረጃ ማረጓጊያ (TOTP)" },
              { icon: KeyRound, en: "JWT sessions with rotation & reuse detection", am: "JWT ኮከቦች በሽክርክር እና በመክለሻ" },
              { icon: Building2, en: "Tenant isolation per organization", am: "ለእያንዳንዱ ተቋም የተከፋፈለ" },
              { icon: ScrollText, en: "Full authentication audit trail", am: "ሙሉ የማረጓጊያ ምስክር መዝገብ" },
            ].map(({ icon: Icon, en, am }) => (
              <li key={en} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
                  <Icon className="h-4 w-4 text-emerald-300" aria-hidden />
                </span>
                <span className="text-emerald-100/90">{lang === "en" ? en : am}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-emerald-200/60">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {t("phase1Badge")}
        </div>
      </aside>

      {/* ── Form panel ──────────────────────────────────────────────────── */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile brand header */}
          <div className="flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
                <ShieldCheck className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="font-bold leading-tight">Adwa Cyber</p>
                <p className="text-xs text-muted-foreground">{t("appSub")}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setLang(lang === "en" ? "am" : "en")} aria-label={t("language")}>
              <Languages className="mr-1.5 h-4 w-4" aria-hidden />
              {lang === "en" ? "አማርኛ" : "English"}
            </Button>
          </div>

          {step === "mfa" ? (
            <Card className="border-emerald-200/70 shadow-lg shadow-emerald-900/5 dark:border-emerald-900">
              <CardHeader className="space-y-1">
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-950">
                  <KeyRound className="h-7 w-7 text-emerald-700 dark:text-emerald-400" aria-hidden />
                </div>
                <CardTitle className="text-center">{t("mfaTitle")}</CardTitle>
                <CardDescription className="text-center">{t("mfaSub")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </div>
                )}
                <div className="flex justify-center" ref={otpRef}>
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(v) => {
                      setOtp(v);
                      if (v.length === 6) submitMfa(v);
                    }}
                    disabled={busy}
                    aria-label={t("mfaSub")}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button
                  className="w-full bg-emerald-700 hover:bg-emerald-800"
                  disabled={busy || otp.length < 6}
                  onClick={() => submitMfa(otp)}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />}
                  {t("mfaVerify")}
                </Button>
                <p className="text-center text-xs text-muted-foreground">{t("mfaBackupHint")}</p>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => { setStep("credentials"); setError(null); }}
                >
                  {t("backToLogin")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Tabs value={step === "register" ? "register" : "signin"} onValueChange={(v) => { setStep(v as Step); setError(null); setFieldErrors({}); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">{t("signIn")}</TabsTrigger>
                <TabsTrigger value="register">{t("createAccount")}</TabsTrigger>
              </TabsList>

              {/* ── Sign in ── */}
              <TabsContent value="signin">
                <Card className="border-emerald-200/70 shadow-lg shadow-emerald-900/5 dark:border-emerald-900">
                  <CardHeader className="space-y-1">
                    <CardTitle>{t("signInTitle")}</CardTitle>
                    <CardDescription>{t("signInSub")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {error && (
                      <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span>{error}</span>
                      </div>
                    )}

                    {googleEnabled && (
                      <>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => { window.location.href = "/api/auth/google"; }}
                        >
                          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                          </svg>
                          {t("continueWithGoogle")}
                          {googleMock && (
                            <Badge variant="secondary" className="ml-1.5 border border-amber-300 bg-amber-50 text-[10px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                              DEMO PROVIDER
                            </Badge>
                          )}
                        </Button>
                        <div className="flex items-center gap-3">
                          <Separator className="flex-1" />
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("orEmail")}</span>
                          <Separator className="flex-1" />
                        </div>
                      </>
                    )}

                    <form onSubmit={submitCredentials} className="space-y-4" noValidate>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t("email")}</Label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                          <Input
                            id="email" type="email" autoComplete="email" required
                            className="pl-9" placeholder="you@organization.et"
                            value={email} onChange={(e) => setEmail(e.target.value)}
                            disabled={busy}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">{t("password")}</Label>
                        </div>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                          <Input
                            id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required
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
                      </div>

                      {/* Captcha */}
                      {captcha && (
                        <div className="space-y-2">
                          <Label htmlFor="captcha">{t("captchaLabel")}</Label>
                          <div className="flex items-center gap-3">
                            <img
                              src={`data:image/svg+xml;utf8,${encodeURIComponent(captcha.svg)}`}
                              alt="CAPTCHA"
                              className="h-[62px] w-[170px] rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900"
                              draggable={false}
                            />
                            <Button
                              type="button" variant="outline" size="icon" onClick={loadCaptcha}
                              disabled={busy} aria-label={t("captchaRefresh")} title={t("captchaRefresh")}
                              className="shrink-0"
                            >
                              <RefreshCw className="h-4 w-4" aria-hidden />
                            </Button>
                            <Input
                              id="captcha" autoComplete="off" inputMode="text"
                              placeholder={t("captchaPlaceholder")} className="flex-1 uppercase"
                              value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)}
                              disabled={busy} maxLength={8}
                            />
                          </div>
                        </div>
                      )}

                      <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />}
                        {t("signIn")}
                      </Button>
                    </form>

                    {/* Demo accounts */}
                    <div className="rounded-lg border border-dashed border-emerald-300/70 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between text-sm font-medium text-emerald-900 dark:text-emerald-300"
                        onClick={() => setDemoOpen((o) => !o)}
                        aria-expanded={demoOpen}
                      >
                        <span>{t("demoAccounts")}</span>
                        <span className="text-xs text-muted-foreground">{demoOpen ? "−" : "+"}</span>
                      </button>
                      {demoOpen && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-xs text-muted-foreground">
                            {t("demoSub")}: <code className="rounded bg-emerald-100 px-1 py-0.5 text-[11px] dark:bg-emerald-900">Adwa#Demo2026!</code>
                          </p>
                          {DEMO_ACCOUNTS.map((acct) => (
                            <button
                              key={acct.email} type="button"
                              onClick={() => fillDemo(acct)}
                              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                            >
                              <span className="font-medium">{acct.label}</span>
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                {acct.mfa && <Badge className="h-4 border-emerald-300 bg-emerald-100 px-1 text-[10px] text-emerald-800 hover:bg-emerald-100">MFA</Badge>}
                                {acct.email}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Register organization ── */}
              <TabsContent value="register">
                <Card className="border-emerald-200/70 shadow-lg shadow-emerald-900/5 dark:border-emerald-900">
                  <CardHeader className="space-y-1">
                    <CardTitle>{t("createOrgTitle")}</CardTitle>
                    <CardDescription>{t("createOrgSub")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {error && (
                      <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span>{error}</span>
                      </div>
                    )}
                    <form onSubmit={submitRegister} className="space-y-4" noValidate>
                      <div className="space-y-2">
                        <Label htmlFor="regOrg">{t("orgNameLabel")}</Label>
                        <div className="relative">
                          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                          <Input id="regOrg" className="pl-9" value={regOrgName} onChange={(e) => setRegOrgName(e.target.value)} disabled={busy} required />
                        </div>
                        {fieldErrors.organizationName && <p className="text-xs text-red-600">{fieldErrors.organizationName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="regName">{t("adminName")}</Label>
                        <div className="relative">
                          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                          <Input id="regName" className="pl-9" value={regName} onChange={(e) => setRegName(e.target.value)} disabled={busy} required />
                        </div>
                        {fieldErrors.adminName && <p className="text-xs text-red-600">{fieldErrors.adminName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="regEmail">{t("adminEmail")}</Label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                          <Input id="regEmail" type="email" className="pl-9" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} disabled={busy} required />
                        </div>
                        {fieldErrors.adminEmail && <p className="text-xs text-red-600">{fieldErrors.adminEmail}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="regPassword">{t("choosePassword")}</Label>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                          <Input id="regPassword" type="password" className="pl-9" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} disabled={busy} required />
                        </div>
                        {fieldErrors.password && <p className="text-xs text-red-600">{fieldErrors.password}</p>}
                      </div>

                      {captcha && (
                        <div className="space-y-2">
                          <Label htmlFor="regCaptcha">{t("captchaLabel")}</Label>
                          <div className="flex items-center gap-3">
                            <img
                              src={`data:image/svg+xml;utf8,${encodeURIComponent(captcha.svg)}`}
                              alt="CAPTCHA"
                              className="h-[62px] w-[170px] rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900"
                              draggable={false}
                            />
                            <Button type="button" variant="outline" size="icon" onClick={loadCaptcha} disabled={busy} aria-label={t("captchaRefresh")} className="shrink-0">
                              <RefreshCw className="h-4 w-4" aria-hidden />
                            </Button>
                            <Input id="regCaptcha" autoComplete="off" placeholder={t("captchaPlaceholder")} className="flex-1 uppercase tracking-widest" value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} disabled={busy} maxLength={8} />
                          </div>
                        </div>
                      )}

                      <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={busy}>
                        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Building2 className="mr-2 h-4 w-4" aria-hidden />}
                        {t("createAccount")}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {!googleEnabled && step !== "mfa" && (
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <KeyRound className="h-3 w-3" aria-hidden />
                {t("googleNotConfigured")}
              </span>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
