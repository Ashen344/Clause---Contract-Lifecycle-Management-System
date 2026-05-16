import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  FileSearch,
  Loader2,
  PauseCircle,
  PenLine,
  PlayCircle,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  User,
  XCircle,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useResolveUser } from "@/hooks/use-resolve-user";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatLabel, statusBadgeClass as badgeClass } from "@/lib/utils";
import type { ApprovalListResponse, Contract, Workflow, WorkflowStep } from "@/types/api";

type ApprovalItem = ApprovalListResponse["approvals"] extends Array<infer T> ? T : never;

// ─── Step type icons ──────────────────────────────────────────────────────────

function StepTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = className ?? "h-4 w-4";
  switch (type) {
    case "review":       return <FileSearch className={cls} />;
    case "approval":     return <CheckCircle2 className={cls} />;
    case "signing":      return <PenLine className={cls} />;
    case "notification": return <Bell className={cls} />;
    case "ai_analysis":  return <Bot className={cls} />;
    default:             return <CircleDot className={cls} />;
  }
}

// ─── Step status helpers ──────────────────────────────────────────────────────

type StepStatus = WorkflowStep["status"];

const STATUS_CONFIG: Record<StepStatus, { label: string; dot: string; ring: string; bg: string; text: string; icon: React.ReactNode }> = {
  pending:     { label: "Pending",     dot: "bg-slate-300",  ring: "ring-slate-200",  bg: "bg-slate-50  dark:bg-slate-800/40",  text: "text-slate-500 dark:text-slate-400",  icon: <Clock className="h-4 w-4" /> },
  in_progress: { label: "In Progress", dot: "bg-blue-500",   ring: "ring-blue-200",   bg: "bg-blue-50   dark:bg-blue-500/10",   text: "text-blue-700  dark:text-blue-300",   icon: <CircleDot className="h-4 w-4" /> },
  completed:   { label: "Completed",   dot: "bg-green-500",  ring: "ring-green-200",  bg: "bg-green-50  dark:bg-green-500/10",  text: "text-green-700 dark:text-green-300",  icon: <CheckCircle2 className="h-4 w-4" /> },
  rejected:    { label: "Rejected",    dot: "bg-red-500",    ring: "ring-red-200",    bg: "bg-red-50    dark:bg-red-500/10",    text: "text-red-700   dark:text-red-300",    icon: <XCircle className="h-4 w-4" /> },
  skipped:     { label: "Skipped",     dot: "bg-amber-400",  ring: "ring-amber-200",  bg: "bg-amber-50  dark:bg-amber-500/10",  text: "text-amber-700 dark:text-amber-300",  icon: <SkipForward className="h-4 w-4" /> },
};

function stepCfg(status: string) {
  return STATUS_CONFIG[status as StepStatus] ?? STATUS_CONFIG.pending;
}

// ─── Single step row ──────────────────────────────────────────────────────────

function StepRow({ step, isCurrent, isLast }: { step: WorkflowStep; isCurrent: boolean; isLast: boolean }) {
  const cfg = stepCfg(step.status);
  return (
    <div className="flex gap-4">
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <div className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-2 ${cfg.ring} ${cfg.bg} ${cfg.text} ${isCurrent ? "ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : ""}`}>
          {isCurrent
            ? <span className={`absolute h-2.5 w-2.5 rounded-full ${cfg.dot} animate-pulse`} />
            : cfg.icon}
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-slate-200 dark:bg-slate-700" />}
      </div>

      {/* Content */}
      <div className={`mb-4 flex-1 overflow-hidden rounded-2xl border p-4 ${isCurrent ? "border-blue-200 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-500/10" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/30"}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${cfg.bg} ${cfg.text}`}>
              {step.step_number}
            </span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{step.name}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <StepTypeIcon type={step.step_type} className="h-3 w-3" />
                {formatLabel(step.step_type)}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
            {cfg.icon}
            {cfg.label}
          </span>
        </div>

        <div className="mt-3 grid gap-2 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
          {step.assigned_to && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> {step.assigned_to}
            </span>
          )}
          {step.due_date && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Due {new Date(step.due_date).toLocaleDateString()}
            </span>
          )}
          {step.completed_at && (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              {new Date(step.completed_at).toLocaleDateString()}
            </span>
          )}
          {step.completed_by && (
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-green-500" /> {step.completed_by}
            </span>
          )}
        </div>

        {step.comments && (
          <p className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm italic text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            "{step.comments}"
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowDetailPage() {
  const { id } = useParams();
  const { isAdminOrManager: canManage } = useRole();
  const resolveUser = useResolveUser();

  const [workflow, setWorkflow]   = useState<Workflow | null>(null);
  const [contract, setContract]   = useState<Contract | null>(null);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [note, setNote]           = useState("");
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const wf = await api.getWorkflow(id);
      setWorkflow(wf);
      try { setContract(await api.getContract(wf.contract_id)); } catch { setContract(null); }
      try {
        const ap = await api.getApprovalsByContract(wf.contract_id);
        setApprovals(Array.isArray(ap.approvals) ? ap.approvals : []);
      } catch { setApprovals([]); }
    } catch {
      setError("Failed to load workflow details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const steps = useMemo(() => workflow?.steps ?? [], [workflow]);
  const totalSteps = steps.length;
  const currentStep = workflow?.current_step ?? 0;
  const isWorkflowCompleted = workflow?.status === "completed" || currentStep > totalSteps;
  const progress = totalSteps > 0 ? Math.min(100, Math.round((currentStep / totalSteps) * 100)) : 0;

  const act = async (action: "advance" | "reject" | "pause" | "resume") => {
    if (!id) return;
    setActing(true);
    setError(null);
    setActionMsg(null);
    try {
      if (action === "advance") await api.advanceWorkflow(id, note);
      else if (action === "reject") await api.rejectWorkflow(id, note || "Rejected");
      else if (action === "pause") await api.pauseWorkflow(id, note || undefined);
      else await api.resumeWorkflow(id);
      setNote("");
      setActionMsg(
        action === "advance" ? "Step advanced." :
        action === "reject"  ? "Step rejected." :
        action === "pause"   ? "Workflow paused." :
                               "Workflow resumed."
      );
      await load();
    } catch {
      setError(`Failed to ${action} workflow.`);
    } finally {
      setActing(false);
    }
  };

  return (
    <AppShell
      title={workflow?.name ?? "Workflow Details"}
      subtitle={contract?.title ?? "Loading contract…"}
    >
      {/* Back link — admins/managers only */}
      {canManage && (
        <div className="mb-5">
          <Link
            to="/workflows"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" /> All workflows
          </Link>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {!loading && workflow && (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">

          {/* ── Left: steps timeline ── */}
          <div className="space-y-6">

            {/* Header card */}
            <Card className="overflow-hidden rounded-3xl border border-violet-100 bg-violet-50/60 shadow-sm dark:border-violet-500/20 dark:bg-violet-500/10">
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{workflow.name}</h2>
                    {contract && (
                      <Link
                        to={`/contracts/${contract.id}`}
                        className="mt-1 flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {contract.title}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={badgeClass(workflow.status)}>
                      {formatLabel(workflow.status)}
                    </Badge>
                    <Badge className={isWorkflowCompleted
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                      : "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"}>
                      {isWorkflowCompleted ? `All ${totalSteps} steps done` : `Step ${currentStep} / ${totalSteps}`}
                    </Badge>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/80 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Meta row */}
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                  {workflow.created_at && (
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Created {new Date(workflow.created_at).toLocaleDateString()}
                    </span>
                  )}
                  {workflow.updated_at && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Updated {new Date(workflow.updated_at).toLocaleDateString()}
                    </span>
                  )}
                  {workflow.created_by && (
                    <span className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> {resolveUser(workflow.created_by)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Steps timeline */}
            <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white">Steps</CardTitle>
              </CardHeader>
              <CardContent>
                {steps.length === 0 ? (
                  <p className="text-sm text-slate-500">No steps defined.</p>
                ) : (
                  <div>
                    {steps.map((step, idx) => (
                      <StepRow
                        key={step.step_number}
                        step={step}
                        isCurrent={step.step_number === currentStep}
                        isLast={idx === steps.length - 1}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right: actions + approvals ── */}
          <div className="space-y-6">

            {canManage ? (
              <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-slate-900 dark:text-white">Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {actionMsg && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300">
                      {actionMsg}
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Comment (optional)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a note for this step…"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => act("advance")}
                      disabled={acting || workflow.status !== "active"}
                      className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {acting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
                      Advance
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => act("reject")}
                      disabled={acting || workflow.status !== "active"}
                      className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      {acting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
                      Reject
                    </Button>
                  </div>

                  {(workflow.status === "active" || workflow.status === "paused") && (
                    <Button
                      variant="outline"
                      onClick={() => act(workflow.status === "paused" ? "resume" : "pause")}
                      disabled={acting}
                      className={`w-full rounded-xl disabled:opacity-50 ${
                        workflow.status === "paused"
                          ? "border-green-200 text-green-700 hover:bg-green-50 dark:border-green-500/30 dark:text-green-400 dark:hover:bg-green-500/10"
                          : "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-400 dark:hover:bg-amber-500/10"
                      }`}
                    >
                      {acting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : workflow.status === "paused" ? (
                        <PlayCircle className="mr-2 h-4 w-4" />
                      ) : (
                        <PauseCircle className="mr-2 h-4 w-4" />
                      )}
                      {workflow.status === "paused" ? "Resume Workflow" : "Pause Workflow"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-slate-900 dark:text-white">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {isWorkflowCompleted
                      ? <>All <span className="font-semibold text-slate-900 dark:text-white">{totalSteps}</span> steps have been completed. This workflow is finished.</>
                      : <>Currently at step <span className="font-semibold text-slate-900 dark:text-white">{currentStep}</span> of{" "}
                        <span className="font-semibold text-slate-900 dark:text-white">{totalSteps}</span>. An admin or manager will review and advance the workflow.</>}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Related approvals */}
            <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white">Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                {approvals.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No approvals linked yet.</p>
                ) : (
                  <div className="space-y-3">
                    {approvals.map((ap) => (
                      <div key={ap.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {formatLabel(ap.approval_type)}
                          </p>
                          <Badge className={badgeClass(ap.status)}>
                            {formatLabel(ap.status)}
                          </Badge>
                        </div>
                        {ap.due_date && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <CalendarDays className="h-3 w-3" />
                            Due {new Date(ap.due_date).toLocaleDateString()}
                          </p>
                        )}
                        {(ap.approvers?.length ?? 0) > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {ap.approvers.map((a) => (
                              <span key={a.user_id} className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                {resolveUser(a.user_id)}
                                {a.decision && ` · ${formatLabel(a.decision)}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}
