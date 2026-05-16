import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Archive, ArrowRight, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, Plus, RotateCcw, Search, ShieldAlert, ShieldCheck, Trash2, Upload, X, XCircle,
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useRole } from "@/hooks/use-role";
import { useResolveUser } from "@/hooks/use-resolve-user";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, buildContractsQuery } from "@/lib/api";
import { formatLabel, formatDate, formatCurrency, statusBadgeClass as badgeClass } from "@/lib/utils";
import type { Contract, ContractsResponse, ConflictResult } from "@/types/api";

function WorkflowProgressBar({
  stage,
  rejected,
  totalSteps,
  currentStep,
  stepNames,
}: {
  stage?: string | null;
  rejected?: boolean | null;
  totalSteps?: number | null;
  currentStep?: number | null;
  stepNames?: string[] | null;
}) {
  const isCompleted = stage === "completed";
  const isRejected = !!rejected;

  // Use dynamic step count from workflow; fall back to 9 (default template)
  const n = totalSteps && totalSteps > 0 ? totalSteps : 9;
  // currentStep is 1-indexed; activeIdx is 0-indexed
  const activeIdx = currentStep != null && currentStep > 0 ? currentStep - 1 : 0;
  const segments = Array.from({ length: n }, (_, i) => i);
  const activeLabel = stepNames?.[activeIdx] ?? `Step ${activeIdx + 1}`;

  if (isCompleted) {
    return (
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Document Stage
        </p>
        <div className="flex items-center gap-0.5">
          {segments.map((i) => (
            <div key={i} className="flex flex-1">
              <div className="h-1.5 w-full rounded-full bg-green-500" />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          All {n} stages completed
        </div>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className="mt-3">
        <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Document Stage
        </p>
        <div className="flex items-center gap-0.5">
          {segments.map((i) => (
            <div key={i} className="flex flex-1">
              <div
                className={`h-1.5 w-full rounded-full ${
                  i < activeIdx
                    ? "bg-slate-300 dark:bg-slate-600"
                    : i === activeIdx
                    ? "bg-red-500"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
          <XCircle className="h-3 w-3" />
          Rejected at {activeLabel}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        Document Stage
      </p>
      <div className="flex items-center gap-0.5">
        {segments.map((i) => {
          const isDone = i < activeIdx;
          const isCurrent = i === activeIdx;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full transition-all ${
                  isDone
                    ? "bg-green-500"
                    : isCurrent
                    ? "bg-violet-500"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
              {isCurrent && (
                <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400 whitespace-nowrap">
                  {activeLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getRiskBadgeLabel(contract: Contract) {
  const score = contract.risk_score;
  const level = contract.risk_level;

  if (level && typeof score === "number" && !Number.isNaN(score)) {
    return `${formatLabel(level)} · ${Math.round(score)}/100`;
  }
  if (level) {
    return `${formatLabel(level)} risk`;
  }
  if (typeof score === "number" && !Number.isNaN(score)) {
    return `${Math.round(score)}/100`;
  }
  return "Unrated";
}

function getRiskBadgeClass(contract: Contract) {
  return contract.risk_level
    ? badgeClass(contract.risk_level)
    : "bg-slate-100 text-slate-500";
}

type UploadStep = "upload" | "conflict" | "duplicate" | "review";

type ConflictItem = ConflictResult["conflicts"][number];

function UploadConflictCard({ conflict }: { conflict: ConflictItem }) {
  const [expanded, setExpanded] = useState(false);
  const sev = (conflict.severity || "").toLowerCase();
  const border = sev === "high" || sev === "critical" ? "border-red-200" : sev === "medium" ? "border-amber-200" : "border-green-200";
  const bg    = sev === "high" || sev === "critical" ? "bg-red-50"     : sev === "medium" ? "bg-amber-50"    : "bg-green-50";
  const badge = sev === "high" || sev === "critical" ? "bg-red-100 text-red-700" : sev === "medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
  const icon  = sev === "high" || sev === "critical" ? "text-red-600"  : sev === "medium" ? "text-amber-600" : "text-green-600";

  return (
    <div className={`rounded-xl border ${border} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left ${bg}`}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${icon}`} />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {conflict.contract_a} <span className="font-normal text-slate-500">vs</span> {conflict.contract_b}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{formatLabel(conflict.conflict_type)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge className={badge}>{formatLabel(conflict.severity)}</Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>
      {expanded && (
        <div className="space-y-3 px-4 py-3 bg-white">
          <p className="text-sm text-slate-700 leading-relaxed">{conflict.description}</p>
          <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <div>
              <p className="text-xs font-semibold text-blue-700">Recommendation</p>
              <p className="mt-0.5 text-sm text-blue-800">{conflict.recommendation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ViewMode = "active" | "archived" | "trash";

export default function ContractsPage() {
  const navigate = useNavigate();
  const { isAdminOrManager } = useRole();
  const resolveUser = useResolveUser();

  const [view, setView] = useState<ViewMode>("active");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [meta, setMeta] = useState<ContractsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [runningConflict, setRunningConflict] = useState(false);
  const [conflictResult, setConflictResult] = useState<ConflictResult | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [newContractId, setNewContractId] = useState<string | null>(null);
  const [duplicateContract, setDuplicateContract] = useState<Contract | null>(null);
  const [versionNotes, setVersionNotes] = useState("");
  const [addingVersion, setAddingVersion] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function openUploadModal() {
    setUploadError(null);
    setConflictResult(null);
    setConflictError(null);
    setNewContractId(null);
    setDuplicateContract(null);
    setVersionNotes("");
    setUploadStep("upload");
    setUploadOpen(true);
  }

  function closeUploadModal() {
    if (uploading || runningConflict) return;
    setUploadOpen(false);
  }

  function finishFlow() {
    setUploadOpen(false);
    if (newContractId) {
      navigate(`/contracts/${newContractId}`);
    } else {
      loadContracts();
    }
  }

  async function runConflictDetection(uploadedId: string) {
    setRunningConflict(true);
    setConflictError(null);
    try {
      const scanResult = await api.scanForDuplicates(uploadedId);
      setConflictResult(scanResult);

      const dupConflict = (scanResult.conflicts ?? []).find(
        (c) => c.conflict_type === "duplicate"
      );

      if (dupConflict) {
        const analyzed = scanResult.contracts_analyzed ?? [];
        // Find the first contract in the analyzed list that is NOT the one just uploaded
        const matchedMeta = analyzed.find((c) => c.id !== uploadedId);
        if (matchedMeta) {
          const currentVer = matchedMeta.current_version ?? 1;
          const nextVer = currentVer + 1;
          // Build a minimal Contract object from contracts_analyzed — no extra API call needed
          const minimal: Contract = {
            id: matchedMeta.id,
            title: matchedMeta.title,
            current_version: currentVer,
            contract_type: "other",
            status: "draft",
            workflow_stage: "request",
            parties: [],
            tags: [],
          } as unknown as Contract;
          setDuplicateContract(minimal);
          setVersionNotes(`${matchedMeta.title} v${nextVer}`);
          setUploadStep("duplicate");
          return;
        }
      }

      setUploadStep("review");
    } catch (err) {
      console.error("[conflict] error:", err);
      setConflictError("Conflict detection failed — you can review the contract directly.");
      setUploadStep("review");
    } finally {
      setRunningConflict(false);
    }
  }

  async function handleAddVersion() {
    if (!duplicateContract || !newContractId) return;
    setAddingVersion(true);
    try {
      await api.addVersion(duplicateContract.id, newContractId, versionNotes);
      setUploadOpen(false);
      // Navigate to the existing contract (source contract is now deleted)
      navigate(`/contracts/${duplicateContract.id}`);
    } catch {
      setConflictError("Failed to add version — please try again.");
      setAddingVersion(false);
    }
  }

  async function handleUploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const result = await api.uploadContract(file);
      if (!result?.contract?.id && !result?.id) throw new Error("Upload failed — no contract ID returned.");
      const id = result.contract?.id ?? result.id;
      setNewContractId(id);
      setUploading(false);
      setUploadStep("conflict");
      await runConflictDetection(id);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setUploading(false);
    }
  }

  const loadContracts = async (currentView = view) => {
    setLoading(true);
    setError(null);

    try {
      const query = buildContractsQuery({ search, status, per_page: 50, view: currentView });
      const data = await api.listContracts(query);
      setContracts(Array.isArray(data.contracts) ? data.contracts : []);
      setMeta(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load contracts."
      );
    } finally {
      setLoading(false);
    }
  };

  const switchView = (v: ViewMode) => {
    setView(v);
    setSearch("");
    setStatus("");
    loadContracts(v);
  };

  const location = useLocation();
  useEffect(() => {
    loadContracts(view);
  }, [location.key]);

  const contractGroups = useMemo(() => {
    const counts = new Map<string, number>();

    contracts.forEach((contract) => {
      const type = contract.contract_type || "other";
      counts.set(type, (counts.get(type) || 0) + 1);
    });

    return Array.from(counts.entries()).map(([name, count]) => ({
      name: formatLabel(name),
      count,
    }));
  }, [contracts]);

  const deleteContract = async (id: string) => {
    const confirmed = window.confirm("Move this contract to trash? It will be permanently deleted after 30 days.");
    if (!confirmed) return;
    try {
      await api.deleteContract(id);
      await loadContracts(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete contract.");
    }
  };

  const archiveContract = async (id: string) => {
    try {
      await api.archiveContract(id);
      await loadContracts(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive contract.");
    }
  };

  const unarchiveContract = async (id: string) => {
    try {
      await api.unarchiveContract(id);
      await loadContracts(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unarchive contract.");
    }
  };

  const restoreContract = async (id: string) => {
    try {
      await api.restoreContract(id);
      await loadContracts(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore contract.");
    }
  };

  const permanentDelete = async (id: string) => {
    const confirmed = window.confirm("Permanently delete this contract? This cannot be undone.");
    if (!confirmed) return;
    try {
      await api.permanentDeleteContract(id);
      await loadContracts(view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to permanently delete contract.");
    }
  };

  const daysLeftInTrash = (deletedAt?: string) => {
    if (!deletedAt) return 30;
    const deleted = new Date(deletedAt).getTime();
    const now = Date.now();
    const daysElapsed = Math.floor((now - deleted) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - daysElapsed);
  };

  const viewLabels: Record<ViewMode, string> = {
    active: isAdminOrManager
      ? "All contracts across all users — manage, review, and advance workflows."
      : "Your uploaded contracts — track each document's approval stage below.",
    archived: "Archived contracts — restore them any time to move back to active.",
    trash: "Deleted contracts — restored or permanently removed. Auto-purged after 30 days.",
  };

  return (
    <AppShell
      title="Contracts"
      subtitle={viewLabels[view]}
      contractGroups={contractGroups}
    >
      <Card className="border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* View switcher */}
            <div className="flex gap-1 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/6 p-1 w-fit">
              {(["active", "archived", "trash"] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => switchView(v)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all ${
                    view === v
                      ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  }`}
                >
                  {v === "archived" && <Archive className="h-3.5 w-3.5" />}
                  {v === "trash" && <Trash2 className="h-3.5 w-3.5" />}
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            {view === "active" && (
              <>
                <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && loadContracts(view)}
                      placeholder="Search by title"
                      className="h-11 pl-9"
                    />
                  </div>
                  <select
                    className="h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="terminated">Terminated</option>
                    <option value="renewed">Renewed</option>
                  </select>
                  <Button onClick={() => loadContracts(view)} className="h-11 rounded-xl">
                    Apply filters
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 dark:border-white/10 pt-1">
                  <Button variant="outline" className="h-11 rounded-xl dark:border-slate-600 dark:text-white dark:hover:bg-white/10" onClick={openUploadModal}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload contract
                  </Button>
                  <Button asChild className="h-11 rounded-xl">
                    <Link to="/contracts/new">
                      <Plus className="mr-2 h-4 w-4" />
                      New contract
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading contracts...</p>
        ) : null}

        {!loading && contracts.length === 0 ? (
          <p className="text-sm text-slate-500">No contracts found.</p>
        ) : null}

        {contracts.map((contract) => (
          <Card
            key={contract.id}
            className="cursor-pointer border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm transition hover:border-slate-300 dark:hover:border-white/20 hover:shadow-md"
            onClick={() => navigate(`/contracts/${contract.id}`)}
          >
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-slate-900 dark:text-white">{contract.title}</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {contract.description || "No description provided."}
                  </p>
                </div>

                <div
                  className="flex flex-wrap gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Badge className={badgeClass(contract.status)}>
                    {formatLabel(contract.status)}
                  </Badge>
                  <Badge className={badgeClass(contract.workflow_stage)}>
                    {formatLabel(contract.workflow_stage)}
                  </Badge>
                  <Badge className={getRiskBadgeClass(contract)}>
                    {getRiskBadgeLabel(contract)}
                  </Badge>
                  {view === "archived" && (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Archived
                    </Badge>
                  )}
                  {view === "trash" && (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {daysLeftInTrash((contract as unknown as Record<string, string>).deleted_at)} days left
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-400 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <span className="font-medium text-slate-900 dark:text-white">Type:</span>{" "}
                  {formatLabel(contract.contract_type)}
                </div>
                <div>
                  <span className="font-medium text-slate-900 dark:text-white">Value:</span>{" "}
                  {formatCurrency(contract.value)}
                </div>
                <div>
                  <span className="font-medium text-slate-900 dark:text-white">Start:</span>{" "}
                  {formatDate(contract.start_date)}
                </div>
                <div>
                  <span className="font-medium text-slate-900 dark:text-white">End:</span>{" "}
                  {formatDate(contract.end_date)}
                </div>
                <div>
                  <span className="font-medium text-slate-900 dark:text-white">Version:</span>{" "}
                  {contract.current_version ?? 1}
                </div>
              </div>

              {/* Workflow progress bar — always visible so users know their document stage */}
              <WorkflowProgressBar
                stage={contract.workflow_stage}
                rejected={contract.workflow_rejected}
                totalSteps={contract.workflow_total_steps}
                currentStep={contract.workflow_current_step}
                stepNames={contract.workflow_step_names}
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex flex-col gap-1">
                  <div className="text-sm text-slate-500">
                    Parties:{" "}
                    {contract.parties?.map((party) => party.name).join(", ") ||
                      "No parties added"}
                  </div>
                  {isAdminOrManager && contract.created_by && (
                    <div className="text-xs text-slate-400">
                      Uploaded by:{" "}
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        {resolveUser(contract.created_by_name || contract.created_by)}
                      </span>
                    </div>
                  )}
                </div>

                <div
                  className="flex flex-wrap gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {view === "active" && (
                    <>
                      {contract.workflow_id ? (
                        <Button variant="outline" asChild className="rounded-xl">
                          <Link to={`/workflows/${contract.workflow_id}`}>
                            {isAdminOrManager ? "Manage workflow" : "Track progress"}
                          </Link>
                        </Button>
                      ) : null}
                      <Button variant="outline" asChild className="rounded-xl">
                        <Link to="/conflict-detection">Compare</Link>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => archiveContract(contract.id)}
                        className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => deleteContract(contract.id)}
                        className="rounded-xl"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </>
                  )}

                  {view === "archived" && (
                    <Button
                      variant="outline"
                      onClick={() => unarchiveContract(contract.id)}
                      className="rounded-xl"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Unarchive
                    </Button>
                  )}

                  {view === "trash" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => restoreContract(contract.id)}
                        className="rounded-xl"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restore
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => permanentDelete(contract.id)}
                        className="rounded-xl"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete forever
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {meta ? (
        <p className="mt-4 text-sm text-slate-500">
          Showing {contracts.length} of {meta.total} contracts.
        </p>
      ) : null}

      {uploadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeUploadModal}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#131829] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Upload contract</h2>
              <button
                onClick={closeUploadModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-xs font-medium">
              {(["upload", "conflict", "review"] as const).map((s, i) => {
                const labels = { upload: "Upload", conflict: "Analysis", review: "Review" };
                const stepIdx = { upload: 0, conflict: 1, duplicate: 2, review: 2 }[uploadStep];
                const isDone = i < stepIdx;
                const isCurrent = i === stepIdx;
                return (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold
                      ${isDone ? "bg-green-500 text-white" : isCurrent ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-400"}`}>
                      {isDone ? "✓" : i + 1}
                    </div>
                    <span className={isCurrent ? "text-violet-700" : isDone ? "text-green-700" : "text-slate-400"}>
                      {labels[s]}
                    </span>
                    {i < 2 && <div className={`h-px flex-1 ${isDone ? "bg-green-300" : "bg-slate-200"}`} />}
                  </div>
                );
              })}
            </div>

            <div className="p-6">
              {/* ── Step 1: Upload ─────────────────────────────────── */}
              {uploadStep === "upload" && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); e.target.value = ""; }}
                  />
                  {uploadError && (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                      {uploadError}
                    </div>
                  )}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleUploadFile(f); }}
                    onClick={() => !uploading && fileRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 transition-all ${dragging ? "border-violet-500 bg-violet-50" : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"}`}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
                        <p className="text-sm font-medium text-slate-600">Uploading…</p>
                      </>
                    ) : (
                      <>
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-50">
                          <Upload className="h-7 w-7 text-violet-500" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Drop a file or click to browse</p>
                          <p className="mt-1 text-xs text-slate-400">PDF, DOC, DOCX, TXT</p>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* ── Step 2: Running conflict detection ─────────────── */}
              {uploadStep === "conflict" && (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-violet-500" />
                  <div>
                    <p className="font-semibold text-slate-800">Running conflict detection…</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Comparing your document against existing contracts
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 3a: Duplicate found ────────────────────────── */}
              {uploadStep === "duplicate" && duplicateContract && (
                <div className="space-y-4">
                  {/* Warning banner */}
                  <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">Similar document already exists</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        This document appears identical or very similar to an existing contract.
                        Would you like to save it as a new version instead of a separate contract?
                      </p>
                    </div>
                  </div>

                  {/* Existing contract info */}
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Existing document</p>
                    <p className="font-medium text-slate-900 dark:text-white">{duplicateContract.title}</p>
                    <p className="text-sm text-slate-500">
                      Current version: v{duplicateContract.current_version ?? 1} &nbsp;·&nbsp;
                      New version will be: <span className="font-semibold text-violet-700">v{(duplicateContract.current_version ?? 1) + 1}</span>
                    </p>
                  </div>

                  {/* Version label input */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Version name
                    </label>
                    <Input
                      value={versionNotes}
                      onChange={(e) => setVersionNotes(e.target.value)}
                      placeholder="e.g. Client revision, Updated payment terms…"
                      className="h-10 rounded-xl"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      This will be saved as "{duplicateContract.title} — v{(duplicateContract.current_version ?? 1) + 1}"
                    </p>
                  </div>

                  {conflictError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                      {conflictError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => setUploadStep("review")}
                      disabled={addingVersion}
                    >
                      Keep as separate contract
                    </Button>
                    <Button
                      className="flex-1 rounded-xl"
                      onClick={handleAddVersion}
                      disabled={addingVersion || !versionNotes.trim()}
                    >
                      {addingVersion ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                      ) : (
                        <>Add as Version {(duplicateContract.current_version ?? 1) + 1}<ArrowRight className="ml-2 h-4 w-4" /></>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Step 3b: Review results ──────────────────────────── */}
              {uploadStep === "review" && (
                <div className="space-y-4">
                  {conflictError && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {conflictError}
                    </div>
                  )}

                  {conflictResult ? (
                    <>
                      {/* Summary banner */}
                      {(() => {
                        const hasConflicts = (conflictResult.total_conflicts ?? 0) > 0;
                        const risk = (conflictResult.overall_risk || "").toLowerCase();
                        const bannerBg = risk === "high" || risk === "critical" ? "bg-red-50 border-red-200" : risk === "medium" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200";
                        return (
                          <div className={`flex items-start gap-3 rounded-xl border p-4 ${bannerBg}`}>
                            {hasConflicts
                              ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                              : <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />}
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {hasConflicts
                                  ? `${conflictResult.total_conflicts} conflict${conflictResult.total_conflicts !== 1 ? "s" : ""} detected`
                                  : "No conflicts detected"}
                              </p>
                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{conflictResult.summary}</p>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Conflict cards */}
                      {conflictResult.conflicts.length > 0 && (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {conflictResult.conflicts.map((c) => (
                            <UploadConflictCard key={c.id} conflict={c} />
                          ))}
                        </div>
                      )}

                      {conflictResult.conflicts.length === 0 && (
                        <div className="flex flex-col items-center gap-3 rounded-2xl border border-green-100 bg-green-50 py-8 text-center">
                          <ShieldCheck className="h-10 w-10 text-green-500" />
                          <div>
                            <p className="font-semibold text-slate-800">All clear!</p>
                            <p className="mt-0.5 text-sm text-slate-500">No conflicting clauses found with existing contracts.</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : !conflictError ? (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 py-8 text-center">
                      <ShieldAlert className="h-10 w-10 text-slate-400" />
                      <p className="text-sm text-slate-500">No existing contracts to compare against.</p>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 pt-2">
                    {newContractId && (
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => { setUploadOpen(false); navigate(`/contracts/${newContractId}`); }}
                      >
                        View contract
                      </Button>
                    )}
                    <Button
                      className="ml-auto rounded-xl"
                      onClick={finishFlow}
                    >
                      Done — go to contracts
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}