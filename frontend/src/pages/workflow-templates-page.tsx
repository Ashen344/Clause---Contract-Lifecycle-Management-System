import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Layers,
  Loader2,
  Plus,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatLabel as fmt } from "@/lib/utils";
import type { WorkflowTemplate, WorkflowTemplateStep } from "@/types/api";

// ── helpers ───────────────────────────────────────────────────────────────────

const STEP_TYPES = [
  { value: "review",        label: "Review",         color: "bg-blue-100 text-blue-700" },
  { value: "approval",      label: "Approval",       color: "bg-violet-100 text-violet-700" },
  { value: "signing",       label: "Signing",        color: "bg-emerald-100 text-emerald-700" },
  { value: "notification",  label: "Notification",   color: "bg-amber-100 text-amber-700" },
  { value: "ai_analysis",   label: "AI Analysis",    color: "bg-rose-100 text-rose-700" },
] as const;

type StepTypeValue = (typeof STEP_TYPES)[number]["value"];

function stepTypeColor(type: string) {
  return STEP_TYPES.find((t) => t.value === type)?.color ?? "bg-slate-100 text-slate-600";
}
function stepTypeLabel(type: string) {
  return STEP_TYPES.find((t) => t.value === type)?.label ?? type;
}
// ── Empty step factory ────────────────────────────────────────────────────────

const emptyStep = (n: number): WorkflowTemplateStep => ({
  step_number: n,
  name: "",
  step_type: "review",
  description: "",
});

// ── Template form ─────────────────────────────────────────────────────────────

type FormState = { name: string; description: string; steps: WorkflowTemplateStep[] };

function TemplateForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: FormState;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(
    initial ?? { name: "", description: "", steps: [emptyStep(1)] }
  );

  const setField = (key: keyof FormState, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const addStep = () =>
    setForm((f) => ({ ...f, steps: [...f.steps, emptyStep(f.steps.length + 1)] }));

  const removeStep = (i: number) =>
    setForm((f) => ({
      ...f,
      steps: f.steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, step_number: idx + 1 })),
    }));

  const moveStep = (i: number, dir: -1 | 1) => {
    setForm((f) => {
      const arr = [...f.steps];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return f;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...f, steps: arr.map((s, idx) => ({ ...s, step_number: idx + 1 })) };
    });
  };

  const setStep = (i: number, key: keyof WorkflowTemplateStep, val: string) =>
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)),
    }));

  const valid = form.name.trim() && form.steps.length > 0 && form.steps.every((s) => s.name.trim());

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-sm">
      <h3 className="mb-5 text-[15px] font-semibold text-slate-900 dark:text-white">
        {initial ? "Edit template" : "New workflow template"}
      </h3>

      {/* Name & description */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Template name <span className="text-rose-500">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g. Fast-track NDA"
            className="h-10 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 text-sm outline-none focus:border-indigo-300"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Description</label>
          <input
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            placeholder="Optional short description"
            className="h-10 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 text-sm outline-none focus:border-indigo-300"
          />
        </div>
      </div>

      {/* Steps */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Steps ({form.steps.length})
          </p>
          <button onClick={addStep}
            className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-[12.5px] font-medium text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25">
            <Plus className="h-3.5 w-3.5" /> Add step
          </button>
        </div>

        <div className="space-y-2">
          {form.steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
              {/* Grip / order */}
              <div className="flex shrink-0 flex-col items-center gap-0.5 pt-1">
                <GripVertical className="h-4 w-4 text-slate-300" />
                <span className="text-[10px] font-semibold text-slate-400">{i + 1}</span>
              </div>

              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                {/* Step name */}
                <input
                  value={step.name}
                  onChange={(e) => setStep(i, "name", e.target.value)}
                  placeholder="Step name *"
                  className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
                {/* Type dropdown */}
                <select
                  value={step.step_type}
                  onChange={(e) => setStep(i, "step_type", e.target.value as StepTypeValue)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px] outline-none focus:border-indigo-300 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {/* Description */}
                <input
                  value={step.description ?? ""}
                  onChange={(e) => setStep(i, "description", e.target.value)}
                  placeholder="Description (optional)"
                  className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-indigo-300 dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              {/* Move up/down + remove */}
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => moveStep(i, -1)} disabled={i === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 disabled:opacity-30">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => moveStep(i, 1)} disabled={i === form.steps.length - 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 disabled:opacity-30">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => removeStep(i)} disabled={form.steps.length <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50 disabled:opacity-30">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-white/10">
        <Button onClick={() => onSave(form)} disabled={!valid || saving} className="h-9 rounded-lg text-[13px]">
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="mr-1.5 h-3.5 w-3.5" />}
          {initial ? "Save changes" : "Create template"}
        </Button>
        <Button variant="outline" onClick={onCancel} className="h-9 rounded-lg text-[13px]">Cancel</Button>
      </div>
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isAdminOrManager,
  onEdit,
  onDelete,
}: {
  template: WorkflowTemplate;
  isAdminOrManager: boolean;
  onEdit: (t: WorkflowTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm">
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
            <Layers className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-white">{template.name}</h3>
            {template.description && (
              <p className="mt-0.5 text-[13px] text-slate-500">{template.description}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {template.steps.slice(0, 4).map((s) => (
                <Badge key={s.step_number} className={`text-[11px] ${stepTypeColor(s.step_type)}`}>
                  {s.name}
                </Badge>
              ))}
              {template.steps.length > 4 && (
                <Badge className="bg-slate-100 text-[11px] text-slate-500">
                  +{template.steps.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[12px] text-slate-400">{template.steps.length} steps</span>
          <button onClick={() => setExpanded((e) => !e)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {isAdminOrManager && (
            <>
              <Button variant="outline" size="sm" onClick={() => onEdit(template)}
                className="h-7 rounded-lg px-2.5 text-[12px]">
                Edit
              </Button>
              <button onClick={() => onDelete(template.id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4 dark:border-white/10">
          <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">All steps</p>
          <ol className="space-y-2">
            {template.steps.map((step) => (
              <li key={step.step_number} className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-400">
                  {step.step_number}
                </span>
                <span className="flex-1 text-[13px] font-medium text-slate-700 dark:text-slate-300">{step.name}</span>
                <Badge className={`text-[11px] ${stepTypeColor(step.step_type)}`}>
                  {stepTypeLabel(step.step_type)}
                </Badge>
                {step.description && (
                  <span className="text-[12px] text-slate-400">{step.description}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Default template preview ──────────────────────────────────────────────────

const DEFAULT_STEPS = [
  { step_number: 1, name: "Request & Initiation",  step_type: "review" },
  { step_number: 2, name: "Authoring & Drafting",  step_type: "review" },
  { step_number: 3, name: "AI Risk Analysis",      step_type: "ai_analysis" },
  { step_number: 4, name: "Review & Negotiation",  step_type: "review" },
  { step_number: 5, name: "Approval",              step_type: "approval" },
  { step_number: 6, name: "Execution & Signing",   step_type: "signing" },
  { step_number: 7, name: "Storage & Repository",  step_type: "notification" },
  { step_number: 8, name: "Monitoring & Obligations", step_type: "review" },
  { step_number: 9, name: "Renewal / Expiration",  step_type: "review" },
] as WorkflowTemplateStep[];

// ── Page ──────────────────────────────────────────────────────────────────────

export function WorkflowTemplatesContent() {
  const [templates, setTemplates]   = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<WorkflowTemplate | null>(null);
  const [saving, setSaving]         = useState(false);

  // Assume admin/manager — the route is under /admin
  const isAdminOrManager = true;

  const load = () => {
    setLoading(true);
    api.listWorkflowTemplates()
      .then((r) => setTemplates(Array.isArray(r) ? r : (r as { templates?: WorkflowTemplate[] }).templates ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form: { name: string; description: string; steps: WorkflowTemplateStep[] }) => {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.updateWorkflowTemplate(editing.id, form);
      } else {
        await api.createWorkflowTemplate(form);
      }
      setShowForm(false);
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this template? This cannot be undone.")) return;
    try {
      await api.deleteWorkflowTemplate(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
    }
  };

  const handleEdit = (t: WorkflowTemplate) => {
    setEditing(t);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelForm = () => { setShowForm(false); setEditing(null); };

  return (
    <>
      <div className="mb-4 flex justify-end">
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="h-9 rounded-lg text-[13px]">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New template
          </Button>
        )}
      </div>
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Create / edit form */}
      {showForm && (
        <div className="mb-6">
          <TemplateForm
            initial={editing ? { name: editing.name, description: editing.description ?? "", steps: editing.steps } : undefined}
            onSave={handleSave}
            onCancel={cancelForm}
            saving={saving}
          />
        </div>
      )}

      {/* Default system template (read-only) */}
      <div className="mb-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          System default
        </p>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-white/10">
              <Workflow className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-slate-800 dark:text-white">Standard Contract Workflow</h3>
                <Badge className="bg-slate-200 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-400">built-in</Badge>
              </div>
              <p className="mt-0.5 text-[13px] text-slate-500">
                Full 9-step lifecycle — used when no custom template is selected.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DEFAULT_STEPS.map((s) => (
                  <span key={s.step_number}
                    className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${stepTypeColor(s.step_type)}`}>
                    {s.step_number}. {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom templates */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Custom templates ({templates.length})
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white py-14 text-center dark:border-white/10 dark:bg-white/5">
            <Layers className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">No custom templates yet</p>
            <p className="text-xs text-slate-400">
              Create a template to speed up workflow creation for specific contract types.
            </p>
            <Button onClick={() => setShowForm(true)} variant="outline" size="sm" className="mt-2 rounded-lg">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Create first template
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                isAdminOrManager={isAdminOrManager}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function WorkflowTemplatesPage() {
  return (
    <AppShell title="Workflow Templates" subtitle="Define reusable step sequences that can be applied when starting a workflow on any contract.">
      <WorkflowTemplatesContent />
    </AppShell>
  );
}
