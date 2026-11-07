"use client";

import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import {
  KeyRound, Loader2, ShieldCheck, Copy, Check, AlertTriangle, Smartphone, Lock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";

interface SetupResponse {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
  account: string;
}

interface EnableResponse {
  enabled: true;
  backupCodes: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onMfaChanged: (enabled: boolean) => void;
  mfaEnabled: boolean; // current state — drives enrollment vs management panel
}

/** MFA management: enrollment flow (QR → confirm → backup codes) or, when
 *  already enabled, re-authenticated disable panel. */
export function MfaSetupDialog({ open, onClose, onMfaChanged, mfaEnabled }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();

  const [phase, setPhase] = useState<"intro" | "enroll" | "backup" | "disable">(mfaEnabled ? "disable" : "intro");
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<SetupResponse>("/api/auth/mfa/setup", { method: "POST" });
      setSetup(res);
      setCode("");
      setPhase("enroll");
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : "Network error.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!setup || code.length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<EnableResponse>("/api/auth/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setBackupCodes(res.backupCodes);
      setPhase("backup");
      onMfaChanged(true);
      toast({ title: t("mfaActive"), description: t("backupCodesSub") });
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : "Network error.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/mfa/disable", {
        method: "POST",
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      });
      onMfaChanged(false);
      toast({ title: t("mfaOff") });
      resetAndClose();
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : "Network error.");
    } finally {
      setBusy(false);
    }
  };

  const resetAndClose = () => {
    setPhase(mfaEnabled ? "disable" : "intro");
    setSetup(null);
    setCode("");
    setBackupCodes([]);
    setError(null);
    setDisablePassword("");
    setDisableCode("");
    setCopied(false);
    onClose();
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? undefined : resetAndClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {phase === "disable" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
                {t("mfaActive")}
              </DialogTitle>
              <DialogDescription>
                {t("mfaSub")} — Google Authenticator · Authy · Aegis · 1Password
              </DialogDescription>
            </DialogHeader>
            <MfaDisablePanel
              onDisabled={() => {
                onMfaChanged(false);
                toast({ title: t("mfaOff") });
                resetAndClose();
              }}
            />
          </>
        )}

        {phase === "intro" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
                {t("security")}
              </DialogTitle>
              <DialogDescription>{t("mfaSetupSub")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Smartphone className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
                  TOTP two-factor authentication
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  <li>Google Authenticator · Authy · Aegis · 1Password</li>
                  <li>6-digit codes, 30-second rotation (RFC 6238)</li>
                  <li>10 one-time backup codes on activation</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={start} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />}
                  {t("mfaEnable")}
                </Button>
                <Button variant="ghost" onClick={resetAndClose}>{t("cancel")}</Button>
              </div>
            </div>
          </>
        )}

        {phase === "enroll" && setup && (
          <>
            <DialogHeader>
              <DialogTitle>{t("mfaSetupTitle")}</DialogTitle>
              <DialogDescription>{t("mfaSetupSub")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm font-medium">{t("mfaScanStep")}</p>
                <div className="flex justify-center rounded-xl border border-emerald-200 bg-white p-4 dark:border-emerald-900">
                  <img src={setup.qrDataUrl} alt="TOTP QR code" className="h-48 w-48" draggable={false} />
                </div>
                <div className="rounded-lg border border-dashed border-emerald-300/70 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-xs text-muted-foreground">{t("mfaManualStep")}:</p>
                  <code className="mt-1 block break-all font-mono text-sm tracking-wider">{setup.secret}</code>
                  <p className="mt-1 text-xs text-muted-foreground">{setup.account}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">{t("mfaConfirmStep")}</p>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={code} onChange={(v) => { setCode(v); if (v.length === 6) setTimeout(confirm, 150); }} disabled={busy} aria-label="TOTP confirmation code">
                    <InputOTPGroup>
                      <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={confirm} disabled={busy || code.length < 6}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />}
                  {t("mfaEnable")}
                </Button>
              </div>
            </div>
          </>
        )}

        {phase === "backup" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
                {t("mfaActive")}
              </DialogTitle>
              <DialogDescription>{t("backupCodesSub")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {backupCodes.map((c) => (
                  <code key={c} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center font-mono text-sm tracking-wide text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {c}
                  </code>
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={copyCodes}>
                {copied ? <Check className="mr-2 h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="mr-2 h-4 w-4" aria-hidden />}
                {copied ? t("copied") : t("copyCodes")}
              </Button>
              <Button className="w-full bg-emerald-700 hover:bg-emerald-800" onClick={resetAndClose}>
                {t("save")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Small inline panel used inside Security settings to disable MFA. */
export function MfaDisablePanel({ onDisabled }: { onDisabled: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/mfa/disable", {
        method: "POST",
        body: JSON.stringify({ password, code }),
      });
      onDisabled();
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : "Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{t("disableMfaConfirm")}</p>
      <div className="space-y-2">
        <Label htmlFor="dis-pw">{t("password")}</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="dis-pw" type="password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dis-code">{t("mfaVerify")}</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="dis-code" className="pl-9 tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} placeholder="123456" maxLength={10} />
        </div>
      </div>
      <Button variant="destructive" className="w-full" onClick={submit} disabled={busy || !password || code.length < 6}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <AlertTriangle className="mr-2 h-4 w-4" aria-hidden />}
        {t("disableMfa")}
      </Button>
    </div>
  );
}

/** Status badge for the user menu. */
export function MfaBadge({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  return enabled ? (
    <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      <ShieldCheck className="mr-1 h-3 w-3" aria-hidden />
      {t("mfaActive")}
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">{t("mfaOff")}</Badge>
  );
}
