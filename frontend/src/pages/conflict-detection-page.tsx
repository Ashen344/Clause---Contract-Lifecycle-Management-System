import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatLabel as fmt } from "@/lib/utils";
import type { ConflictResult, Contract } from "@/types/api";

function severityColors(v?: string | null) {
  switch ((v || "").toLowerCase()) {
    case "high":
    case "critical":
      return {
        badge: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
        border: "border-red-200 dark:border-red-500/30",
        bg: "bg-red-50 dark:bg-red-500/10",
      };
    case "medium":
      return {
        badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
        border: "border-amber-200 dark:border-amber-500/30",
        bg: "bg-amber-50 dark:bg-amber-500/10",
      };
    default:
      return {
        badge: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400",
        border: "border-green-200 dark:border-green-500/30",
        bg: "bg-green-50 dark:bg-green-500/10",
      };
  }
}

// ─── Contract selector pill ──────────────────────────────────────────────────

function ContractPill({
  contract,
  checked,
  onToggle,
}: {
  contract: Contract;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
        checked
          ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-sm"
          : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/10"
      }`}
    >
      {/* Checkbox circle */}
      <div
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
          checked
            ? "border-blue-500 bg-blue-500"
            : "border-slate-300 group-hover:border-slate-400"
        }`}
      >
        {checked && <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${checked ? "text-blue-900 dark:text-blue-300" : "text-slate-800 dark:text-white"}`}>
          {contract.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">{fmt(contract.contract_type)}</span>
          <span className="text-xs text-slate-300">·</span>
          <span
            className={`text-xs font-medium ${
              contract.status === "active"
                ? "text-green-600"
                : contract.status === "draft"
                ? "text-slate-400"
                : "text-amber-600"
            }`}
          >
            {fmt(contract.status)}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Conflict card ───────────────────────────────────────────────────────────

type ConflictItem = ConflictResult["conflicts"][number];

function ConflictCard({ conflict }: { conflict: ConflictItem }) {
  const [expanded, setExpanded] = useState(false);
  const colors = severityColors(conflict.severity);

  return (
    <div className={`rounded-2xl border ${colors.border} overflow-hidden`}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-start justify-between gap-3 px-5 py-4 text-left ${colors.bg} transition-colors hover:brightness-95`}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${
            conflict.severity === "high" || conflict.severity === "critical"
              ? "text-red-600"
              : conflict.severity === "medium"
              ? "text-amber-600"
              : "text-green-600"
          }`} />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {conflict.contract_a}{" "}
              <span className="font-normal text-slate-500 dark:text-slate-400">vs</span>{" "}
              {conflict.contract_b}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {fmt(conflict.conflict_type)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge className={colors.badge}>{fmt(conflict.severity)}</Badge>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-slate-400" />
            : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="space-y-4 px-5 py-4 bg-white dark:bg-white/5">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {conflict.description}
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Clause — {conflict.contract_a}
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{conflict.clause_a}</p>
            </div>
            <div className={`rounded-xl border p-3 ${colors.border} ${colors.bg}`}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Clause — {conflict.contract_b}
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{conflict.clause_b}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-blue-100 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Recommendation</p>
              <p className="mt-0.5 text-sm text-blue-800 dark:text-blue-200">{conflict.recommendation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ConflictDetectionPage() {
  const [contracts, setContracts]     = useState<Contract[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch]           = useState("");
  const [result, setResult]           = useState<ConflictResult | null>(null);
  const [loading, setLoading]         = useState(true);
  const [analyzing, setAnalyzing]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    api
      .listContracts("?per_page=100")
      .then((d) => setContracts(d.contracts))
      .catch(() => setError("Could not load contracts."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      contracts.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.contract_type.toLowerCase().includes(search.toLowerCase())
      ),
    [contracts, search]
  );

  const contractGroups = useMemo(() => {
    const counts = new Map<string, number>();
    contracts.forEach((c) => counts.set(c.contract_type, (counts.get(c.contract_type) || 0) + 1));
    return Array.from(counts.entries()).map(([name, count]) => ({ name: fmt(name), count }));
  }, [contracts]);

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 10)
    );
  }

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.detectConflicts(selectedIds);
      setResult(data);
    } catch {
      setError("Analysis failed — please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  const hasConflicts = (result?.total_conflicts ?? 0) > 0;
  const colors = severityColors(result?.overall_risk);

  return (
    <AppShell
      title="Conflict Detection"
      subtitle="Select two or more contracts to scan for contradictory or incompatible clauses."
      contractGroups={contractGroups}
    >
      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">

        {/* ── LEFT — contract picker ────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Selection count pill */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Your contracts
            </span>
            {selectedIds.length > 0 && (
              <span className="rounded-full bg-blue-100 dark:bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
                {selectedIds.length} selected
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search contracts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-xl pl-9"
            />
          </div>

          {/* Contract list */}
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 420 }}>
            {loading && (
              <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading contracts…
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <FileText className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-500">No contracts found</p>
              </div>
            )}

            {filtered.map((c) => (
              <ContractPill
                key={c.id}
                contract={c}
                checked={selectedIds.includes(c.id)}
                onToggle={() => toggle(c.id)}
              />
            ))}
          </div>

          {/* Analyse button */}
          <Button
            onClick={analyze}
            disabled={selectedIds.length < 2 || analyzing}
            className="h-11 w-full rounded-xl"
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analysing…
              </>
            ) : selectedIds.length < 2 ? (
              `Select at least 2 contracts (${selectedIds.length}/2)`
            ) : (
              `Scan ${selectedIds.length} contracts for conflicts`
            )}
          </Button>

          {selectedIds.length >= 2 && !analyzing && (
            <p className="text-center text-xs text-slate-400">
              We'll compare all selected contracts against each other
            </p>
          )}
        </div>

        {/* ── RIGHT — results ──────────────────────────────────────────── */}
        <div>
          {/* Idle state */}
          {!result && !analyzing && (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10">
                <ShieldAlert className="h-8 w-8 text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">No analysis run yet</p>
                <p className="mt-1 max-w-xs text-sm text-slate-400">
                  Select two or more contracts on the left and click "Scan for conflicts"
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {analyzing && (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 py-20 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-200">Running conflict analysis…</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Our AI is reviewing all {selectedIds.length} contracts
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && !analyzing && (
            <div className="space-y-5">

              {/* Summary banner */}
              <div className={`flex items-start gap-4 rounded-2xl border p-5 ${colors.border} ${colors.bg}`}>
                {hasConflicts ? (
                  <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-green-600" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {hasConflicts
                        ? `${result.total_conflicts} conflict${result.total_conflicts !== 1 ? "s" : ""} detected`
                        : "No conflicts detected"}
                    </p>
                    <Badge className={colors.badge}>
                      {fmt(result.overall_risk)} risk
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {result.summary}
                  </p>
                </div>
              </div>

              {/* No conflicts hero */}
              {!hasConflicts && (
                <Card className="border border-green-100 dark:border-green-500/30 dark:bg-white/5">
                  <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20">
                      <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">All Clear!</p>
                    <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
                      The selected contracts have no conflicting clauses. They are fully
                      compatible with each other.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Conflict cards */}
              {hasConflicts && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Issues found — click any row to expand
                  </p>
                  {result.conflicts.map((c) => (
                    <ConflictCard key={c.id} conflict={c} />
                  ))}
                </div>
              )}

              {/* Re-run nudge */}
              <div className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-white/10 bg-white dark:bg-white/5 px-5 py-3">
                <p className="text-sm text-slate-500">
                  Compared {result.conflicts.length > 0
                    ? `${selectedIds.length} contracts`
                    : `all ${selectedIds.length} selected contracts`}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => { setResult(null); setSelectedIds([]); }}
                >
                  Start new scan
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
