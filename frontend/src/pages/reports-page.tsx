import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileText, Loader2, Play } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type {
  ReportChartType,
  ReportColumn,
  ReportDefinition,
  ReportDimension,
  ReportMeasure,
  ReportPreset,
  ReportResult,
} from "@/types/api";

// ── Constants ──────────────────────────────────────────────────────────────

const DIMENSION_OPTIONS: { value: ReportDimension; label: string }[] = [
  { value: "contract_type", label: "Contract Type" },
  { value: "status", label: "Status" },
  { value: "workflow_stage", label: "Workflow Stage" },
  { value: "risk_level", label: "Risk Level" },
  { value: "created_by", label: "Created By" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "tags", label: "Tags" },
];

const MEASURE_OPTIONS: { value: ReportMeasure; label: string }[] = [
  { value: "count", label: "Count" },
  { value: "total_value", label: "Total Value ($)" },
  { value: "avg_value", label: "Avg Value ($)" },
  { value: "min_value", label: "Min Value ($)" },
  { value: "max_value", label: "Max Value ($)" },
  { value: "avg_risk_score", label: "Avg Risk Score" },
  { value: "max_risk_score", label: "Max Risk Score" },
  { value: "min_risk_score", label: "Min Risk Score" },
];

const CHART_TYPES: { value: ReportChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "pie", label: "Pie" },
  { value: "donut", label: "Donut" },
  { value: "stacked_bar", label: "Stacked" },
  { value: "table", label: "Table" },
];

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Chart ──────────────────────────────────────────────────────────────────

function ReportChart({ result }: { result: ReportResult }) {
  const { rows, columns, chart_type } = result;

  const dimCols = columns.filter((c: ReportColumn) => c.type === "string");
  const measureCols = columns.filter((c: ReportColumn) => c.type === "number");

  const xKey = dimCols[0]?.key ?? measureCols[0]?.key ?? "_id";

  const chartData = rows.map((row) => {
    const item: Record<string, unknown> = {};
    columns.forEach((col) => {
      item[col.key] = row[col.key] ?? 0;
    });
    return item;
  });

  if (chart_type === "pie" || chart_type === "donut") {
    const nameKey = dimCols[0]?.key ?? "label";
    const valueKey = measureCols[0]?.key ?? "count";
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={chart_type === "donut" ? "38%" : 0}
            outerRadius="68%"
            label={({ name, percent }) =>
              `${name ?? "?"}: ${((percent ?? 0) * 100).toFixed(1)}%`
            }
          >
            {chartData.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart_type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {measureCols.map((col, idx) => (
            <Line
              key={col.key}
              type="monotone"
              dataKey={col.key}
              name={col.label}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // bar / stacked_bar (default)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ left: 10, right: 20, top: 10, bottom: 10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        {measureCols.map((col, idx) => (
          <Bar
            key={col.key}
            dataKey={col.key}
            name={col.label}
            fill={COLORS[idx % COLORS.length]}
            stackId={chart_type === "stacked_bar" ? "stack" : undefined}
            radius={chart_type === "stacked_bar" ? undefined : [4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function ReportsContent() {
  const [presets, setPresets] = useState<ReportPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);

  const [dimensions, setDimensions] = useState<ReportDimension[]>([
    "contract_type",
  ]);
  const [measures, setMeasures] = useState<ReportMeasure[]>(["count"]);
  const [chartType, setChartType] = useState<ReportChartType>("bar");

  const [result, setResult] = useState<ReportResult | null>(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getReportPresets()
      .then(setPresets)
      .catch(() => {})
      .finally(() => setPresetsLoading(false));
  }, []);

  const buildDefinition = useCallback(
    (): ReportDefinition => ({
      dimensions,
      measures,
      chart_type: chartType,
    }),
    [dimensions, measures, chartType]
  );

  const runReport = useCallback(
    async (def?: ReportDefinition) => {
      setRunning(true);
      setError(null);
      try {
        const data = await api.runReport(def ?? buildDefinition());
        setResult(data);
        if (def) {
          setChartType(def.chart_type);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Report failed.");
      } finally {
        setRunning(false);
      }
    },
    [buildDefinition]
  );

  const handlePresetClick = useCallback(
    (preset: ReportPreset) => {
      const { definition } = preset;
      setDimensions(definition.dimensions);
      setMeasures(definition.measures);
      setChartType(definition.chart_type);
      runReport(definition);
    },
    [runReport]
  );

  const handleExport = useCallback(
    async (format: "csv" | "pdf") => {
      setExporting(format);
      try {
        const { blob, filename } = await api.downloadReportBlob(
          buildDefinition(),
          format
        );
        triggerDownload(blob, filename);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed.");
      } finally {
        setExporting(null);
      }
    },
    [buildDefinition]
  );

  const toggleDimension = (dim: ReportDimension) => {
    setDimensions((prev) =>
      prev.includes(dim)
        ? prev.filter((d) => d !== dim)
        : prev.length < 3
        ? [...prev, dim]
        : prev
    );
  };

  const toggleMeasure = (m: ReportMeasure) => {
    setMeasures((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const canRun = measures.length > 0 && !running;

  return (
    <>
      {/* Quick Reports */}
      <div className="mb-6">
        <p className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-400">
          Quick Reports
        </p>
        {presetsLoading ? (
          <p className="text-sm text-slate-500">Loading presets...</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                className="flex min-w-[190px] max-w-[210px] shrink-0 flex-col gap-1.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:shadow"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                  {preset.name}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Builder */}
      <Card className="mb-6 border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm">
        <CardHeader>
          <CardTitle>Report Builder</CardTitle>
          <p className="text-sm text-slate-500">
            Select up to 3 dimensions and at least one measure.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Dimensions */}
            <div>
              <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                Group by
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DIMENSION_OPTIONS.map((opt) => {
                  const selected = dimensions.includes(opt.value);
                  const maxed = !selected && dimensions.length >= 3;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleDimension(opt.value)}
                      disabled={maxed}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition",
                        selected
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 font-medium text-blue-700"
                          : maxed
                          ? "cursor-not-allowed border-slate-100 bg-slate-50 dark:bg-white/5 text-slate-300"
                          : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Measures */}
            <div>
              <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                Calculate
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MEASURE_OPTIONS.map((opt) => {
                  const selected = measures.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleMeasure(opt.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition",
                        selected
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10 font-medium text-purple-700"
                          : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chart type + action buttons */}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Visualise:</p>
              {CHART_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => setChartType(ct.value)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm transition",
                    chartType === ct.value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10"
                  )}
                >
                  {ct.label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex gap-2">
              {result && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("csv")}
                    disabled={exporting !== null}
                    className="gap-1.5 rounded-xl"
                  >
                    {exporting === "csv" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("pdf")}
                    disabled={exporting !== null}
                    className="gap-1.5 rounded-xl"
                  >
                    {exporting === "pdf" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    PDF
                  </Button>
                </>
              )}

              <Button
                onClick={() => runReport()}
                disabled={!canRun}
                size="sm"
                className="gap-1.5 rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-700"
              >
                {running ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Run Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CardTitle>Results</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-slate-100 text-slate-700">
                  {result.summary.total_rows} rows
                </Badge>
                <Badge className="bg-slate-100 text-slate-700">
                  {result.summary.total_contracts_matched} contracts
                </Badge>
                {Object.entries(result.summary.summary_stats).map(([k, v]) => (
                  <Badge key={k} className="bg-blue-50 text-blue-700">
                    {k.replace(/^total_/, "").replace(/_/g, " ")}:{" "}
                    {typeof v === "number"
                      ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : String(v)}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {result.rows.length === 0 ? (
              <p className="text-sm text-slate-500">
                No data found for this report.
              </p>
            ) : (
              <>
                {result.chart_type !== "table" && (
                  <div className="mb-6 h-72">
                    <ReportChart result={result} />
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {result.columns.map((col) => (
                          <th
                            key={col.key}
                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {result.columns.map((col) => (
                            <td
                              key={col.key}
                              className="px-4 py-3 text-slate-700"
                            >
                              {formatValue(row[col.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function ReportsPage() {
  return (
    <AppShell title="Reports" subtitle="Build, run, and export custom contract reports.">
      <ReportsContent />
    </AppShell>
  );
}
