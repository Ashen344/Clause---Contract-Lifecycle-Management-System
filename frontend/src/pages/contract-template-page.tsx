import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FilePlus2, RefreshCw, LayoutTemplate } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { AppCard } from "@/components/ui/app-card";
import { AppBadge } from "@/components/ui/app-badge";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { api } from "@/lib/api";
import { formatLabel } from "@/lib/utils";
import type { Template } from "@/types/api";

export default function ContractTemplatePage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.listTemplates("?per_page=50");
      setTemplates(data.templates);
    } catch {
      setError("Failed to load templates.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const contractGroups = useMemo(() => {
    const counts = new Map<string, number>();

    templates.forEach((template) => {
      counts.set(
        template.contract_type,
        (counts.get(template.contract_type) || 0) + 1
      );
    });

    return Array.from(counts.entries()).map(([name, count]) => ({
      name: formatLabel(name),
      count,
    }));
  }, [templates]);

  return (
    <AppShell
      title="Templates"
      subtitle="Choose a contract template or start from scratch."
      contractGroups={contractGroups}
      actions={
        <>
          <Button
            variant="outline"
            onClick={loadTemplates}
            className="rounded-xl border-slate-200 dark:border-white/10"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button
            onClick={() => navigate("/contracts/create")}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm hover:opacity-90"
          >
            <FilePlus2 className="mr-2 h-4 w-4" />
            Blank contract
          </Button>
        </>
      }
    >
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && (
        <p className="animate-pulse text-sm text-slate-500 dark:text-slate-400">
          Loading templates...
        </p>
      )}

      {!loading && templates.length === 0 && (
        <AppEmptyState title="No templates found. Add templates in backend." />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <AppCard
            key={template.id}
            tone="soft"
            className="group overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                  <LayoutTemplate className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                    {template.name}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                    {template.description || "No description provided"}
                  </p>
                </div>
              </div>

              <AppBadge variant="slate">v{template.version}</AppBadge>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-violet-100 bg-white/70 p-3 dark:border-violet-500/20 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Type
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {formatLabel(template.contract_type)}
                  </p>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-white/70 p-3 dark:border-violet-500/20 dark:bg-white/5">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Fields
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {template.fields?.length || 0}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Tags
                </p>

                {(template.tags || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {(template.tags || []).map((tag) => (
                      <AppBadge key={tag} variant="blue">
                        {tag}
                      </AppBadge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No tags added.
                  </p>
                )}
              </div>

              <Button
                className="h-11 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm transition-all hover:opacity-90 group-hover:shadow-md"
                onClick={() =>
                  navigate(`/contracts/create?templateId=${template.id}`)
                }
              >
                Use template
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </AppCard>
        ))}
      </div>
    </AppShell>
  );
}