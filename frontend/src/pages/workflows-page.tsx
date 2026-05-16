import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  FileSearch,
  GripVertical,
  Loader2,
  PenLine,
  Plus,
  Trash2,
  Workflow as WorkflowIcon,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatLabel, statusBadgeClass as badgeClass } from "@/lib/utils";
import type { Contract, Workflow, WorkflowStep, WorkflowTemplate } from "@/types/api";

type WorkflowItem = {
  workflow: Workflow;
  contract?: Contract | null;
};

// ─── Step type icon ───────────────────────────────────────────────────────────

function StepIcon({ type }: { type: string }) {
  const cls = "h-3 w-3";
  switch (type) {
    case "review":       return <FileSearch className={cls} />;
    case "approval":     return <CheckCircle2 className={cls} />;
    case "signing":      return <PenLine className={cls} />;
    case "notification": return <Bell className={cls} />;
    case "ai_analysis":  return <Bot className={cls} />;
    default:             return <CircleDot className={cls} />;
  }
}

function stepDotClass(status: WorkflowStep["status"]) {
  switch (status) {
    case "completed":   return "bg-green-500";
    case "in_progress": return "bg-blue-500 ring-2 ring-blue-200 ring-offset-1 animate-pulse";
    case "rejected":    return "bg-red-500";
    case "skipped":     return "bg-amber-400";
    default:            return "bg-slate-200 dark:bg-slate-600";
  }
}

// ─── Mini step track ─────────────────────────────────────────────────────────

function MiniStepTrack({ steps, currentStep }: { steps: WorkflowStep[]; currentStep: number }) {
  if (!steps.length) return null;
  const show = steps.slice(0, 8);
  return (
    <div className="flex items-center gap-1.5">
      {show.map((s, i) => (
        <div key={s.step_number} className="flex items-center gap-1.5">
          <div
            title={`${s.step_number}. ${s.name} (${formatLabel(s.status)})`}
            className={`flex h-6 w-6 items-center justify-center rounded-full text-white transition ${stepDotClass(s.status)}`}
          >
            <StepIcon type={s.step_type} />
          </div>
          {i < show.length - 1 && (
            <div className={`h-px w-4 ${s.step_number < currentStep ? "bg-green-400" : "bg-slate-200 dark:bg-slate-700"}`} />
          )}
        </div>
      ))}
      {steps.length > 8 && (
        <span className="text-xs text-slate-400">+{steps.length - 8}</span>
      )}
    </div>
  );
}

// ─── Status filter tabs ───────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: "all",       label: "All" },
  { value: "active",    label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "paused",    label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]["value"];

// ─── Create workflow form ─────────────────────────────────────────────────────

const STEP_TYPES = [
  { value: "review",       label: "Review" },
  { value: "approval",     label: "Approval" },
  { value: "signing",      label: "Signing" },
  { value: "notification", label: "Notification" },
  { value: "ai_analysis",  label: "AI Analysis" },
] as const;

type StepDraft = { name: string; step_type: string };

const DEFAULT_STEPS: StepDraft[] = [
  { name: "Initial Review",   step_type: "review" },
  { name: "Manager Approval", step_type: "approval" },
  { name: "Signing",          step_type: "signing" },
];

function CreateWorkflowForm({
  contracts,
  onCreated,
  onCancel,
}: {
  contracts: Contract[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [contractId, setContractId] = useState("");
  const [name, setName]             = useState("");
  const [steps, setSteps]           = useState<StepDraft[]>([...DEFAULT_STEPS]);
  const [templates, setTemplates]   = useState<WorkflowTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    api.listWorkflowTemplates()
      .then((d) => setTemplates(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const loadTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl?.steps)
      setSteps(
        [...tpl.steps]
          .sort((a, b) => a.step_number - b.step_number)
          .map((s) => ({ name: s.name, step_type: s.step_type }))
      );
  };

  const addStep    = () => setSteps((p) => [...p, { name: "", step_type: "review" }]);
  const removeStep = (i: number) => setSteps((p) => p.filter((_, idx) => idx !== i));
  const updateStep = (i: number, f: keyof StepDraft, v: string) =>
    setSteps((p) => p.map((s, idx) => (idx === i ? { ...s, [f]: v } : s)));
  const moveStep   = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    setSteps((p) => { const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  };

  const handleSubmit = async () => {
    if (!contractId) { setError("Please select a contract."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await api.createWorkflow({
        contract_id: contractId,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(steps.length > 0
          ? { steps: steps.filter((s) => s.name.trim()).map((s, i) => ({ step_number: i + 1, name: s.name, step_type: s.step_type, status: "pending" })) }
          : {}),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workflow.");
    } finally {
      setSubmitting(false);
    }
  };

  const field = "flex flex-col gap-1.5";
  const label = "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
  const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";
  const selectCls = `${input} appearance-none pr-8`;

  return (
    <Card className="mb-6 overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-md dark:border-violet-500/30 dark:bg-slate-900">
      <CardHeader className="flex flex-row items-center justify-between border-b border-violet-100 bg-violet-50/60 pb-4 dark:border-violet-500/20 dark:bg-violet-500/10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
            <Plus className="h-4 w-4" />
          </div>
          <CardTitle className="text-lg text-slate-900 dark:text-white">New Workflow</CardTitle>
        </div>
        <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className={field}>
            <label className={label}>Contract <span className="text-red-500">*</span></label>
            <div className="relative">
              <select value={contractId} onChange={(e) => setContractId(e.target.value)} className={selectCls}>
                <option value="">Select a contract…</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className={field}>
            <label className={label}>Workflow name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard Contract Workflow" className={input} />
          </div>
        </div>

        {templates.length > 0 && (
          <div className={field}>
            <label className={label}>Load steps from template</label>
            <div className="relative max-w-sm">
              <select value={templateId} onChange={(e) => loadTemplate(e.target.value)} className={selectCls}>
                <option value="">— choose a template —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={label}>Steps</label>
            <button type="button" onClick={addStep} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-violet-600 transition hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-500/10">
              <Plus className="h-3.5 w-3.5" /> Add step
            </button>
          </div>

          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0} className="rounded p-0.5 text-slate-300 transition hover:text-slate-500 disabled:opacity-30">
                    <GripVertical className="h-3.5 w-3.5 rotate-90" />
                  </button>
                  <button type="button" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} className="rounded p-0.5 text-slate-300 transition hover:text-slate-500 disabled:opacity-30">
                    <GripVertical className="h-3.5 w-3.5 -rotate-90" />
                  </button>
                </div>

                <span className="w-6 shrink-0 text-center text-xs font-bold text-slate-400">{i + 1}</span>

                <input
                  type="text"
                  value={step.name}
                  onChange={(e) => updateStep(i, "name", e.target.value)}
                  placeholder="Step name"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-700 dark:text-white"
                />

                <div className="relative shrink-0">
                  <select value={step.step_type} onChange={(e) => updateStep(i, "step_type", e.target.value)} className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-2.5 pr-7 text-sm text-slate-700 focus:border-violet-400 focus:outline-none dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {STEP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                </div>

                <button type="button" onClick={() => removeStep(i)} disabled={steps.length === 1} className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-500/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {steps.length === 0 && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              No steps — backend will use its default workflow steps.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="ghost" onClick={onCancel} className="rounded-xl text-slate-600 dark:text-slate-400">Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:opacity-90 disabled:opacity-60">
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</> : <><Plus className="mr-2 h-4 w-4" /> Create workflow</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

export function WorkflowsContent({ adminView = false }: { adminView?: boolean }) {
  const location = useLocation();
  const isAdminView = adminView || location.pathname.startsWith("/admin");

  const [items, setItems]         = useState<WorkflowItem[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter]       = useState<StatusFilter>("all");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const wfData = await api.getAllWorkflows();
      const allWorkflows: Workflow[] = Array.isArray(wfData?.workflows) ? wfData.workflows : [];

      let allContracts: Contract[] = [];
      try {
        const cd = await api.listContracts("?per_page=200");
        allContracts = Array.isArray(cd?.contracts) ? cd.contracts : [];
      } catch { /* no contracts */ }

      setContracts(allContracts);
      const contractMap = new Map(allContracts.map((c) => [c.id, c]));

      setItems(
        allWorkflows
          .map((wf) => ({ workflow: wf, contract: contractMap.get(wf.contract_id) ?? null }))
          .sort((a, b) => new Date(b.workflow.updated_at ?? 0).getTime() - new Date(a.workflow.updated_at ?? 0).getTime())
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workflows.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    items.forEach(({ workflow: wf }) => { c[wf.status] = (c[wf.status] ?? 0) + 1; });
    return c;
  }, [items]);

  const visible = useMemo(
    () => filter === "all" ? items : items.filter(({ workflow: wf }) => wf.status === filter),
    [items, filter]
  );

  const detailBasePath = isAdminView ? "/admin/workflows" : "/workflows";

  return (
    <>
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                filter === tab.value
                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              }`}
            >
              {tab.label}
              {counts[tab.value] !== undefined && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${filter === tab.value ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}`}>
                  {counts[tab.value] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {!showCreate && (
          <Button onClick={() => setShowCreate(true)} className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm hover:opacity-90">
            <Plus className="mr-2 h-4 w-4" /> New workflow
          </Button>
        )}
      </div>

      {showCreate && (
        <CreateWorkflowForm
          contracts={contracts}
          onCreated={() => { setShowCreate(false); loadData(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading workflows…
        </div>
      )}

      {!loading && visible.length === 0 && !error && !showCreate && (
        <div className="rounded-3xl border border-dashed border-violet-100 bg-violet-50/60 px-6 py-12 text-center dark:border-violet-500/20 dark:bg-violet-500/10">
          <WorkflowIcon className="mx-auto h-10 w-10 text-violet-400" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            {filter === "all" ? "No workflows yet." : `No ${filter} workflows.`}
          </p>
          {filter === "all" && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Click "New workflow" above to create one.</p>
          )}
        </div>
      )}

      <div className="grid gap-4">
        {visible.map(({ workflow, contract }) => {
          const steps = Array.isArray(workflow.steps) ? workflow.steps : [];
          const total = steps.length;
          const current = workflow.current_step ?? 0;
          const isDone = workflow.status === "completed" || current > total;
          const progress = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

          return (
            <Card key={workflow.id} className="overflow-hidden rounded-3xl border border-violet-100 bg-violet-50/60 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-violet-500/20 dark:bg-violet-500/10">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                      <WorkflowIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-slate-900 dark:text-white">{workflow.name || "Workflow"}</CardTitle>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        {contract?.title || `Contract: ${workflow.contract_id}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={badgeClass(workflow.status)}>{formatLabel(workflow.status)}</Badge>
                    <Badge className={isDone
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                      : "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"}>
                      {isDone ? `All ${total} steps done` : `Step ${current}/${total}`}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Mini step track */}
                {steps.length > 0 && (
                  <div className="rounded-2xl border border-violet-100 bg-white/70 px-4 py-3 dark:border-violet-500/20 dark:bg-white/5">
                    <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Steps</p>
                    <MiniStepTrack steps={steps} currentStep={current} />
                  </div>
                )}

                {/* Stats row */}
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-violet-100 bg-white/70 p-3 dark:border-violet-500/20 dark:bg-white/5">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Contract type</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {contract ? formatLabel(contract.contract_type) : "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-white/70 p-3 dark:border-violet-500/20 dark:bg-white/5">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Progress</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{progress}%</p>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-white/70 p-3 dark:border-violet-500/20 dark:bg-white/5">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Updated</p>
                    <p className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {workflow.updated_at ? new Date(workflow.updated_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button asChild className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm hover:opacity-90">
                    <Link to={`${detailBasePath}/${workflow.id}`}>
                      Open <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export default function WorkflowsPage() {
  return (
    <AppShell title="Workflows" subtitle="Create and track contract workflows.">
      <WorkflowsContent />
    </AppShell>
  );
}
