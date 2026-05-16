import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Pin,
  PinOff,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, buildContractsQuery } from "@/lib/api";
import { formatLabel as formatTypeLabel, formatDate, formatCurrency, statusBadgeClass as statusBadgeClass } from "@/lib/utils";
import type { Contract } from "@/types/api";
import { usePreferences } from "@/hooks/use-preferences";
import { useTheme } from "@/components/theme-provider";
import type { DashboardStats } from "@/types/api";

const THEMES = {
  indigo: {
    from: "#4F46E5",
    to: "#7C3AED",
    light: "#EEF2FF",
    border: "#C7D2FE",
    text: "#4338CA",
    muted: "#818CF8",
    ring1: "#4F46E5",
    ring2: "#A5B4FC",
  },
  violet: {
    from: "#7C3AED",
    to: "#A855F7",
    light: "#F5F3FF",
    border: "#DDD6FE",
    text: "#6D28D9",
    muted: "#A78BFA",
    ring1: "#7C3AED",
    ring2: "#C4B5FD",
  },
  blue: {
    from: "#2563EB",
    to: "#0EA5E9",
    light: "#EFF6FF",
    border: "#BFDBFE",
    text: "#1D4ED8",
    muted: "#60A5FA",
    ring1: "#3B82F6",
    ring2: "#93C5FD",
  },
  emerald: {
    from: "#059669",
    to: "#0D9488",
    light: "#ECFDF5",
    border: "#A7F3D0",
    text: "#047857",
    muted: "#34D399",
    ring1: "#10B981",
    ring2: "#6EE7B7",
  },
  rose: {
    from: "#E11D48",
    to: "#EC4899",
    light: "#FFF1F2",
    border: "#FECDD3",
    text: "#BE123C",
    muted: "#FB7185",
    ring1: "#F43F5E",
    ring2: "#FDA4AF",
  },
  amber: {
    from: "#D97706",
    to: "#F97316",
    light: "#FFFBEB",
    border: "#FDE68A",
    text: "#92400E",
    muted: "#FBBF24",
    ring1: "#F59E0B",
    ring2: "#FCD34D",
  },
} as const;

type ThemeKey = keyof typeof THEMES;

type StatusItem = { status: string; count: number };
type ExpiringItem = {
  id: string;
  title: string;
  contract_type: string;
  end_date: string;
  days_remaining: number;
};
type ActivityItem = {
  id: string;
  title: string;
  status: string;
  workflow_stage: string;
  updated_at: string;
};

function getDaysLabel(days: number) {
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "1 day left";
  if (days <= 7) return `${days} days left`;
  return `${days} days remaining`;
}

function getPercent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function getMinBarWidth(value: number, total: number) {
  if (!total || value <= 0) return 0;
  return Math.max((value / total) * 100, 8);
}

function buildTrendData(activity: ActivityItem[]) {
  const days: { day: string; contracts: number; risk: number }[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);

    const label = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    const count = activity.filter((a) => {
      const ad = new Date(a.updated_at);
      return ad.toDateString() === d.toDateString();
    }).length;

    days.push({
      day: label,
      contracts: count,
      risk: 0,
    });
  }

  return days;
}

function ChartTooltip({
  active,
  payload,
  label,
  dark,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
  dark: boolean;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-xs shadow-xl ${
        dark
          ? "border-white/10 bg-[#1A1D2E] text-white"
          : "border-slate-200 bg-white text-slate-800"
      }`}
    >
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p
          key={p.name}
          className={dark ? "text-slate-300" : "text-slate-500"}
        >
          {p.name}:{" "}
          <span className="font-semibold text-indigo-500">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function PinnedContractsSection({
  pinned,
  onUnpin,
  t,
}: {
  pinned: Array<{ id: string; title: string; status?: string }>;
  onUnpin: (id: string) => void;
  t: typeof THEMES[keyof typeof THEMES];
}) {
  if (pinned.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Pin className="h-4 w-4" style={{ color: t.text }} />
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Pinned contracts
        </span>
        <span
          className="ml-1 rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: t.light, color: t.text }}
        >
          {pinned.length}/5
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {pinned.map((contract) => (
          <div
            key={contract.id}
            className="group flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition-all hover:shadow-md"
            style={{ borderColor: "#E2E8F0" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = t.border;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = "#E2E8F0";
            }}
          >
            <Link
              to={`/contracts/${contract.id}`}
              className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.color = t.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              <span className="max-w-[180px] truncate">{contract.title}</span>
            </Link>

            {contract.status && (
              <Badge
                className={`rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(
                  contract.status
                )}`}
              >
                {formatTypeLabel(contract.status)}
              </Badge>
            )}

            <button
              onClick={() => onUnpin(contract.id)}
              title="Unpin"
              className="ml-1 rounded-lg p-1 text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
            >
              <PinOff className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [types, setTypes] = useState<Array<{ type: string; count: number }>>([]);
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [expiring, setExpiring] = useState<ExpiringItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { prefs, pinContract, unpinContract } = usePreferences();
  const sec = (key: string) => prefs.section_visibility?.[key as keyof typeof prefs.section_visibility] !== false;
  const actCount = prefs.activity_count ?? 10;
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const t =
    THEMES[(prefs.accent_color as ThemeKey) ?? "indigo"] ?? THEMES.indigo;

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, typeData, statusData, expiringData, activityData, contractsData] =
        await Promise.all([
          api.getDashboardStats(),
          api.getContractsByType(),
          api.getContractsByStatus(),
          api.getExpiringSoon(),
          api.getRecentActivity(),
          api.listContracts(buildContractsQuery({ per_page: 200 })),
        ]);

      setStats(statsData);
      setTypes(typeData);
      setStatuses(statusData);
      setExpiring(expiringData);
      setActivity(activityData);
      setAllContracts(contractsData.contracts ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const contractGroups = useMemo(
    () =>
      types.map((item) => ({
        name: formatTypeLabel(item.type),
        count: item.count,
      })),
    [types]
  );

  const totalContracts = stats?.total_contracts ?? 0;
  const activeContracts = stats?.active_contracts ?? 0;
  const pendingApprovals = stats?.pending_approvals ?? 0;
  const highRisk = stats?.risk_summary.high ?? 0;
  const mediumRisk = stats?.risk_summary.medium ?? 0;
  const lowRisk = stats?.risk_summary.low ?? 0;
  const totalRisk = lowRisk + mediumRisk + highRisk;

  const unratedCount = useMemo(
    () => allContracts.filter(c => !c.risk_level).length,
    [allContracts]
  );

  const riskyContracts = useMemo(() => {
    const riskWeight = (v?: string | null) =>
      v?.toLowerCase() === "high" ? 3 : v?.toLowerCase() === "medium" ? 2 : v?.toLowerCase() === "low" ? 1 : 0;
    const daysLeft = (d?: string | null) => {
      if (!d) return null;
      const diff = new Date(d).getTime() - Date.now();
      return isNaN(diff) ? null : Math.ceil(diff / 86400000);
    };
    return [...allContracts]
      .filter(c => c.risk_level?.toLowerCase() === "high" || c.risk_level?.toLowerCase() === "medium")
      .sort((a, b) => {
        const rDiff = riskWeight(b.risk_level) - riskWeight(a.risk_level);
        if (rDiff !== 0) return rDiff;
        const ad = daysLeft(a.end_date), bd = daysLeft(b.end_date);
        if (ad == null && bd == null) return 0;
        if (ad == null) return 1;
        if (bd == null) return -1;
        return ad - bd;
      });
  }, [allContracts]);

  const expiringRisky = useMemo(() => {
    const daysLeft = (d?: string | null) => {
      if (!d) return null;
      const diff = new Date(d).getTime() - Date.now();
      return isNaN(diff) ? null : Math.ceil(diff / 86400000);
    };
    return riskyContracts.filter(c => { const d = daysLeft(c.end_date); return d != null && d <= 90; }).slice(0, 6);
  }, [riskyContracts]);

  const riskByType = useMemo(() => {
    const map = new Map<string, { total: number; high: number; medium: number; low: number; unrated: number }>();
    allContracts.forEach(c => {
      const key = formatTypeLabel(c.contract_type || "other");
      if (!map.has(key)) map.set(key, { total: 0, high: 0, medium: 0, low: 0, unrated: 0 });
      const g = map.get(key)!;
      g.total++;
      const r = (c.risk_level || "").toLowerCase();
      if (r === "high") g.high++; else if (r === "medium") g.medium++; else if (r === "low") g.low++; else g.unrated++;
    });
    return [...map.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.total - a.total);
  }, [allContracts]);

  const topRiskType = useMemo(() => {
    if (!riskByType.length) return null;
    return [...riskByType].sort((a, b) => (b.high * 3 + b.medium * 2) - (a.high * 3 + a.medium * 2))[0];
  }, [riskByType]);

  const topStatus = useMemo(() => {
    if (!statuses.length) return null;
    return [...statuses].sort((a, b) => b.count - a.count)[0];
  }, [statuses]);

  const trendData = useMemo(() => buildTrendData(activity), [activity]);

  const typeChartData = useMemo(
    () =>
      types
        .slice(0, 6)
        .map((item) => ({
          name: formatTypeLabel(item.type).split(" ")[0],
          count: item.count,
        })),
    [types]
  );

  const allCards = [
    {
      key: "total_contracts" as const,
      title: "Total Contracts",
      value: totalContracts,
      helper: "Across all repositories",
      icon: FileText,
      themed: true,
      iconWrap: "",
      accent: "",
    },
    {
      key: "active_contracts" as const,
      title: "Active Contracts",
      value: activeContracts,
      helper: "Currently in force",
      icon: CheckCircle2,
      themed: false,
      iconWrap:
        "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20",
      accent: "text-emerald-600",
    },
    {
      key: "pending_approvals" as const,
      title: "Pending Approvals",
      value: pendingApprovals,
      helper: "Awaiting stakeholder action",
      icon: Clock3,
      themed: false,
      iconWrap:
        "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20",
      accent: "text-amber-600",
    },
    {
      key: "high_risk" as const,
      title: "High Risk Items",
      value: highRisk,
      helper: "Need immediate review",
      icon: AlertTriangle,
      themed: false,
      iconWrap:
        "bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/20",
      accent: "text-rose-600",
    },
  ];

  const visibleCards = allCards.filter(
    (card) => prefs.widget_visibility[card.key] !== false
  );

  const ringSegments = useMemo(() => {
    if (!totalRisk) {
      return [
        { key: "low", percent: 0, color: t.ring1 },
        { key: "medium", percent: 0, color: t.ring2 },
        { key: "high", percent: 0, color: "#F43F5E" },
      ];
    }

    return [
      { key: "low", percent: (lowRisk / totalRisk) * 100, color: t.ring1 },
      {
        key: "medium",
        percent: (mediumRisk / totalRisk) * 100,
        color: t.ring2,
      },
      {
        key: "high",
        percent: (highRisk / totalRisk) * 100,
        color: "#F43F5E",
      },
    ];
  }, [lowRisk, mediumRisk, highRisk, totalRisk, t]);

  const radius = 78;
  const circumference = 2 * Math.PI * radius;

  return (
    <AppShell
      title="Contract operations overview"
      subtitle="Live overview of contracts, approvals, activity, and AI-powered risk signals."
      contractGroups={contractGroups}
    >
      {error ? (
        <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <div className="space-y-6">
        <PinnedContractsSection
          pinned={prefs.pinned_contracts}
          onUnpin={unpinContract}
          t={t}
        />

        {visibleCards.length > 0 ? (
          <section
            className={`grid gap-4 ${
              visibleCards.length === 1
                ? "max-w-sm"
                : visibleCards.length === 2
                ? "md:grid-cols-2"
                : visibleCards.length === 3
                ? "md:grid-cols-2 xl:grid-cols-3"
                : "md:grid-cols-2 xl:grid-cols-4"
            }`}
          >
            {visibleCards.map((card) => {
              const Icon = card.icon;

              return (
                <Card
                  key={card.key}
                  className="overflow-hidden rounded-3xl border border-slate-200/80 dark:border-white/8 bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          {card.title}
                        </p>
                        <div className="flex items-end gap-2">
                          <h3 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
                            {loading ? "..." : card.value}
                          </h3>
                          <span
                            className={`pb-1 text-xs font-semibold ${
                              card.themed ? "" : card.accent
                            }`}
                            style={card.themed ? { color: t.text } : {}}
                          >
                            Live
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{card.helper}</p>
                      </div>

                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${
                          card.themed ? "" : card.iconWrap
                        }`}
                        style={
                          card.themed
                            ? {
                                background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                                boxShadow: `0 8px 24px -4px ${t.from}40`,
                              }
                            : {}
                        }
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
            <p className="text-sm text-slate-500">All stat cards are hidden.</p>
            <Link
              to="/settings"
              className="mt-2 block text-sm font-medium hover:underline"
              style={{ color: t.text }}
            >
              Go to Settings to show them
            </Link>
          </div>
        )}

        {sec("activity_trend") && <section className="rounded-3xl border border-slate-200/80 dark:border-white/8 bg-white dark:bg-[#131829] p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  Activity trend
                </span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Contract activity — last 30 days
              </h2>
            </div>
            <Badge className="rounded-full border border-indigo-200/60 bg-indigo-50 text-indigo-700 hover:bg-indigo-50">
              Live data
            </Badge>
          </div>

          {loading ? (
            <div className="h-52 w-full animate-pulse rounded-xl bg-slate-200" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={trendData}
                margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="dashboardContractsArea"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={t.from} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={t.from} stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={
                    dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"
                  }
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tickFormatter={(val, idx) => (idx % 5 === 0 ? val : "")}
                  tick={{
                    fontSize: 11,
                    fill: dark ? "#6B7280" : "#94A3B8",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: dark ? "#6B7280" : "#94A3B8",
                  }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip dark={dark} />} />
                <Area
                  type="monotone"
                  dataKey="contracts"
                  name="Updates"
                  stroke={t.from}
                  strokeWidth={2.5}
                  fill="url(#dashboardContractsArea)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: t.from,
                    stroke: dark ? "#1A1D2E" : "#fff",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </section>}

        {sec("status_overview") && <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <Card className="rounded-3xl border border-slate-200/80 dark:border-white/8 bg-card shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" style={{ color: t.muted }} />
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Status snapshot
                    </span>
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Contract status overview
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Real-time status distribution from your contract repository.
                  </p>
                </div>
                {topStatus ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/5 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Largest segment
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {formatTypeLabel(topStatus.status)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {topStatus.count} contracts
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                {!loading && statuses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No status data found.
                  </div>
                ) : null}

                {statuses.map((item) => (
                  <div
                    key={item.status}
                    className="rounded-2xl border border-slate-200/80 dark:border-white/8 bg-slate-50/70 dark:bg-white/4 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {formatTypeLabel(item.status)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {getPercent(item.count, totalContracts)}% of all
                          contracts
                        </p>
                      </div>
                      <Badge className="rounded-full bg-slate-900 px-3 py-1 text-white hover:bg-slate-900">
                        {item.count}
                      </Badge>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/15">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${getMinBarWidth(
                            item.count,
                            totalContracts
                          )}%`,
                          background: `linear-gradient(to right, ${t.from}, ${t.to})`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200/80 dark:border-white/8 bg-card shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-violet-500" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    AI risk summary
                  </span>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Risk distribution
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Based on your backend AI analysis data.
                </p>
              </div>

              <div className="flex flex-col items-center">
                <div className="relative flex h-[270px] w-[270px] items-center justify-center">
                  <svg viewBox="0 0 240 240" className="-rotate-90 h-[240px] w-[240px]">
                    <circle
                      cx="120"
                      cy="120"
                      r={radius}
                      fill="none"
                      stroke="#E5E7EB"
                      strokeWidth="24"
                    />
                    {(() => {
                      let cumulativeOffset = 0;
                      return ringSegments.map((segment) => {
                        const dash = (segment.percent / 100) * circumference;
                        const dashArray = `${dash} ${circumference}`;
                        const dashOffset = -cumulativeOffset;
                        cumulativeOffset += dash + 10;

                        return (
                          <circle
                            key={segment.key}
                            cx="120"
                            cy="120"
                            r={radius}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="24"
                            strokeLinecap="round"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                          />
                        );
                      });
                    })()}
                  </svg>

                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Total
                    </span>
                    <span className="mt-1 text-5xl font-semibold tracking-tight text-slate-900 dark:text-white">
                      {loading ? "..." : totalRisk}
                    </span>
                    <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Analysed contracts
                    </span>
                  </div>
                </div>

                <div className="mt-2 w-full space-y-3">
                  {[
                    {
                      label: "Low risk",
                      count: lowRisk,
                      percent: getPercent(lowRisk, totalRisk),
                      color: t.ring1,
                    },
                    {
                      label: "Medium risk",
                      count: mediumRisk,
                      percent: getPercent(mediumRisk, totalRisk),
                      color: t.ring2,
                    },
                    {
                      label: "High risk",
                      count: highRisk,
                      percent: getPercent(highRisk, totalRisk),
                      color: "#F43F5E",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/4 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {item.label}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.count} contracts
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {item.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>}

        {sec("contracts_by_type") && <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card className="rounded-3xl border border-slate-200/80 dark:border-white/8 bg-card shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-cyan-500" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                      Type breakdown
                    </span>
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Contracts by type
                  </h2>
                </div>
              </div>

              {loading ? (
                <div className="h-48 w-full animate-pulse rounded-xl bg-slate-200" />
              ) : typeChartData.length === 0 ? (
                <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                  No type data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={typeChartData}
                    margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={
                        dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"
                      }
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{
                        fontSize: 11,
                        fill: dark ? "#6B7280" : "#94A3B8",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 11,
                        fill: dark ? "#6B7280" : "#94A3B8",
                      }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip dark={dark} />} />
                    <Bar
                      dataKey="count"
                      name="Contracts"
                      fill={t.from}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200/80 dark:border-white/8 bg-card shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Upcoming and due documents
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Contracts expiring within 30 days. Pin any to your dashboard
                    for quick access.
                  </p>
                </div>
                <div
                  className="hidden rounded-2xl px-3 py-2 text-right sm:block"
                  style={{ backgroundColor: t.light }}
                >
                  <p
                    className="text-xs uppercase tracking-[0.2em]"
                    style={{ color: t.muted }}
                  >
                    Focus
                  </p>
                  <p className="text-sm font-semibold" style={{ color: t.text }}>
                    Time-sensitive
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {!loading && expiring.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No active contracts are expiring soon.
                  </div>
                ) : null}

                {expiring.map((item) => {
                  const pinned = prefs.pinned_contracts.some(
                    (p) => p.id === item.id
                  );

                  return (
                    <div
                      key={item.id}
                      className="group flex items-start justify-between gap-4 rounded-2xl border border-slate-200 dark:border-white/8 bg-slate-50/70 dark:bg-white/4 px-5 py-4 transition-all duration-200"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-2 h-3 w-3 rounded-full shadow-sm"
                          style={{
                            backgroundColor: t.muted,
                            boxShadow: `0 2px 6px ${t.from}50`,
                          }}
                        />
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {formatTypeLabel(item.contract_type)} · ends{" "}
                            {formatDate(item.end_date)}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge className="rounded-full bg-slate-900 px-3 py-1 text-white hover:bg-slate-900">
                          {getDaysLabel(item.days_remaining)}
                        </Badge>
                        <button
                          onClick={() =>
                            pinned
                              ? unpinContract(item.id)
                              : pinContract({ id: item.id, title: item.title })
                          }
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all"
                          style={
                            pinned
                              ? { backgroundColor: t.light, color: t.text }
                              : { color: "#94A3B8" }
                          }
                        >
                          {pinned ? (
                            <PinOff className="h-3 w-3" />
                          ) : (
                            <Pin className="h-3 w-3" />
                          )}
                          {pinned ? "Pinned" : "Pin"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>}

        {sec("recent_activity") && <section>
          <Card className="rounded-3xl border border-slate-200/80 dark:border-white/8 bg-card shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Recent activity
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Latest updates. Pin any contract for quick access.
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-slate-400" />
              </div>

              <div className="space-y-4">
                {!loading && activity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No recent activity found.
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  {activity.slice(0, actCount).map((item) => {
                    const pinned = prefs.pinned_contracts.some(
                      (p) => p.id === item.id
                    );

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/4 px-4 py-4 transition-all duration-200 hover:border-slate-300 dark:hover:border-white/15 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900 dark:text-white">
                              {item.title}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge
                                className="rounded-full px-2 py-0.5 text-xs"
                                style={{
                                  backgroundColor: t.light,
                                  color: t.text,
                                }}
                              >
                                {formatTypeLabel(item.status)}
                              </Badge>
                              <Badge className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100">
                                {formatTypeLabel(item.workflow_stage)}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                              <span>{formatDate(item.updated_at)}</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </div>
                            <button
                              onClick={() =>
                                pinned
                                  ? unpinContract(item.id)
                                  : pinContract({
                                      id: item.id,
                                      title: item.title,
                                      status: item.status,
                                    })
                              }
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all"
                              style={
                                pinned
                                  ? {
                                      backgroundColor: t.light,
                                      color: t.text,
                                    }
                                  : { color: "#94A3B8" }
                              }
                            >
                              {pinned ? (
                                <PinOff className="h-3 w-3" />
                              ) : (
                                <Pin className="h-3 w-3" />
                              )}
                              {pinned ? "Pinned" : "Pin"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>}

        {/* ── Risk Analysis ─────────────────────────────────────────── */}
        {sec("risk_analysis") && <section>
          <div className="mb-4 flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Risk Analysis</h2>
          </div>

          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border border-slate-200 dark:border-white/8 bg-white dark:bg-[#131829] shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">High Risk</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{loading ? "—" : highRisk}</p>
                    <p className="mt-2 text-sm text-slate-500">Immediate attention</p>
                  </div>
                  <div className="rounded-2xl bg-red-50 p-3 text-red-600"><ShieldAlert className="h-6 w-6" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 dark:border-white/8 bg-white dark:bg-[#131829] shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Medium Risk</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{loading ? "—" : mediumRisk}</p>
                    <p className="mt-2 text-sm text-slate-500">Needs monitoring</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-3 text-amber-600"><AlertTriangle className="h-6 w-6" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 dark:border-white/8 bg-white dark:bg-[#131829] shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Low Risk</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{loading ? "—" : lowRisk}</p>
                    <p className="mt-2 text-sm text-slate-500">Lower priority</p>
                  </div>
                  <div className="rounded-2xl bg-green-50 p-3 text-green-600"><ShieldCheck className="h-6 w-6" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 dark:border-white/8 bg-white dark:bg-[#131829] shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Risk Coverage</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                      {loading ? "—" : totalRisk + unratedCount === 0 ? "0%" : `${Math.round((totalRisk / (totalRisk + unratedCount)) * 100)}%`}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">Rated of {loading ? "—" : totalRisk + unratedCount} contracts</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-600"><ShieldQuestion className="h-6 w-6" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risky contracts + expiring risky */}
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <Card className="border border-slate-200 dark:border-white/8 bg-white dark:bg-[#131829] shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Contracts requiring attention</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">High and medium risk contracts, sorted by severity.</p>
                </div>
                {topRiskType && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 dark:bg-white/4 dark:border-white/8 px-4 py-3 text-right shrink-0">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Highest risk type</p>
                    <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{topRiskType.type}</p>
                    <p className="text-xs text-slate-500">{topRiskType.high} high · {topRiskType.medium} medium</p>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : riskyContracts.length === 0 ? (
                  <p className="text-sm text-slate-500">No high or medium risk contracts found.</p>
                ) : (
                  <div className="space-y-3">
                    {riskyContracts.slice(0, 8).map(c => (
                      <Link key={c.id} to={`/contracts/${c.id}`}
                        className="block rounded-2xl border border-slate-200 dark:border-white/8 p-4 transition hover:bg-slate-50 dark:hover:bg-white/4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white">{c.title}</p>
                            <p className="mt-0.5 text-sm text-slate-500 truncate">{c.description || "No description."}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge className={statusBadgeClass(c.risk_level)}>{formatTypeLabel(c.risk_level)}</Badge>
                              <Badge className="bg-slate-100 text-slate-700">{formatTypeLabel(c.contract_type)}</Badge>
                              <Badge className="bg-slate-100 text-slate-700">{formatTypeLabel(c.status)}</Badge>
                            </div>
                          </div>
                          <div className="shrink-0 text-sm text-slate-500 text-right">
                            <p><span className="font-medium text-slate-900 dark:text-white">Value:</span> {formatCurrency(c.value)}</p>
                            <p className="mt-1"><span className="font-medium text-slate-900 dark:text-white">End:</span> {formatDate(c.end_date)}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border border-slate-200 dark:border-white/8 bg-white dark:bg-[#131829] shadow-sm">
                <CardHeader><CardTitle className="text-base">Expiring risky contracts</CardTitle></CardHeader>
                <CardContent>
                  {loading ? <p className="text-sm text-slate-500">Loading…</p>
                    : expiringRisky.length === 0 ? <p className="text-sm text-slate-500">No risky contracts expiring within 90 days.</p>
                    : (
                      <div className="space-y-3">
                        {expiringRisky.map(c => {
                          const days = Math.ceil((new Date(c.end_date!).getTime() - Date.now()) / 86400000);
                          return (
                            <Link key={c.id} to={`/contracts/${c.id}`}
                              className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 dark:border-white/8 p-3 transition hover:bg-slate-50 dark:hover:bg-white/4">
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-900 dark:text-white">{c.title}</p>
                                <p className="mt-0.5 text-xs text-slate-500">{formatDate(c.end_date)}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <Badge className={statusBadgeClass(c.risk_level)}>{formatTypeLabel(c.risk_level)}</Badge>
                                <div className="mt-1.5 flex items-center justify-end gap-1 text-xs text-slate-500">
                                  <CalendarClock className="h-3.5 w-3.5" />
                                  <span>{days} days left</span>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                </CardContent>
              </Card>

              <Card className="border border-slate-200 dark:border-white/8 bg-white dark:bg-[#131829] shadow-sm">
                <CardHeader><CardTitle className="text-base">Risk summary</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Total contracts", value: totalRisk + unratedCount },
                    { label: "Rated contracts", value: totalRisk },
                    { label: "Unrated contracts", value: unratedCount },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between rounded-2xl bg-slate-50 dark:bg-white/4 px-4 py-3">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{row.label}</span>
                      <span className="text-lg font-semibold text-slate-950 dark:text-white">{loading ? "—" : row.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Risk distribution by type */}
          <Card className="mt-6 border border-slate-200 dark:border-white/8 bg-white dark:bg-[#131829] shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Risk distribution by contract type</CardTitle>
              <p className="text-sm text-slate-500">Generated from live backend contract records.</p>
            </CardHeader>
            <CardContent>
              {loading ? <p className="text-sm text-slate-500">Loading…</p>
                : riskByType.length === 0 ? <p className="text-sm text-slate-500">No contract risk data available yet.</p>
                : (
                  <div className="space-y-4">
                    {riskByType.map(item => {
                      const tot = item.total || 1;
                      return (
                        <div key={item.type} className="rounded-2xl border border-slate-200 dark:border-white/8 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="font-medium text-slate-900 dark:text-white">{item.type}</p>
                            <p className="text-sm text-slate-500">{item.total} contract{item.total === 1 ? "" : "s"}</p>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                            <div className="flex h-full w-full">
                              <div className="h-full bg-red-400" style={{ width: `${(item.high / tot) * 100}%` }} />
                              <div className="h-full bg-amber-400" style={{ width: `${(item.medium / tot) * 100}%` }} />
                              <div className="h-full bg-green-400" style={{ width: `${(item.low / tot) * 100}%` }} />
                              <div className="h-full bg-slate-300" style={{ width: `${(item.unrated / tot) * 100}%` }} />
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">High: {item.high}</span>
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">Medium: {item.medium}</span>
                            <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">Low: {item.low}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Unrated: {item.unrated}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </CardContent>
          </Card>
        </section>}
      </div>
    </AppShell>
  );
}