import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FileText, CheckCircle2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { AppBadge } from "@/components/ui/app-badge";
import { api } from "@/lib/api";
import { formatLabel } from "@/lib/utils";
import type { ContractParty, Template } from "@/types/api";

type FormState = {
  title: string;
  contract_type: string;
  description: string;
  start_date: string;
  end_date: string;
  value: string;
  payment_terms: string;
  approval_type: string;
  workflow_trigger: string;
  tags: string;
};

const initialState: FormState = {
  title: "",
  contract_type: "nda",
  description: "",
  start_date: "",
  end_date: "",
  value: "",
  payment_terms: "",
  approval_type: "all_required",
  workflow_trigger: "creation",
  tags: "",
};

function blankParty(): ContractParty {
  return {
    name: "",
    role: "",
    email: "",
    organization: "",
  };
}

const inputLabel = "flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300";
const selectClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
const textareaClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white min-h-[80px] resize-y";

function toFieldLabel(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CreateContractPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId");

  const [form, setForm] = useState<FormState>(initialState);
  const [parties, setParties] = useState<ContractParty[]>([
    blankParty(),
    blankParty(),
  ]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) return;

    const loadTemplate = async () => {
      setLoadingTemplate(true);
      setError(null);

      try {
        const data = await api.getTemplate(templateId);
        setTemplate(data);

        const defaults: Record<string, string> = {};
        for (const field of data.fields || []) {
          defaults[field.field_name] = field.default_value ?? "";
        }
        setTemplateValues(defaults);

        setForm((prev) => ({
          ...prev,
          contract_type: data.contract_type || prev.contract_type,
          title: prev.title || data.name || "",
          description: prev.description || data.description || "",
        }));
      } catch {
        setError("Failed to load template.");
      } finally {
        setLoadingTemplate(false);
      }
    };

    loadTemplate();
  }, [templateId]);

  const contractGroups = useMemo(() => {
    return [{ name: formatLabel(form.contract_type), count: 1 }];
  }, [form.contract_type]);

  const updateParty = (
    index: number,
    key: keyof ContractParty,
    value: string
  ) => {
    setParties((prev) =>
      prev.map((party, i) =>
        i === index ? { ...party, [key]: value } : party
      )
    );
  };

  const addParty = () => {
    setParties((prev) => [...prev, blankParty()]);
  };

  const removeParty = (index: number) => {
    setParties((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
    );
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const filteredParties = parties.filter(
        (party) => party.name.trim() && party.role.trim()
      );

      const payload = {
        title: form.title,
        contract_type: form.contract_type,
        description: form.description || null,
        parties: filteredParties,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
        value: form.value ? Number(form.value) : null,
        payment_terms: form.payment_terms || null,
        approval_type: form.approval_type,
        workflow_trigger: form.workflow_trigger,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
        template_id: template?.id || null,
        template_values: Object.keys(templateValues).length
          ? Object.fromEntries(
              Object.entries(templateValues).filter(([, v]) => v.trim())
            )
          : null,
      };

      const createdContract = await api.createContract(payload);

      await api.createWorkflow({
        contract_id: createdContract.id,
        name: `${createdContract.title} workflow`,
      });

      setMessage("Contract created successfully. Opening document...");
      setTimeout(() => {
        navigate(`/contracts/${createdContract.id}`);
      }, 600);
    } catch {
      setError("Failed to create contract.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="Create Contract"
      subtitle="Create a contract and automatically start its workflow."
      contractGroups={contractGroups}
    >
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300">
          {message}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_1fr]">
        {/* ── Left column: contract info + template fields ── */}
        <div className="space-y-5">
          <AppCard tone="soft">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Basic Information</h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Title, type and description of the contract.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={inputLabel}>
                <span>Title</span>
                <AppInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Enter contract title" className="h-11" />
              </label>
              <label className={inputLabel}>
                <span>Type</span>
                <select className={selectClass} value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
                  <option value="service_agreement">Service Agreement</option>
                  <option value="nda">NDA</option>
                  <option value="employment">Employment</option>
                  <option value="vendor">Vendor</option>
                  <option value="licensing">Licensing</option>
                  <option value="partnership">Partnership</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className={`${inputLabel} sm:col-span-2`}>
                <span>Description</span>
                <textarea className={textareaClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Briefly describe the purpose of this contract" />
              </label>
            </div>
          </AppCard>

          <AppCard tone="soft">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Dates & Financials</h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Contract duration and financial terms.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={inputLabel}>
                <span>Start Date</span>
                <AppInput type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="h-11" />
              </label>
              <label className={inputLabel}>
                <span>End Date</span>
                <AppInput type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="h-11" />
              </label>
              <label className={inputLabel}>
                <span>Contract Value</span>
                <AppInput type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0" className="h-11" />
              </label>
              <label className={inputLabel}>
                <span>Payment Terms</span>
                <AppInput value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} placeholder="Net 30, milestone…" className="h-11" />
              </label>
            </div>
          </AppCard>

          {template && template.fields && template.fields.length > 0 && (
            <AppCard tone="soft">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Template Fields</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Required fields for <span className="font-medium text-violet-600 dark:text-violet-300">{template.name}</span>.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {template.fields.map((field) => {
                  const isTextArea = field.field_type === "text" && (field.field_name.includes("description") || field.field_name.includes("purpose"));
                  return (
                    <label key={field.field_name} className={isTextArea ? `${inputLabel} sm:col-span-2` : inputLabel}>
                      <span>{toFieldLabel(field.field_name)}{field.required && <span className="ml-1 text-red-500">*</span>}</span>
                      {isTextArea ? (
                        <textarea className={textareaClass} value={templateValues[field.field_name] ?? ""} onChange={(e) => setTemplateValues((prev) => ({ ...prev, [field.field_name]: e.target.value }))} placeholder={field.default_value ? `Default: ${field.default_value}` : `Enter ${toFieldLabel(field.field_name).toLowerCase()}`} />
                      ) : (
                        <AppInput type={field.field_type === "date" ? "date" : field.field_type === "number" ? "number" : "text"} value={templateValues[field.field_name] ?? ""} onChange={(e) => setTemplateValues((prev) => ({ ...prev, [field.field_name]: e.target.value }))} placeholder={field.default_value ? `Default: ${field.default_value}` : `Enter ${toFieldLabel(field.field_name).toLowerCase()}`} className="h-11" />
                      )}
                    </label>
                  );
                })}
              </div>
            </AppCard>
          )}
        </div>

        {/* ── Right column: parties + settings + submit ── */}
        <div className="space-y-5">

          <AppCard tone="soft">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Parties
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Add the parties involved in this contract.
                </p>
              </div>

              <AppBadge variant="violet">{parties.length}</AppBadge>
            </div>

            <div className="space-y-4">
              {parties.map((party, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-violet-100 bg-white/70 p-4 dark:border-violet-500/20 dark:bg-white/5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                      Party {index + 1}
                    </p>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeParty(index)}
                      disabled={parties.length === 1}
                      className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <AppInput
                      placeholder="Name"
                      value={party.name}
                      onChange={(e) =>
                        updateParty(index, "name", e.target.value)
                      }
                      className="h-11"
                    />
                    <AppInput
                      placeholder="Role"
                      value={party.role}
                      onChange={(e) =>
                        updateParty(index, "role", e.target.value)
                      }
                      className="h-11"
                    />
                    <AppInput
                      placeholder="Email"
                      value={party.email || ""}
                      onChange={(e) =>
                        updateParty(index, "email", e.target.value)
                      }
                      className="h-11"
                    />
                    <AppInput
                      placeholder="Organization"
                      value={party.organization || ""}
                      onChange={(e) =>
                        updateParty(index, "organization", e.target.value)
                      }
                      className="h-11"
                    />
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addParty}
                className="w-full rounded-xl border-slate-200 bg-white dark:border-white/10 dark:bg-white/5"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Party
              </Button>
            </div>
          </AppCard>

          <AppCard tone="soft">
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Workflow Settings</h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Configure approval and automation behaviour.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={inputLabel}>
                <span>Approval Type</span>
                <select className={selectClass} value={form.approval_type} onChange={(e) => setForm({ ...form, approval_type: e.target.value })}>
                  <option value="all_required">All Required</option>
                  <option value="majority">Majority</option>
                  <option value="first_person">First Person</option>
                </select>
              </label>
              <label className={inputLabel}>
                <span>Workflow Trigger</span>
                <select className={selectClass} value={form.workflow_trigger} onChange={(e) => setForm({ ...form, workflow_trigger: e.target.value })}>
                  <option value="creation">On Creation</option>
                  <option value="modification">On Modification</option>
                  <option value="renewal">On Renewal</option>
                </select>
              </label>
              <label className={`${inputLabel} sm:col-span-2`}>
                <span>Tags</span>
                <AppInput value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="security, vendor, renewal" className="h-11" />
              </label>
            </div>
          </AppCard>

          <Button
            className="h-11 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm hover:opacity-90"
            onClick={submit}
            disabled={saving || !form.title || !form.start_date || !form.end_date}
          >
            {saving ? (
              "Saving..."
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Create Contract and Workflow
              </>
            )}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}