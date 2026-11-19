"use client";

/**
 * Adwa Cyber — Evidence Vault UI.
 * Upload (drag & drop + progress), browse, preview, version, archive and
 * soft-delete compliance artefacts — with SHA-256 integrity visibility.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  FolderLock, UploadCloud, Search, MoreHorizontal, Download, Eye, History,
  HardDrive, Copy, Check, Archive, ArchiveRestore, Pencil, Trash2, Loader2,
  ShieldAlert, X, FileText, FileSpreadsheet, FileImage, FileArchive,
  FileCheck2, GitBranch, Lock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api, ApiCallError, tryRefresh } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";
import {
  EVIDENCE_CATEGORIES, CATEGORY_LABELS, MAX_FILE_BYTES, ACCEPTED_EXTENSIONS,
  formatBytes, fileExt, isPreviewable, type EvidenceCategory,
} from "@/lib/compliance/evidence-shared";

// ── DTOs ─────────────────────────────────────────────────────────────────────

interface EvidenceDoc {
  id: string; title: string; description: string | null; category: string;
  tags: string | null; fileName: string; mimeType: string; fileSize: number;
  checksum: string; status: string; version: number; rootId: string | null;
  downloads: number; lastVerifiedAt: string | null; createdAt: string;
  organizationId: string; orgName: string;
  uploadedBy: { id: string; name: string; email: string };
  isSelfUpload: boolean;
}

interface EvidenceStats {
  total: number; active: number; archived: number; superseded: number;
  versionedChains: number; storageBytes: number; totalDownloads: number;
  byCategory: Record<string, number>;
}

interface EvidenceResponse {
  documents: EvidenceDoc[];
  stats: EvidenceStats;
  scope: string;
}

interface OrgOption { id: string; name: string }

// Rules Engine: link DTOs
interface EvidenceRuleLink {
  id: string; ruleId: string; code: string; article: string;
  titleEn: string; titleAm: string; severity: string; pillar: string;
  linkType: string; source: string; createdBy: string; createdAt: string;
}
interface RuleSearchResult {
  id: string; code: string; titleEn: string; titleAm: string; severity: string;
}

// ── Visual maps (Ethiopian palette: emerald / teal / amber / orange / red) ────

const CAT_CLS: Record<string, string> = {
  POLICY: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
  AUDIT_REPORT: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900",
  CERTIFICATE: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
  TRAINING_RECORD: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900",
  INCIDENT_LOG: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900",
  ASSESSMENT: "bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-900",
  CONFIG_EXPORT: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900/60 dark:text-stone-300 dark:border-stone-700",
  OTHER: "bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-900 dark:text-neutral-300 dark:border-neutral-700",
};

const STATUS_CLS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  ARCHIVED: "bg-stone-100 text-stone-700 border-stone-300 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700",
  SUPERSEDED: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
};

function FileIcon({ name, className }: { name: string; className?: string }) {
  const ext = fileExt(name);
  if (["xlsx", "csv"].includes(ext)) return <FileSpreadsheet className={className} aria-hidden />;
  if (["png", "jpg", "jpeg"].includes(ext)) return <FileImage className={className} aria-hidden />;
  if (ext === "zip") return <FileArchive className={className} aria-hidden />;
  return <FileText className={className} aria-hidden />;
}

// ── Component ────────────────────────────────────────────────────────────────

export function EvidenceView({
  canUpload, canManage, isSuperAdmin,
}: {
  canUpload: boolean;
  canManage: boolean; // evidence:manage-org / manage-all (archive-any + delete)
  isSuperAdmin: boolean;
}) {
  const { t, lang, pick } = useI18n();
  const { toast } = useToast();

  const [data, setData] = useState<EvidenceResponse | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [fCategory, setFCategory] = useState("ALL");
  const [fStatus, setFStatus] = useState("ACTIVE");
  const [fOrg, setFOrg] = useState("all");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const query = useCallback(() => {
    const p = new URLSearchParams();
    if (debounced) p.set("search", debounced);
    if (fCategory !== "ALL") p.set("category", fCategory);
    if (fStatus !== "ACTIVE") p.set("status", fStatus);
    if (isSuperAdmin && fOrg !== "all") p.set("org", fOrg);
    return p.toString();
  }, [debounced, fCategory, fStatus, fOrg, isSuperAdmin]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await api<EvidenceResponse>(`/api/evidence?${query()}`);
      setData(res);
    } catch (err) {
      setLoadError(err instanceof ApiCallError ? err.message : "Failed to load evidence library.");
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isSuperAdmin) {
      api<{ organizations: OrgOption[] }>("/api/organizations")
        .then((r) => setOrgs(r.organizations))
        .catch(() => undefined);
    }
  }, [isSuperAdmin]);

  // ── Upload dialog state ─────────────────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<EvidenceDoc | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uTitle, setUTitle] = useState("");
  const [uCategory, setUCategory] = useState<string>("POLICY");
  const [uDescription, setUDescription] = useState("");
  const [uTags, setUTags] = useState("");
  const [uOrg, setUOrg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openUpload = (replace?: EvidenceDoc | null) => {
    setReplaceTarget(replace ?? null);
    setFile(null);
    setUploadError(null);
    setFieldErrors({});
    setProgress(null);
    if (replace) {
      setUTitle(replace.title);
      setUCategory(replace.category);
      setUDescription(replace.description ?? "");
      setUTags(replace.tags ?? "");
    } else {
      setUTitle("");
      setUCategory("POLICY");
      setUDescription("");
      setUTags("");
    }
    setUOrg("");
    setUploadOpen(true);
  };

  const validateFile = (f: File): string | null => {
    if (f.size === 0) return pick("The file is empty.", "ፋይሉ ባዶ ነው።");
    if (f.size > MAX_FILE_BYTES) return pick("File exceeds the 10 MB limit.", "ፋይሉ ከ10 MB ገደባ በላይ ነው።");
    const ext = fileExt(f.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return pick(
        `Type .${ext || "?"} is not allowed. Accepted: ${ACCEPTED_EXTENSIONS.map((e) => "." + e).join(", ")}.`,
        `ዓይነት .${ext || "?"} አይፈቀድም።`
      );
    }
    return null;
  };

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    const err = validateFile(f);
    if (err) {
      setUploadError(err);
      setFile(null);
      return;
    }
    setUploadError(null);
    setFile(f);
    // Auto-title from filename on first pick (unless replacing).
    if (!replaceTarget && !uTitle) {
      setUTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 120));
    }
  };

  const sendUpload = (retried = false) => {
    if (!file) return;
    if (isSuperAdmin && !uOrg) {
      setUploadError(pick("Select the organization this evidence belongs to.", "ማስረጃው የሚገባውን ተቋም ይምረጡ።"));
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", uTitle);
    fd.append("category", uCategory);
    fd.append("description", uDescription);
    fd.append("tags", uTags);
    if (isSuperAdmin) fd.append("organizationId", uOrg);
    if (replaceTarget) fd.append("replaceId", replaceTarget.id);

    setProgress(0);
    setUploadError(null);
    setFieldErrors({});
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/evidence/upload");
    xhr.withCredentials = true;
    xhr.setRequestHeader("X-Requested-With", "adwa-cyber");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = async () => {
      if (xhr.status === 401 && !retried) {
        const ok = await tryRefresh();
        if (ok) { sendUpload(true); return; }
      }
      let payload: { error?: { message?: string; fieldErrors?: Record<string, string> } } | null = null;
      try { payload = JSON.parse(xhr.responseText); } catch { /* non-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        toast({
          title: replaceTarget
            ? pick(`New version uploaded — ${uTitle}`, `አዲስ እትም ተሰቀለ — ${uTitle}`)
            : pick("Evidence stored ✓", "ማስረጃ ተቀመጠ ✓"),
          description: `${file.name} · ${formatBytes(file.size)} · SHA-256 ${pick("recorded", "ተመዝግቧል")}`,
        });
        setUploadOpen(false);
        setFile(null);
        await load();
      } else {
        setUploadError(payload?.error?.message ?? `Upload failed (${xhr.status}).`);
        setFieldErrors(payload?.error?.fieldErrors ?? {});
      }
      setProgress(null);
    };
    xhr.onerror = () => {
      setUploadError(pick("Network error during upload.", "በማስቀለት ላይ የአውታረ መረብ ስህተት።"));
      setProgress(null);
    };
    xhr.send(fd);
  };

  // ── Details dialog (with version chain) ─────────────────────────────────────
  const [detailsDoc, setDetailsDoc] = useState<EvidenceDoc | null>(null);
  const [chain, setChain] = useState<EvidenceDoc[] | null>(null);

  // Rules Engine: obligations linked to the open document
  const [docLinks, setDocLinks] = useState<EvidenceRuleLink[] | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<RuleSearchResult[] | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);

  const loadDocLinks = async (evidenceId: string) => {
    try {
      const res = await api<{ links: EvidenceRuleLink[] }>(`/api/rules/links?evidenceId=${evidenceId}`);
      setDocLinks(res.links);
    } catch { setDocLinks([]); }
  };

  const openDetails = async (doc: EvidenceDoc) => {
    setDetailsDoc(doc);
    setChain(null);
    setDocLinks(null);
    setLinkQuery("");
    setLinkResults(null);
    loadDocLinks(doc.id);
    if (doc.rootId || doc.version > 1) {
      try {
        const res = await api<EvidenceResponse>(
          `/api/evidence?rootId=${doc.rootId ?? doc.id}&status=ALL`
        );
        setChain(res.documents.sort((a, b) => a.version - b.version));
      } catch { setChain([]); }
    }
  };

  // Debounced rule search for the link picker.
  useEffect(() => {
    const q = linkQuery.trim();
    if (q.length < 2) { setLinkResults(null); return; }
    const id = setTimeout(() => {
      api<{ rules: RuleSearchResult[] }>(`/api/rules?q=${encodeURIComponent(q)}`)
        .then((d) => setLinkResults(d.rules.slice(0, 6)))
        .catch(() => setLinkResults([]));
    }, 250);
    return () => clearTimeout(id);
  }, [linkQuery]);

  const linkRule = async (rule: RuleSearchResult) => {
    if (!detailsDoc) return;
    setLinkBusy(true);
    try {
      await api("/api/rules/links", {
        method: "POST",
        body: JSON.stringify({ evidenceId: detailsDoc.id, ruleCode: rule.code }),
      });
      toast({ title: pick(`Linked to ${rule.code} ✓`, `${rule.code} ጋር ተያይዟል ✓`) });
      setLinkQuery("");
      setLinkResults(null);
      await loadDocLinks(detailsDoc.id);
    } catch (err) {
      toast({
        title: pick("Link failed", "መያያዝ አልተሳካም"),
        description: err instanceof ApiCallError ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLinkBusy(false);
    }
  };

  const unlinkRule = async (linkId: string, code: string) => {
    if (!detailsDoc) return;
    setLinkBusy(true);
    try {
      await api(`/api/rules/links?id=${linkId}`, { method: "DELETE" });
      toast({ title: pick(`Unlinked from ${code}`, `ከ${code} ተነጠለ`) });
      await loadDocLinks(detailsDoc.id);
    } catch (err) {
      toast({
        title: pick("Unlink failed", "መነጠል አልተሳካም"),
        description: err instanceof ApiCallError ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLinkBusy(false);
    }
  };

  // ── Edit metadata dialog ────────────────────────────────────────────────────
  const [editDoc, setEditDoc] = useState<EvidenceDoc | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eCategory, setECategory] = useState("POLICY");
  const [eDescription, setEDescription] = useState("");
  const [eTags, setETags] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (doc: EvidenceDoc) => {
    setEditDoc(doc);
    setETitle(doc.title);
    setECategory(doc.category);
    setEDescription(doc.description ?? "");
    setETags(doc.tags ?? "");
  };

  const saveEdit = async () => {
    if (!editDoc) return;
    setSavingEdit(true);
    try {
      await api(`/api/evidence/${editDoc.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: eTitle, category: eCategory, description: eDescription, tags: eTags,
        }),
      });
      toast({ title: pick("Metadata updated ✓", "መረጃ ተስተካክሏል ✓") });
      setEditDoc(null);
      await load();
    } catch (err) {
      toast({
        title: pick("Update failed", "ማዘመን አልተሳካም"),
        description: err instanceof ApiCallError ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Lifecycle actions ───────────────────────────────────────────────────────
  const [deleteDoc, setDeleteDoc] = useState<EvidenceDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const patchDoc = async (doc: EvidenceDoc, body: Record<string, unknown>, msg: string) => {
    setBusyId(doc.id);
    try {
      await api(`/api/evidence/${doc.id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast({ title: msg });
      await load();
      if (detailsDoc?.id === doc.id) {
        const fresh = await api<EvidenceResponse>(`/api/evidence?rootId=${doc.rootId ?? doc.id}&status=ALL`).catch(() => null);
        if (fresh) {
          const me = fresh.documents.find((d) => d.id === doc.id) ?? null;
          setDetailsDoc(me);
          setChain(fresh.documents.sort((a, b) => a.version - b.version));
        }
      }
    } catch (err) {
      toast({
        title: pick("Action failed", "ተግባሩ አልተሳካም"),
        description: err instanceof ApiCallError ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDoc) return;
    setDeleting(true);
    try {
      await api(`/api/evidence/${deleteDoc.id}`, { method: "DELETE" });
      toast({
        title: pick("Document deleted", "ሰነዱ ተሰርዟል"),
        description: pick("Soft-deleted — file retained for forensic review.", "ለፍርዳዊ ክለሳ ፋይሉ ተጠብቋል።"),
      });
      setDeleteDoc(null);
      await load();
    } catch (err) {
      toast({
        title: pick("Delete failed", "ማጥፋት አልተሳካም"),
        description: err instanceof ApiCallError ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const download = (doc: EvidenceDoc) => {
    window.open(`/api/evidence/${doc.id}/download`, "_blank");
    setTimeout(() => { load(); }, 2000);
  };
  const preview = (doc: EvidenceDoc) => {
    window.open(`/api/evidence/${doc.id}/download?inline=1`, "_blank");
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t("copied") });
    } catch {
      toast({ title: pick("Copy failed", "ማቅዳት አልተሳካም"), variant: "destructive" });
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString(lang === "en" ? "en-GB" : "am-ET", {
          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        })
      : "—";

  const canMutateRow = (doc: EvidenceDoc) =>
    canManage || (canUpload && doc.isSelfUpload);

  const stats = data?.stats;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-end gap-4">
        {canUpload ? (
          <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => openUpload(null)}>
            <UploadCloud className="mr-2 h-4 w-4" aria-hidden />
            {t("evUpload")}
          </Button>
        ) : (
          <Badge variant="outline" className="gap-1.5 border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            {t("evReadOnly")}
          </Badge>
        )}
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { icon: FileCheck2, label: t("evActiveDocs"), value: stats ? String(stats.active) : "—", sub: stats ? `${stats.total} ${t("evTotalDocs")}` : "" },
          { icon: HardDrive, label: t("evStorage"), value: stats ? formatBytes(stats.storageBytes) : "—", sub: pick("across stored artefacts", "በተቀመጡ ሰነዶች ላይ") },
          { icon: GitBranch, label: t("evChains"), value: stats ? String(stats.versionedChains) : "—", sub: pick("documents under versioning", "እትም ያላቸው ሰነዶች") },
          { icon: Download, label: t("evDownloads"), value: stats ? String(stats.totalDownloads) : "—", sub: pick("integrity-verified", "የተረጋገጠ") },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-emerald-100 bg-white p-4 dark:border-emerald-950 dark:bg-background">
            <div className="flex items-center gap-2 text-muted-foreground">
              <s.icon className="h-4 w-4 text-emerald-700 dark:text-emerald-500" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wide">{s.label}</span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("evSearch")}
            className="pl-8"
            aria-label={t("evSearch")}
          />
        </div>
        <Select value={fCategory} onValueChange={setFCategory}>
          <SelectTrigger className="w-[170px]" aria-label={t("evCategory")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("evAllCategories")}</SelectItem>
            {EVIDENCE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{lang === "en" ? CATEGORY_LABELS[c][0] : CATEGORY_LABELS[c][1]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-[150px]" aria-label={t("status")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">{t("active")}</SelectItem>
            <SelectItem value="ARCHIVED">{t("evArchived")}</SelectItem>
            <SelectItem value="SUPERSEDED">{t("evSuperseded")}</SelectItem>
            <SelectItem value="ALL">{t("evAllStatuses")}</SelectItem>
          </SelectContent>
        </Select>
        {isSuperAdmin && (
          <Select value={fOrg} onValueChange={setFOrg}>
            <SelectTrigger className="w-[200px]" aria-label={t("org")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("evAllOrgs")}</SelectItem>
              {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}

      {/* Table */}
      {!data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : data.documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 py-14 text-center dark:border-emerald-900 dark:bg-emerald-950/20">
          <FolderLock className="h-10 w-10 text-emerald-600/60 dark:text-emerald-500/60" aria-hidden />
          <p className="font-medium">{t("evEmpty")}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t("evEmptySub")}</p>
          {canUpload && (
            <Button className="mt-1 bg-emerald-700 hover:bg-emerald-800" onClick={() => openUpload(null)}>
              <UploadCloud className="mr-2 h-4 w-4" aria-hidden />
              {t("evUpload")}
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-emerald-100 bg-white dark:border-emerald-950 dark:bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-emerald-50/60 dark:bg-emerald-950/40">
                <TableHead>{t("evDocument")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("evCategory")}</TableHead>
                <TableHead>{t("evVersion")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("evSize")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("evUploadedBy")}</TableHead>
                <TableHead className="hidden xl:table-cell">SHA-256</TableHead>
                {isSuperAdmin && <TableHead className="hidden xl:table-cell">{t("org")}</TableHead>}
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.documents.map((d) => (
                <TableRow key={d.id} className={busyId === d.id ? "opacity-50" : undefined}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => openDetails(d)}
                      className="flex items-center gap-3 text-left"
                      aria-label={`${t("evDetails")}: ${d.title}`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden>
                        <FileIcon name={d.fileName} className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0 max-w-[260px] sm:max-w-xs">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium hover:underline">{d.title}</span>
                          {d.status !== "ACTIVE" && (
                            <Badge variant="outline" className={`${STATUS_CLS[d.status] ?? ""} shrink-0 hover:bg-transparent`}>
                              {d.status === "ARCHIVED" ? t("evArchived") : t("evSuperseded")}
                            </Badge>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{d.fileName}</span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className={`${CAT_CLS[d.category] ?? CAT_CLS.OTHER} whitespace-nowrap hover:bg-transparent`}>
                      {lang === "en" ? CATEGORY_LABELS[d.category as EvidenceCategory]?.[0] ?? d.category : CATEGORY_LABELS[d.category as EvidenceCategory]?.[1] ?? d.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        v{d.version}
                      </span>
                      {(d.rootId || d.version > 1) && (
                        <button
                          type="button"
                          onClick={() => openDetails(d)}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
                          aria-label={t("evHistory")}
                          title={t("evHistory")}
                        >
                          <History className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">{formatBytes(d.fileSize)}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <p className="text-sm">{d.uploadedBy.name}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(d.createdAt)}</p>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <span className="inline-flex items-center gap-1.5">
                      {d.lastVerifiedAt ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                          title={pick("Integrity verified ", "ተረጋግጧል ") + fmtDate(d.lastVerifiedAt)}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground" title={t("evNotVerified")}>—</span>
                      )}
                      <code className="font-mono text-xs text-muted-foreground">{d.checksum.slice(0, 10)}…</code>
                      <button
                        type="button"
                        onClick={() => copy(d.checksum)}
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-emerald-700"
                        aria-label={pick("Copy checksum", "ኮዱን ቅዳ")}
                        title={pick("Copy checksum", "ኮዱን ቅዳ")}
                      >
                        <Copy className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  </TableCell>
                  {isSuperAdmin && <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">{d.orgName}</TableCell>}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={busyId === d.id} aria-label={`${t("evDetails")} ${d.title}`}>
                          {busyId === d.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MoreHorizontal className="h-4 w-4" aria-hidden />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="max-w-[240px] truncate">{d.title}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openDetails(d)}>
                          <Eye className="mr-2 h-4 w-4" aria-hidden />{t("evDetails")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => download(d)}>
                          <Download className="mr-2 h-4 w-4" aria-hidden />{t("evDownloadBtn")}
                        </DropdownMenuItem>
                        {isPreviewable(d.mimeType) && (
                          <DropdownMenuItem onClick={() => preview(d)}>
                            <FileImage className="mr-2 h-4 w-4" aria-hidden />{t("evPreview")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {canUpload && d.status === "ACTIVE" && (
                          <DropdownMenuItem onClick={() => openUpload(d)}>
                            <History className="mr-2 h-4 w-4" aria-hidden />{t("evNewVersion")}
                          </DropdownMenuItem>
                        )}
                        {canMutateRow(d) && (
                          <DropdownMenuItem onClick={() => openEdit(d)}>
                            <Pencil className="mr-2 h-4 w-4" aria-hidden />{t("evEditMetadata")}
                          </DropdownMenuItem>
                        )}
                        {canMutateRow(d) && d.status === "ACTIVE" && (
                          <DropdownMenuItem onClick={() => patchDoc(d, { action: "archive" }, `${d.title} — ${t("evArchived")}`)}>
                            <Archive className="mr-2 h-4 w-4" aria-hidden />{t("evArchive")}
                          </DropdownMenuItem>
                        )}
                        {canMutateRow(d) && d.status === "ARCHIVED" && (
                          <DropdownMenuItem onClick={() => patchDoc(d, { action: "restore" }, `${d.title} — ${t("active")}`)}>
                            <ArchiveRestore className="mr-2 h-4 w-4" aria-hidden />{t("evRestore")}
                          </DropdownMenuItem>
                        )}
                        {canManage && (
                          <DropdownMenuItem className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400" onClick={() => setDeleteDoc(d)}>
                            <Trash2 className="mr-2 h-4 w-4" aria-hidden />{t("evDelete")}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Upload dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { if (progress === null) setUploadOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
              {replaceTarget ? t("evNewVersion") : t("evUpload")}
            </DialogTitle>
            <DialogDescription>
              {replaceTarget
                ? `${t("evNewVersionOf")} “${replaceTarget.title}” (v${replaceTarget.version} → v${replaceTarget.version + 1})`
                : t("evUploadSub")}
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); if (file) sendUpload(); }}
            noValidate
          >
            {uploadError && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{uploadError}</span>
              </div>
            )}

            {isSuperAdmin && !replaceTarget && (
              <div className="space-y-2">
                <Label>{t("org")}</Label>
                <Select value={uOrg} onValueChange={setUOrg}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dropzone */}
            <div
              role="button"
              tabIndex={0}
              aria-label={t("evDropzone")}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                dragOver
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                  : "border-emerald-200 bg-emerald-50/30 hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20 dark:hover:border-emerald-700"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept={ACCEPTED_EXTENSIONS.map((e) => "." + e).join(",")}
                onChange={(e) => { pickFile(e.target.files?.[0]); e.currentTarget.value = ""; }}
                aria-label={t("evBrowse")}
              />
              {file ? (
                <>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden>
                    <FileIcon name={file.name} className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {file.type || fileExt(file.name).toUpperCase()}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 gap-1 text-xs text-muted-foreground"
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    {t("cancel")}
                  </Button>
                </>
              ) : (
                <>
                  <UploadCloud className="h-8 w-8 text-emerald-600/70 dark:text-emerald-500/70" aria-hidden />
                  <p className="text-sm font-medium">{t("evDropzone")}</p>
                  <p className="text-xs text-muted-foreground">{t("evTypes")}</p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev-title">{t("evTitleLabel")}</Label>
              <Input
                id="ev-title"
                value={uTitle}
                onChange={(e) => setUTitle(e.target.value)}
                required
                disabled={progress !== null}
                placeholder={pick("e.g. Information Security Policy v3.2", "ምሳሌ፦ የመረጃ ደህንነት ፖሊሲ v3.2")}
              />
              {fieldErrors.title && <p className="text-xs text-red-600">{fieldErrors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t("evCategory")}</Label>
              <Select value={uCategory} onValueChange={setUCategory} disabled={progress !== null}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVIDENCE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{lang === "en" ? CATEGORY_LABELS[c][0] : CATEGORY_LABELS[c][1]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.category && <p className="text-xs text-red-600">{fieldErrors.category}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev-desc">{t("evDescription")}</Label>
              <Textarea
                id="ev-desc"
                value={uDescription}
                onChange={(e) => setUDescription(e.target.value)}
                rows={2}
                disabled={progress !== null}
                placeholder={pick("What does this evidence demonstrate?", "ይህ ማስረጃ ምን ያሳያል?")}
              />
              {fieldErrors.description && <p className="text-xs text-red-600">{fieldErrors.description}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ev-tags">{t("evTags")}</Label>
              <Input
                id="ev-tags"
                value={uTags}
                onChange={(e) => setUTags(e.target.value)}
                disabled={progress !== null}
                placeholder={pick("e.g. NBE-15, Art. 22, board-approved", "ምሳሌ፦ NBE-15, አንቀጽ 22")}
              />
              <p className="text-xs text-muted-foreground">{t("evTagsHint")}</p>
            </div>

            {progress !== null && (
              <div className="space-y-1.5">
                <Progress value={progress} className="h-2" aria-label={t("evUploading")} />
                <p className="text-center text-xs text-muted-foreground">{t("evUploading")} {progress}%</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-800"
              disabled={!file || progress !== null || !uTitle.trim()}
            >
              {progress !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <UploadCloud className="mr-2 h-4 w-4" aria-hidden />}
              {replaceTarget ? t("evNewVersion") : t("evUploadBtn")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Details dialog ── */}
      <Dialog open={!!detailsDoc} onOpenChange={(open) => { if (!open) setDetailsDoc(null); }}>
        <DialogContent className="sm:max-w-lg">
          {detailsDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-6">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden>
                    <FileIcon name={detailsDoc.fileName} className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{detailsDoc.title}</span>
                    <span className="block text-xs font-normal text-muted-foreground">v{detailsDoc.version} · {detailsDoc.fileName}</span>
                  </span>
                </DialogTitle>
                <DialogDescription className="sr-only">{t("evDetails")}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={`${CAT_CLS[detailsDoc.category] ?? CAT_CLS.OTHER} hover:bg-transparent`}>
                    {lang === "en" ? CATEGORY_LABELS[detailsDoc.category as EvidenceCategory]?.[0] ?? detailsDoc.category : CATEGORY_LABELS[detailsDoc.category as EvidenceCategory]?.[1] ?? detailsDoc.category}
                  </Badge>
                  <Badge variant="outline" className={`${STATUS_CLS[detailsDoc.status] ?? ""} hover:bg-transparent`}>
                    {detailsDoc.status === "ACTIVE" ? t("active") : detailsDoc.status === "ARCHIVED" ? t("evArchived") : t("evSuperseded")}
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900 hover:bg-transparent">
                    {formatBytes(detailsDoc.fileSize)}
                  </Badge>
                  <Badge variant="outline" className="hover:bg-transparent">
                    {detailsDoc.downloads} {t("evDownloads").toLowerCase()}
                  </Badge>
                </div>

                {detailsDoc.description && <p className="text-sm">{detailsDoc.description}</p>}

                {detailsDoc.tags && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {detailsDoc.tags.split(",").map((tg) => tg.trim()).filter(Boolean).map((tg) => (
                      <span key={tg} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">#{tg}</span>
                    ))}
                  </div>
                )}

                {/* Rules Engine: linked obligations */}
                <div className="rounded-lg border border-emerald-100 p-3 dark:border-emerald-950">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <GitBranch className="h-3.5 w-3.5" aria-hidden />
                    {t("evLinkedRules")}
                    {docLinks !== null && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {docLinks.length}
                      </span>
                    )}
                  </p>
                  {docLinks === null && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
                  {docLinks?.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t("evNoLinks")}</p>
                  )}
                  <ul className="space-y-1.5">
                    {docLinks?.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-2 text-sm dark:border-emerald-950 dark:bg-emerald-950/30">
                        <span className="min-w-0">
                          <code className="mr-1.5 rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{l.code}</code>
                          <span className="truncate align-middle">{lang === "en" ? l.titleEn : l.titleAm}</span>
                          {l.source === "AUTO_TAG" && (
                            <span className="ml-1.5 rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-300" title={t("evAutoTagFull")}>
                              ⚡ {t("evAutoTag")}
                            </span>
                          )}
                        </span>
                        {canUpload && (
                          <button
                            type="button"
                            disabled={linkBusy}
                            onClick={() => unlinkRule(l.id, l.code)}
                            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                            aria-label={`${t("evUnlink")} ${l.code}`}
                            title={t("evUnlink")}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {canUpload && (
                    <div className="relative mt-2">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      <Input
                        value={linkQuery}
                        onChange={(e) => setLinkQuery(e.target.value)}
                        placeholder={t("evLinkSearchPh")}
                        className="h-9 pl-8 text-sm"
                        aria-label={t("evLinkRule")}
                      />
                      {linkResults !== null && linkResults.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-background shadow-lg">
                          {linkResults.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              disabled={linkBusy}
                              onClick={() => linkRule(r)}
                              className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-emerald-50 dark:hover:bg-emerald-950/60"
                            >
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{r.code}</code>
                              <span className="min-w-0 flex-1 truncate">{lang === "en" ? r.titleEn : r.titleAm}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{r.severity}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {linkResults !== null && linkResults.length === 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">{t("evNoRuleMatches")}</p>
                      )}
                    </div>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-emerald-100 p-3 text-sm dark:border-emerald-950">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("evUploadedBy")}</dt>
                    <dd className="font-medium">{detailsDoc.uploadedBy.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("when")}</dt>
                    <dd className="font-medium">{fmtDate(detailsDoc.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("org")}</dt>
                    <dd className="font-medium">{detailsDoc.orgName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("evVerified")}</dt>
                    <dd className="font-medium">{detailsDoc.lastVerifiedAt ? fmtDate(detailsDoc.lastVerifiedAt) : t("evNotVerified")}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>SHA-256</span>
                      <button type="button" onClick={() => copy(detailsDoc.checksum)} className="inline-flex items-center gap-1 rounded p-0.5 text-muted-foreground transition-colors hover:text-emerald-700 dark:hover:text-emerald-400" aria-label={pick("Copy checksum", "ኮዱን ቅዳ")} title={pick("Copy checksum", "ኮዱን ቅዳ")}>
                        <Copy className="h-3 w-3" aria-hidden />
                      </button>
                    </dt>
                    <dd className="break-all rounded bg-emerald-50/60 p-1.5 font-mono text-xs dark:bg-emerald-950/40">{detailsDoc.checksum}</dd>
                  </div>
                </dl>

                {/* Version chain */}
                {(detailsDoc.rootId || detailsDoc.version > 1) && (
                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <GitBranch className="h-3.5 w-3.5" aria-hidden />
                      {t("evHistory")}
                    </p>
                    <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                      {!chain && <li className="text-sm text-muted-foreground">{t("loading")}</li>}
                      {chain?.length === 0 && <li className="text-sm text-muted-foreground">—</li>}
                      {chain?.map((v) => (
                        <li
                          key={v.id}
                          className={`flex items-center justify-between gap-2 rounded-lg border p-2 text-sm ${
                            v.id === detailsDoc.id
                              ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/40"
                              : "border-emerald-100 dark:border-emerald-950"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="mr-1.5 rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">v{v.version}</span>
                            <span className="truncate">{v.fileName}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {v.id === detailsDoc.id && <Badge variant="outline" className="h-5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">{t("evCurrent")}</Badge>}
                            <button
                              type="button"
                              onClick={() => download(v)}
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
                              aria-label={`${t("evDownloadBtn")} v${v.version}`}
                              title={t("evDownloadBtn")}
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  {isPreviewable(detailsDoc.mimeType) && (
                    <Button variant="outline" size="sm" onClick={() => preview(detailsDoc)}>
                      <Eye className="mr-2 h-4 w-4" aria-hidden />{t("evPreview")}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => download(detailsDoc)}>
                    <Download className="mr-2 h-4 w-4" aria-hidden />{t("evDownloadBtn")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit metadata dialog ── */}
      <Dialog open={!!editDoc} onOpenChange={(open) => { if (!open) setEditDoc(null); }}>
        <DialogContent className="sm:max-w-md">
          {editDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
                  {t("evEditMetadata")}
                </DialogTitle>
                <DialogDescription>{editDoc.fileName} · v{editDoc.version}</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => { e.preventDefault(); saveEdit(); }}
                noValidate
              >
                <div className="space-y-2">
                  <Label htmlFor="ed-title">{t("evTitleLabel")}</Label>
                  <Input id="ed-title" value={eTitle} onChange={(e) => setETitle(e.target.value)} required disabled={savingEdit} />
                </div>
                <div className="space-y-2">
                  <Label>{t("evCategory")}</Label>
                  <Select value={eCategory} onValueChange={setECategory} disabled={savingEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVIDENCE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{lang === "en" ? CATEGORY_LABELS[c][0] : CATEGORY_LABELS[c][1]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-desc">{t("evDescription")}</Label>
                  <Textarea id="ed-desc" value={eDescription} onChange={(e) => setEDescription(e.target.value)} rows={2} disabled={savingEdit} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ed-tags">{t("evTags")}</Label>
                  <Input id="ed-tags" value={eTags} onChange={(e) => setETags(e.target.value)} disabled={savingEdit} />
                </div>
                <Button type="submit" className="w-full bg-emerald-700 hover:bg-emerald-800" disabled={savingEdit}>
                  {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  {t("save")}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(open) => { if (!open) setDeleteDoc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("evDeleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteDoc?.title}” — {t("evDeleteHint")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {t("evDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
