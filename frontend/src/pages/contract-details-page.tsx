import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FileEdit,
  FileText,
  History,
  Layers,
  Loader2,
  Plus,
  Send,
  ShieldCheck,
  Tag,
  Trash2,
  Workflow,
  X,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Clock,
  ChevronRight,
  User,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useRole } from "@/hooks/use-role";
import { useResolveUser } from "@/hooks/use-resolve-user";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, API_BASE_URL } from "@/lib/api";
import { cn, formatLabel as fmt, formatDate as fmtDate, formatCurrency as fmtCurrency, statusBadgeClass as badgeClass } from "@/lib/utils";
import type { Contract, Workflow as WorkflowType, Approval, WorkflowTemplate } from "@/types/api";

// ─── Workflow step names (matches DEFAULT_WORKFLOW_STEPS on the backend) ──────
const STEP_LABELS: Record<number, string> = {
  1: "Request & Initiation",
  2: "Authoring & Drafting",
  3: "AI Risk Analysis",
  4: "Review & Negotiation",
  5: "Approval",
  6: "Execution & Signing",
  7: "Storage & Repository",
  8: "Monitoring & Obligations",
  9: "Renewal / Expiration",
};

// ─── Document viewer / editor ────────────────────────────────────────────────

function DocumentPanel({
  contractId,
  contractTitle,
  initialDocumentStatus,
}: {
  contractId: string;
  contractTitle?: string;
  initialDocumentStatus?: string | null;
}) {
  const [fileType, setFileType] = useState("");
  const [hasFile, setHasFile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wopiUrl, setWopiUrl] = useState<string | null>(null);
  const [wopiLoading, setWopiLoading] = useState(false);
  const [wopiError, setWopiError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(initialDocumentStatus === "generating");

  const viewUrl = `${API_BASE_URL}/api/documents/view/${contractId}`;

  const loadWopiUrl = useCallback(async () => {
    if (wopiUrl || wopiLoading || wopiError) return;
    setWopiLoading(true);
    try {
      const data = await api.getWopiUrl(contractId);
      setWopiUrl(data.editor_url);
    } catch (err) {
      setWopiError(err instanceof Error ? err.message : "Could not load LibreOffice editor.");
    } finally {
      setWopiLoading(false);
    }
  }, [contractId, wopiUrl, wopiLoading, wopiError]);

  // Poll the document text endpoint while AI is generating the DOCX
  useEffect(() => {
    if (!generating) return;
    let stopped = false;
    const poll = async () => {
      while (!stopped) {
        await new Promise((r) => setTimeout(r, 4000));
        if (stopped) break;
        try {
          const r = await api.getDocumentText(contractId);
          if (r.has_file) {
            setHasFile(true);
            setFileType(r.file_type || "");
            setGenerating(false);
            setLoading(false);
            break;
          }
        } catch { /* ignore */ }
      }
    };
    poll();
    return () => { stopped = true; };
  }, [generating, contractId]);

  useEffect(() => {
    if (generating) return; // wait for polling to resolve
    let cancelled = false;
    setLoading(true);
    api.getDocumentText(contractId)
      .then((r) => {
        if (cancelled) return;
        setFileType(r.file_type || "");
        setHasFile(r.has_file);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contractId, generating]);

  useEffect(() => {
    if (hasFile) loadWopiUrl();
  }, [hasFile, loadWopiUrl]);

  function handleDownload() {
    const a = document.createElement("a");
    a.href = viewUrl;
    a.download = contractTitle ? `${contractTitle}${fileType}` : `contract${fileType}`;
    a.click();
  }

  if (generating) return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 py-20 text-center dark:border-indigo-500/20 dark:bg-indigo-500/5">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      <p className="font-semibold text-slate-700 dark:text-slate-200">Generating document with AI…</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">This usually takes 20–40 seconds. The editor will open automatically.</p>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-16 dark:border-white/10 dark:bg-white/5">
      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      <span className="text-sm text-slate-500">Loading document…</span>
    </div>
  );

  if (!hasFile) return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center dark:border-white/10 dark:bg-white/5">
      <FileText className="h-10 w-10 text-slate-300" />
      <p className="font-medium text-slate-600 dark:text-slate-300">No document file attached yet</p>
      <p className="text-sm text-slate-400">
        Upload a file from the{" "}
        <Link to="/contracts" className="text-blue-500 underline hover:text-blue-600">
          Contracts page
        </Link>{" "}
        to view it here.
      </p>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#131829]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          <FileEdit className="h-4 w-4 text-indigo-500" />
          LibreOffice Editor
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleDownload} className="h-8 rounded-xl dark:border-white/10 dark:text-white dark:hover:bg-white/10">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Download
          </Button>
          <Badge className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {fileType || "file"}
          </Badge>
        </div>
      </div>

      {/* LibreOffice (Collabora Online via WOPI) */}
      <div style={{ height: "80vh" }}>
        {wopiLoading && (
          <div className="flex h-full items-center justify-center gap-3 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading LibreOffice editor…</span>
          </div>
        )}
        {wopiError && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-medium text-red-600">{wopiError}</p>
            <button
              onClick={() => { setWopiUrl(null); setWopiError(null); loadWopiUrl(); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Retry
            </button>
          </div>
        )}
        {wopiUrl && !wopiLoading && (
          <iframe
            src={wopiUrl}
            title="LibreOffice Editor"
            className="h-full w-full border-0"
            allow="clipboard-read; clipboard-write"
          />
        )}
      </div>
    </div>
  );
}

// ─── Send for Approval panel ─────────────────────────────────────────────────

function SendApprovalPanel({
  contractId,
  workflowId,
  onDone,
  onClose,
}: {
  contractId: string;
  workflowId?: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [approvalType, setApprovalType] = useState("all_required");
  const [approverInput, setApproverInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true); setError(null);
    const ids = approverInput.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await api.createApproval({
        contract_id: contractId,
        workflow_id: workflowId,
        approval_type: approvalType,
        approver_ids: ids,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create approval.");
    } finally { setSubmitting(false); }
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-4 dark:border-blue-500/30 dark:bg-blue-500/10">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-blue-900 flex items-center gap-2 dark:text-blue-200">
          <Send className="h-4 w-4" /> Send for Approval
        </p>
        <button onClick={onClose} className="text-blue-400 hover:text-blue-600"><X className="h-4 w-4" /></button>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approval Type
          </label>
          <select
            value={approvalType}
            onChange={(e) => setApprovalType(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/10 dark:bg-slate-800 dark:text-white"
          >
            <option value="all_required">All Required — everyone must approve</option>
            <option value="majority">Majority — more than half must approve</option>
            <option value="first_person">First Person — first vote decides</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approver User IDs <span className="font-normal normal-case text-slate-400">(comma-separated, optional)</span>
          </label>
          <input
            type="text"
            value={approverInput}
            onChange={(e) => setApproverInput(e.target.value)}
            placeholder="user_abc123, user_def456 — leave blank for admin to decide"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="rounded-xl" onClick={onClose}>Cancel</Button>
        <Button size="sm" className="rounded-xl" onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
          {submitting ? "Submitting…" : "Submit for Approval"}
        </Button>
      </div>
    </div>
  );
}

// ─── Workflow template picker modal ──────────────────────────────────────────

const DEFAULT_STEP_DESCRIPTION =
  "Request & Initiation → Authoring → AI Risk Analysis → Review & Negotiation → Approval → Execution & Signing → Storage → Monitoring → Renewal / Expiration";

function WorkflowTemplatePicker({
  onConfirm,
  onClose,
}: {
  onConfirm: (template: WorkflowTemplate | null) => void;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | "default">("default");

  useEffect(() => {
    api.listWorkflowTemplates()
      .then((list) => setTemplates(list))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const chosenTemplate = templates.find((t) => t.id === selected) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-[#131829] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Choose Workflow Template</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Options */}
        <div className="max-h-72 space-y-2 overflow-y-auto p-4">
          {/* Default 9-step option */}
          <button
            onClick={() => setSelected("default")}
            className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all ${selected === "default"
                ? "border-indigo-500 bg-indigo-50"
                : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/10"
              }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
              <Workflow className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white">Default (9 steps)</p>
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{DEFAULT_STEP_DESCRIPTION}</p>
            </div>
            {selected === "default" && (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            )}
          </button>

          {/* Custom templates */}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-400">
              No custom templates yet.{" "}
              <Link to="/admin/workflow-templates" className="text-indigo-500 underline hover:text-indigo-600">
                Create one
              </Link>
            </div>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all ${selected === t.id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10"
                  }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-500/20">
                  <Layers className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">{t.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t.steps.length} steps
                    {t.description ? ` — ${t.description}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {t.steps.slice(0, 5).map((s, i) => (
                      <span key={i} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {s.name}
                      </span>
                    ))}
                    {t.steps.length > 5 && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-white/10">
                        +{t.steps.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
                {selected === t.id && (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-white/10">
          <p className="text-xs text-slate-400">
            {selected === "default"
              ? "9-step standard workflow will be used"
              : `"${chosenTemplate?.name}" — ${chosenTemplate?.steps.length} steps`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() => onConfirm(chosenTemplate)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Start Workflow
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Workflow status card ─────────────────────────────────────────────────────

function WorkflowCard({
  workflows,
  contractId,
  onWorkflowCreated,
}: {
  workflows: WorkflowType[];
  contractId: string;
  onWorkflowCreated: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = workflows[0] ?? null;

  async function handleConfirm(template: WorkflowTemplate | null) {
    setCreating(true); setError(null); setShowPicker(false);
    try {
      const payload: Record<string, unknown> = {
        contract_id: contractId,
        name: template ? template.name : "Contract Review Workflow",
      };
      if (template?.steps?.length) {
        payload.steps = template.steps.map((s, i) => ({
          step_number: s.step_number ?? i + 1,
          name: s.name,
          step_type: s.step_type,
          description: s.description ?? null,
        }));
      }
      await api.createWorkflow(payload);
      onWorkflowCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start workflow.");
    } finally { setCreating(false); }
  }

  return (
    <>
      {showPicker && (
        <WorkflowTemplatePicker
          onConfirm={handleConfirm}
          onClose={() => setShowPicker(false)}
        />
      )}

      <Card className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-slate-500" /> Workflow
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-xs text-red-600">{error}</p>}

          {!latest ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">No workflow started yet.</p>
              <Button
                size="sm"
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => setShowPicker(true)}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Workflow className="mr-2 h-3.5 w-3.5" />
                )}
                {creating ? "Starting…" : "Start Workflow"}
              </Button>
            </div>
          ) : (
            <>
              {/* Status + step indicator */}
              {(() => {
                const totalSteps = latest.steps?.length ?? 9;
                const isCompleted = latest.status === "completed" || latest.current_step > totalSteps;
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{latest.name || "Review Workflow"}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {isCompleted
                            ? `All ${totalSteps} steps completed`
                            : `Step ${latest.current_step} of ${totalSteps}`}
                        </p>
                      </div>
                      <Badge className={badgeClass(latest.status)}>{fmt(latest.status)}</Badge>
                    </div>

                    {/* Current step name */}
                    <div className={`rounded-xl border px-3 py-2 ${isCompleted ? "border-green-100 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10" : "border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-white/5"}`}>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                        {isCompleted ? "Status" : "Current Step"}
                      </p>
                      <p className={`mt-0.5 text-sm font-semibold ${isCompleted ? "text-green-700 dark:text-green-400" : "text-slate-800 dark:text-white"}`}>
                        {isCompleted
                          ? "Workflow Completed"
                          : (latest.steps?.find((s) => s.step_number === latest.current_step)?.name
                              ?? STEP_LABELS[latest.current_step]
                              ?? `Step ${latest.current_step}`)}
                      </p>
                    </div>
                  </>
                );
              })()}

              {/* Mini step progress bar */}
              <div className="flex items-center gap-1">
                {(latest.steps?.length
                  ? latest.steps
                  : Array.from({ length: 9 }, (_, i) => ({ step_number: i + 1, status: "pending" as const }))
                ).map((step) => {
                  const isDone = step.status === "completed";
                  const isCurrent = step.step_number === latest.current_step;
                  const isRejected = step.status === "rejected";
                  return (
                    <div
                      key={step.step_number}
                      title={"name" in step ? (step as { name: string }).name : STEP_LABELS[step.step_number] ?? `Step ${step.step_number}`}
                      className={`h-2 flex-1 rounded-full transition-all ${isRejected ? "bg-red-400"
                          : isDone ? "bg-green-500"
                            : isCurrent ? "bg-blue-500"
                              : "bg-slate-200"
                        }`}
                    />
                  );
                })}
              </div>
              <p className="text-right text-[10px] text-slate-400">
                {latest.steps?.filter((s) => s.status === "completed").length ?? 0} / {latest.steps?.length ?? 9} steps completed
              </p>

              <Button asChild size="sm" variant="outline" className="w-full rounded-xl">
                <Link to={`/workflows/${latest.id}`}>
                  Open workflow <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Approval status card ─────────────────────────────────────────────────────

function ApprovalCard({
  approvals,
  contractId,
  workflowId,
  currentUserClerkId,
  isAdminOrManager,
  onRefresh,
}: {
  approvals: Approval[];
  contractId: string;
  workflowId?: string;
  currentUserClerkId?: string;
  isAdminOrManager: boolean;
  onRefresh: () => void;
}) {
  const resolveUser = useResolveUser();
  const [showPanel, setShowPanel] = useState(false);
  const [voting, setVoting] = useState<string | null>(null); // approvalId being voted on
  const [voteError, setVoteError] = useState<string | null>(null);
  const latest = approvals[0] ?? null;

  async function handleVote(approvalId: string, decision: string) {
    setVoting(approvalId); setVoteError(null);
    try {
      await api.castVote(approvalId, decision);
      onRefresh();
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : "Vote failed.");
    } finally { setVoting(null); }
  }

  const voteCount = latest
    ? {
      approved: latest.approvers?.filter((a) => a.decision === "approved").length ?? 0,
      rejected: latest.approvers?.filter((a) => a.decision === "rejected").length ?? 0,
      pending: latest.approvers?.filter((a) => !a.decision).length ?? 0,
      total: latest.approvers?.length ?? 0,
    }
    : null;

  const alreadyVoted = !!(latest && currentUserClerkId &&
    latest.approvers?.some((a) => a.user_id === currentUserClerkId && a.decision));

  const isListedApprover = !!(currentUserClerkId && latest &&
    latest.approvers?.some((a) => a.user_id === currentUserClerkId && !a.decision));

  return (
    <Card className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-slate-500" /> Approval
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {voteError && <p className="text-xs text-red-600">{voteError}</p>}

        {!latest && !showPanel && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">No approval request yet.</p>
            <Button
              size="sm"
              className="w-full rounded-xl"
              onClick={() => setShowPanel(true)}
            >
              <Send className="mr-2 h-3.5 w-3.5" /> Send for Approval
            </Button>
          </div>
        )}

        {showPanel && (
          <SendApprovalPanel
            contractId={contractId}
            workflowId={workflowId}
            onDone={() => { setShowPanel(false); onRefresh(); }}
            onClose={() => setShowPanel(false)}
          />
        )}

        {latest && (
          <div className="space-y-4">
            {/* Status header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">{fmt(latest.approval_type)} Approval</p>
                {latest.due_date && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3" /> Due {fmtDate(latest.due_date)}
                  </p>
                )}
              </div>
              <Badge className={badgeClass(latest.status)}>{fmt(latest.status)}</Badge>
            </div>

            {/* Vote tally */}
            {voteCount && voteCount.total > 0 && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-green-50 py-2 dark:bg-green-500/15">
                  <p className="text-lg font-bold text-green-700 dark:text-green-300">{voteCount.approved}</p>
                  <p className="text-[11px] text-green-600 dark:text-green-400">Approved</p>
                </div>
                <div className="rounded-xl bg-red-50 py-2 dark:bg-red-500/15">
                  <p className="text-lg font-bold text-red-700 dark:text-red-300">{voteCount.rejected}</p>
                  <p className="text-[11px] text-red-600 dark:text-red-400">Rejected</p>
                </div>
                <div className="rounded-xl bg-slate-50 py-2 dark:bg-white/5">
                  <p className="text-lg font-bold text-slate-600 dark:text-slate-300">{voteCount.pending}</p>
                  <p className="text-[11px] text-slate-400">Pending</p>
                </div>
              </div>
            )}

            {/* Voting buttons — shown for admins/managers and for listed approvers */}
            {(isAdminOrManager || isListedApprover) && latest.status === "pending" && !alreadyVoted && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cast your vote</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleVote(latest.id, "approved")}
                    disabled={voting === latest.id}
                  >
                    {voting === latest.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <><ThumbsUp className="mr-1 h-3.5 w-3.5" /> Approve</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-xl"
                    onClick={() => handleVote(latest.id, "rejected")}
                    disabled={voting === latest.id}
                  >
                    <ThumbsDown className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-amber-700 border-amber-200 hover:bg-amber-50"
                    onClick={() => handleVote(latest.id, "changes_requested")}
                    disabled={voting === latest.id}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" /> Revise
                  </Button>
                </div>
              </div>
            )}

            {(isAdminOrManager || isListedApprover || alreadyVoted) && latest.status === "pending" && alreadyVoted && (
              <p className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> You have already cast your vote
              </p>
            )}

            {/* Approver list */}
            {(latest.approvers?.length ?? 0) > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Approvers</p>
                <div className="space-y-1.5">
                  {latest.approvers.map((a, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-white/10">
                      <p className="truncate text-xs text-slate-600 max-w-[120px] dark:text-slate-400">{resolveUser(a.user_id)}</p>
                      <Badge className={`text-[10px] ${badgeClass(a.decision ?? "pending")}`}>
                        {a.decision ? fmt(a.decision) : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Send another approval if the last one closed */}
            {["approved", "rejected"].includes(latest.status) && (
              <Button size="sm" variant="outline" className="w-full rounded-xl" onClick={() => setShowPanel(true)}>
                <Send className="mr-2 h-3.5 w-3.5" /> New Approval Request
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Contract AI Chat ─────────────────────────────────────────────────────────

type AiChatMsg = { id: string; role: "user" | "assistant"; content: string; pending?: boolean };

function ContractAIChat({ contractId }: { contractId: string }) {
  const [messages, setMessages] = useState<AiChatMsg[]>([
    { id: "intro", role: "assistant", content: "Hi! I'm your contract assistant. Ask me anything about this document or any general legal question." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);
    const uid = `${Date.now()}-u`;
    const aid = `${Date.now()}-a`;
    setMessages((prev) => [
      ...prev,
      { id: uid, role: "user", content: q },
      { id: aid, role: "assistant", content: "Thinking…", pending: true },
    ]);
    try {
      const data = await api.chat(q, contractId);
      const answer =
        typeof data?.answer === "string" && data.answer.trim()
          ? data.answer
          : "I couldn't generate a response right now.";
      setMessages((prev) =>
        prev.map((m) => (m.id === aid ? { ...m, content: answer, pending: false } : m))
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aid ? { ...m, content: "Request failed — please try again.", pending: false } : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col dark:border-white/10 dark:bg-[#131829]" style={{ height: "calc(80vh + 37px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-white">AI Contract Assistant</p>
          <p className="text-xs text-white/70">Ask questions about this contract or general legal topics</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[80%] items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                <div className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5",
                  isUser
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-violet-600 dark:border-white/10 dark:bg-white/10"
                )}>
                  {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                  isUser
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                )}>
                  {isUser ? (
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-slate-800 dark:prose-invert dark:prose-strong:text-white">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  {msg.pending && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> Generating…
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 shadow-sm">
          <textarea
            ref={textareaRef}
            className="min-h-[36px] max-h-[100px] flex-1 resize-none overflow-y-auto bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about this contract…"
            rows={1}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white transition hover:bg-violet-700 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-400">Enter to send · Shift+Enter for new line</p>
      </div>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContractDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { isAdminOrManager } = useRole();
  const currentUserClerkId = user?.id ?? "";

  const [contract, setContract] = useState<Contract | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowType[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, w, a] = await Promise.all([
        api.getContract(id),
        api.getContractWorkflows(id).catch(() => ({ workflows: [] })),
        api.getApprovalsByContract(id).catch(() => ({ approvals: [] })),
      ]);
      setContract(c);
      setWorkflows(Array.isArray((w as any)?.workflows) ? (w as any).workflows : []);
      setApprovals(Array.isArray((a as any)?.approvals) ? (a as any).approvals : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contract.");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const contractGroups = useMemo(
    () => (contract ? [{ name: fmt(contract.contract_type), count: 1 }] : []),
    [contract]
  );

  async function handleDelete() {
    if (!contract?.id) return;
    if (!window.confirm("Delete this contract? This cannot be undone.")) return;
    setDeleting(true);
    try { await api.deleteContract(contract.id); navigate("/contracts"); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed."); setDeleting(false); }
  }

  async function handleReanalyze() {
    if (!contract?.id || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      await api.analyzeContract(contract.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  const latestWorkflowId = workflows[0]?.id;

  return (
    <AppShell
      title={contract?.title || "Contract Details"}
      subtitle="View, edit and manage your contract document."
      contractGroups={contractGroups}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild className="rounded-xl">
            <Link to="/contracts"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting || !contract} className="rounded-xl">
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading contract…
        </div>
      )}

      {!loading && !contract && <p className="text-sm text-slate-500">Contract not found.</p>}

      {contract && (
        <div className="space-y-6">

          {/* ── Hero strip ───────────────────────────────────────────────── */}
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 px-6 py-5 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl dark:text-white">
                  {contract.title}
                </h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className={badgeClass(contract.status)}>{fmt(contract.status)}</Badge>
                  <Badge className={badgeClass(contract.workflow_stage)}>{fmt(contract.workflow_stage)}</Badge>
                  <Badge className={badgeClass(contract.risk_level)}>{fmt(contract.risk_level || "unrated")}</Badge>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { icon: <FileText className="h-5 w-5 text-violet-500" />, label: "Type", value: fmt(contract.contract_type) },
                { icon: <CircleDollarSign className="h-5 w-5 text-emerald-500" />, label: "Value", value: fmtCurrency(contract.value) },
                { icon: <CalendarDays className="h-5 w-5 text-blue-500" />, label: "Start", value: fmtDate(contract.start_date) },
                { icon: <CalendarDays className="h-5 w-5 text-amber-500" />, label: "End", value: fmtDate(contract.end_date) },
              ].map(({ icon, label, value }) => (
                <Card key={label} className="rounded-2xl border-slate-200 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <CardContent className="flex items-center gap-3 p-4">
                    {icon}
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="mt-0.5 font-semibold text-slate-900 dark:text-white">{value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* ── Document viewer + AI Chat (side by side) ─────────────────── */}
          <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
            <DocumentPanel contractId={contract.id} contractTitle={contract.title} initialDocumentStatus={contract.document_status} />
            <ContractAIChat contractId={contract.id} />
          </div>

          {/* ── Details + sidebar ─────────────────────────────────────────── */}
          <div className="grid gap-6 xl:grid-cols-[1.7fr_0.8fr]">

            {/* Details */}
            <Card className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm">
              <CardHeader><CardTitle>Contract Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <InfoBlock label="Description" value={contract.description || "No description provided."} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoBlock label="Approval Type" value={fmt((contract as any).approval_type)} />
                  <InfoBlock label="Workflow Trigger" value={fmt((contract as any).workflow_trigger)} />
                </div>
                <InfoBlock label="Payment Terms" value={contract.payment_terms || "—"} />

                <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                    <Tag className="h-3.5 w-3.5" /> Tags
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {contract.tags?.length
                      ? contract.tags.map((t, i) => (
                        <Badge key={i} className="bg-violet-100 text-violet-700">{String(t).toUpperCase()}</Badge>
                      ))
                      : <p className="text-sm text-slate-500">No tags</p>}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Parties</p>
                  {contract.parties?.length
                    ? (
                      <div className="space-y-2">
                        {contract.parties.map((p, i) => (
                          <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                            <p className="font-medium text-slate-900 dark:text-white">{p.name || "Unnamed"}</p>
                            <p className="mt-0.5 text-sm text-slate-500">
                              {p.role}{p.organization ? ` · ${p.organization}` : ""}
                            </p>
                            {p.email && <p className="text-xs text-slate-400 mt-0.5">{p.email}</p>}
                          </div>
                        ))}
                      </div>
                    )
                    : <p className="text-sm text-slate-500">No parties added yet.</p>
                  }
                </div>
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="space-y-6">

              {/* Workflow card */}
              <WorkflowCard
                workflows={workflows}
                contractId={contract.id}
                onWorkflowCreated={load}
              />

              {/* Approval card */}
              <ApprovalCard
                approvals={approvals}
                contractId={contract.id}
                workflowId={latestWorkflowId}
                currentUserClerkId={currentUserClerkId}
                isAdminOrManager={isAdminOrManager}
                onRefresh={load}
              />

              {/* AI Risk Analysis */}
              <Card className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-violet-500" /> AI Risk Analysis
                    </CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReanalyze}
                      disabled={analyzing}
                      className="h-7 rounded-lg px-2.5 text-[12px] dark:border-white/10 dark:text-white dark:hover:bg-white/10"
                    >
                      {analyzing
                        ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Analyzing…</>
                        : <><RotateCcw className="mr-1 h-3 w-3" /> Re-analyze</>}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analyzing && (
                    <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5 text-xs text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
                      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                      Running AI analysis on document content…
                    </div>
                  )}
                  {!contract.ai_analysis && !analyzing && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No analysis yet. Click Re-analyze to generate.</p>
                  )}
                  {contract.ai_analysis && (
                    <>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">Risk Score</span>
                          <div className="flex items-center gap-2">
                            <Badge className={badgeClass(contract.ai_analysis.risk_level)}>
                              {fmt(contract.ai_analysis.risk_level)}
                            </Badge>
                            <span className="text-sm font-semibold text-slate-800 dark:text-white">
                              {contract.ai_analysis.risk_score != null ? `${Math.round(contract.ai_analysis.risk_score)}/100` : "—"}
                            </span>
                          </div>
                        </div>
                        {contract.ai_analysis.risk_score != null && (
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                            <div
                              className={`h-full rounded-full transition-all ${
                                (contract.ai_analysis.risk_score ?? 0) >= 67
                                  ? "bg-red-500"
                                  : (contract.ai_analysis.risk_score ?? 0) >= 34
                                  ? "bg-amber-400"
                                  : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min(Math.round(contract.ai_analysis.risk_score), 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                      {contract.ai_analysis.summary && (
                        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 leading-relaxed dark:bg-white/5 dark:text-slate-400">
                          {contract.ai_analysis.summary}
                        </p>
                      )}
                      {(contract.ai_analysis.recommendations?.length ?? 0) > 0 && (
                        <ul className="space-y-1">
                          {contract.ai_analysis.recommendations!.slice(0, 3).map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-500" /> {r}
                            </li>
                          ))}
                        </ul>
                      )}
                      {contract.ai_analysis.analyzed_at && (
                        <p className="text-[10px] text-slate-400">
                          Analyzed {new Date(contract.ai_analysis.analyzed_at).toLocaleString()}
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Version history */}
              {(contract.versions?.length ?? 0) > 0 && (
                <Card className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <History className="h-5 w-5 text-violet-500" /> Version History
                      </span>
                      <Badge className="bg-violet-100 text-violet-700">
                        v{contract.current_version ?? 1} current
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {[...(contract.versions ?? [])].reverse().map((v) => (
                      <div
                        key={v.version_number}
                        className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
                          v.version_number === (contract.current_version ?? 1)
                            ? "border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10"
                            : "border-slate-100 bg-slate-50 dark:border-white/10 dark:bg-white/5"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${
                              v.version_number === (contract.current_version ?? 1)
                                ? "text-violet-700"
                                : "text-slate-500"
                            }`}>
                              v{v.version_number}
                            </span>
                            {v.version_number === (contract.current_version ?? 1) && (
                              <Badge className="bg-violet-100 text-violet-700 text-[10px] px-1.5 py-0">current</Badge>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                            {v.change_notes || "—"}
                          </p>
                          {v.uploaded_at && (
                            <p className="mt-0.5 text-xs text-slate-400">
                              {new Date(v.uploaded_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {v.file_url && (
                          <a
                            href={`${API_BASE_URL}/api/contracts/file/${v.file_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-300"
                            title="Download this version"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── tiny helper ─────────────────────────────────────────────────────────────
function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-white/5 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  );
}