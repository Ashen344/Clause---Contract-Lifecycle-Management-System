import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Shield,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatLabel, formatDate, formatCurrency } from "@/lib/utils";
import type { Contract } from "@/types/api";

function getNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function roleBadgeClass(role?: string | null) {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "bg-[#07153A] text-white";
    case "manager":
      return "bg-slate-900 text-white";
    case "viewer":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-[#07153A] text-white";
  }
}

export default function AdminOverviewPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [contractsByStage, setContractsByStage] = useState<any[]>([]);
  const [approvalStats, setApprovalStats] = useState<any[]>([]);
  const [valueByType, setValueByType] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAdminOverview = async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        statsRes,
        stagesRes,
        approvalsRes,
        valueByTypeRes,
        recentUsersRes,
        userActivityRes,
        contractsRes,
      ] = await Promise.all([
        api.getAdminStats().catch(() => null),
        api.getAdminContractsByStage().catch(() => []),
        api.getAdminApprovalStats().catch(() => []),
        api.getAdminValueByType().catch(() => []),
        api.getAdminRecentUsers().catch(() => []),
        api.getAdminUserActivity().catch(() => []),
        api.listContracts("?per_page=200").catch(() => ({ contracts: [] })),
      ]);

      setAdminStats(statsRes);
      setContractsByStage(Array.isArray(stagesRes) ? stagesRes : []);
      setApprovalStats(Array.isArray(approvalsRes) ? approvalsRes : []);
      setValueByType(Array.isArray(valueByTypeRes) ? valueByTypeRes : []);
      setRecentUsers(Array.isArray(recentUsersRes) ? recentUsersRes : []);
      setUserActivity(Array.isArray(userActivityRes) ? userActivityRes : []);
      setContracts(
        Array.isArray(contractsRes?.contracts) ? contractsRes.contracts : []
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load admin overview."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminOverview();
  }, []);

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

  const totalUsers = useMemo(() => {
    return (
      getNumber(adminStats?.total_users) ||
      getNumber(adminStats?.users_total) ||
      getNumber(adminStats?.user_count)
    );
  }, [adminStats]);

  const activeUsers = useMemo(() => {
    return (
      getNumber(adminStats?.active_users) ||
      getNumber(adminStats?.users_active) ||
      totalUsers
    );
  }, [adminStats, totalUsers]);

  const totalContracts = useMemo(() => {
    const fromStats =
      getNumber(adminStats?.total_contracts) ||
      getNumber(adminStats?.contracts_total);

    if (fromStats > 0) return fromStats;

    if (contracts.length > 0) return contracts.length;

    const fromStages = contractsByStage.reduce(
      (sum, item) => sum + getNumber(item?.count),
      0
    );

    return fromStages;
  }, [adminStats, contracts.length, contractsByStage]);

  const activeContracts = useMemo(() => {
    const fromStats =
      getNumber(adminStats?.active_contracts) ||
      getNumber(adminStats?.contracts_active);

    if (fromStats > 0) return fromStats;

    const fromContracts = contracts.filter(
      (contract) => String(contract.status || "").toLowerCase() === "active"
    ).length;

    if (fromContracts > 0) return fromContracts;

    const activeStage = contractsByStage.find((item) =>
      String(item?.stage || item?.name || item?.workflow_stage || "")
        .toLowerCase()
        .includes("active")
    );

    return getNumber(activeStage?.count);
  }, [adminStats, contracts, contractsByStage]);

  const pendingApprovals = useMemo(() => {
    const fromStats =
      getNumber(adminStats?.pending_approvals) ||
      getNumber(adminStats?.approvals_pending);

    if (fromStats > 0) return fromStats;

    const pendingItem = approvalStats.find((item) =>
      String(item?.status || "").toLowerCase().includes("pending")
    );

    return getNumber(pendingItem?.count);
  }, [adminStats, approvalStats]);

  const totalApprovals = useMemo(() => {
    const fromStats =
      getNumber(adminStats?.total_approvals) ||
      getNumber(adminStats?.approvals_total);

    if (fromStats) return fromStats;

    return approvalStats.reduce(
      (sum, item) => sum + getNumber(item?.count),
      0
    );
  }, [adminStats, approvalStats]);

  const highRiskContracts = useMemo(() => {
    const fromStats =
      getNumber(adminStats?.high_risk_contracts) ||
      getNumber(adminStats?.contracts_high_risk);

    if (fromStats > 0) return fromStats;

    const fromContracts = contracts.filter(
      (contract) => String(contract.risk_level || "").toLowerCase() === "high"
    ).length;

    return fromContracts;
  }, [adminStats, contracts]);

  const mediumRiskContracts = useMemo(() => {
    return contracts.filter(
      (contract) => String(contract.risk_level || "").toLowerCase() === "medium"
    ).length;
  }, [contracts]);

  const lowRiskContracts = useMemo(() => {
    return contracts.filter(
      (contract) => String(contract.risk_level || "").toLowerCase() === "low"
    ).length;
  }, [contracts]);

  const contractValueSummary = useMemo(() => {
    const values = contracts
      .map((contract) => Number(contract.value))
      .filter((value) => !Number.isNaN(value));

    if (values.length > 0) {
      const total = values.reduce((sum, value) => sum + value, 0);
      const average = totalContracts > 0 ? total / totalContracts : 0;
      const largest = Math.max(...values);
      return { total, average, largest };
    }

    if (valueByType.length > 0) {
      const totals = valueByType
        .map((item) => getNumber(item?.value || item?.total_value))
        .filter((value) => value > 0);

      const total = totals.reduce((sum, value) => sum + value, 0);
      const average = totalContracts > 0 ? total / totalContracts : 0;
      const largest = totals.length ? Math.max(...totals) : 0;

      return { total, average, largest };
    }

    return { total: 0, average: 0, largest: 0 };
  }, [contracts, valueByType, totalContracts]);

  const normalizedStages = useMemo(() => {
    if (contractsByStage.length > 0) {
      return contractsByStage
        .map((item) => ({
          label: formatLabel(item?.stage || item?.name || item?.workflow_stage),
          count: getNumber(item?.count),
        }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count);
    }

    const counts = new Map<string, number>();
    contracts.forEach((contract) => {
      const key = formatLabel(contract.workflow_stage || "unknown");
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [contractsByStage, contracts]);

  const largestStage = useMemo(() => {
    return normalizedStages[0] || null;
  }, [normalizedStages]);

  const normalizedValueByType = useMemo(() => {
    if (valueByType.length > 0) {
      return valueByType
        .map((item) => ({
          type: formatLabel(item?.type || item?.contract_type || "Other"),
          totalValue: getNumber(item?.value || item?.total_value),
          count: getNumber(item?.count, 0),
        }))
        .sort((a, b) => b.totalValue - a.totalValue);
    }

    const grouped = new Map<string, { totalValue: number; count: number }>();

    contracts.forEach((contract) => {
      const key = formatLabel(contract.contract_type || "Other");
      const current = grouped.get(key) || { totalValue: 0, count: 0 };
      current.totalValue += Number(contract.value) || 0;
      current.count += 1;
      grouped.set(key, current);
    });

    return Array.from(grouped.entries())
      .map(([type, values]) => ({
        type,
        totalValue: values.totalValue,
        count: values.count,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }, [valueByType, contracts]);

  const normalizedApprovals = useMemo(() => {
    return approvalStats
      .map((item) => ({
        label: formatLabel(item?.status || "unknown"),
        count: getNumber(item?.count),
      }))
      .filter((item) => item.count > 0);
  }, [approvalStats]);

  const cards = [
    {
      title: "Total Contracts",
      value: totalContracts,
      helper: "Across all repositories",
      icon: FileText,
      iconWrap:
        "bg-gradient-to-br from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/20",
      accent: "text-indigo-600",
    },
    {
      title: "Active Contracts",
      value: activeContracts,
      helper: "Currently in force",
      icon: CheckCircle2,
      iconWrap:
        "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20",
      accent: "text-emerald-600",
    },
    {
      title: "Pending Approvals",
      value: pendingApprovals,
      helper: "Awaiting stakeholder action",
      icon: CheckCircle2,
      iconWrap:
        "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20",
      accent: "text-amber-600",
    },
    {
      title: "High Risk Items",
      value: highRiskContracts,
      helper: "Need immediate review",
      icon: AlertTriangle,
      iconWrap:
        "bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/20",
      accent: "text-rose-600",
    },
  ];

  return (
    <AppShell
      title="Admin Overview"
      subtitle="System-wide statistics, value, risk and activity."
      contractGroups={contractGroups}
    >
      {error && (
        <div className="mb-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Card
                key={card.title}
                className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:bg-white/5 dark:border-white/10 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-slate-500">
                        {card.title}
                      </p>

                      <div className="flex items-end gap-2">
                        <h3 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
                          {loading ? "..." : card.value}
                        </h3>
                        <span
                          className={`pb-1 text-xs font-semibold ${card.accent}`}
                        >
                          Live
                        </span>
                      </div>

                      <p className="text-sm text-slate-500">{card.helper}</p>
                    </div>

                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.iconWrap}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
          <Card className="rounded-3xl border border-slate-200/80 bg-white dark:bg-white/5 dark:border-white/10 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    System value
                  </span>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Contract value
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Financial overview across the full contract repository.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 dark:bg-white/5 dark:border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600">Total value</span>
                    <span className="text-2xl font-semibold text-slate-950 dark:text-white">
                      {loading ? "..." : formatCurrency(contractValueSummary.total)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 dark:bg-white/5 dark:border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600">Average</span>
                    <span className="text-2xl font-semibold text-slate-950 dark:text-white">
                      {loading ? "..." : formatCurrency(contractValueSummary.average)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 dark:bg-white/5 dark:border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600">Largest</span>
                    <span className="text-2xl font-semibold text-slate-950 dark:text-white">
                      {loading ? "..." : formatCurrency(contractValueSummary.largest)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 dark:bg-white/5 dark:border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-600">System users</span>
                    <span className="text-2xl font-semibold text-slate-950 dark:text-white">
                      {loading ? "..." : totalUsers}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {loading ? "Loading..." : `${activeUsers} active accounts`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200/80 bg-white dark:bg-white/5 dark:border-white/10 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Status snapshot
                    </span>
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                    Contracts by workflow stage
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Real-time workflow distribution across the system.
                  </p>
                </div>

                {largestStage ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Largest segment
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {largestStage.label}
                    </p>
                    <p className="text-xs text-slate-500">
                      {largestStage.count} contracts
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Loading workflow stages...
                  </div>
                ) : normalizedStages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    No workflow data found.
                  </div>
                ) : (
                  normalizedStages.map((stage) => {
                    const max = largestStage?.count || 1;
                    const width = `${(stage.count / max) * 100}%`;

                    return (
                      <div
                        key={stage.label}
                        className="rounded-2xl border border-slate-200/80 bg-slate-50/70 dark:bg-white/5 dark:border-white/10 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {stage.label}
                            </p>
                          </div>

                          <Badge className="rounded-full bg-slate-900 px-3 py-1 text-white hover:bg-slate-900">
                            {stage.count}
                          </Badge>
                        </div>

                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-[#07153A]"
                            style={{ width }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card className="rounded-3xl border border-slate-200/80 bg-white dark:bg-white/5 dark:border-white/10 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Value by contract type
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Contract volume and value distribution by type.
                </p>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Loading values...
                </div>
              ) : normalizedValueByType.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No value data found.
                </div>
              ) : (
                <div className="space-y-3">
                  {normalizedValueByType.map((item) => (
                    <div
                      key={item.type}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 dark:bg-white/5 dark:border-white/10 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-base font-medium text-slate-950 dark:text-white">
                            {item.type}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.count} contract{item.count === 1 ? "" : "s"}
                          </p>
                        </div>
                        <p className="text-lg font-semibold text-slate-950 dark:text-white">
                          {formatCurrency(item.totalValue)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200/80 bg-white dark:bg-white/5 dark:border-white/10 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Approvals breakdown
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Current approval distribution across the full system.
                </p>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Loading approvals...
                </div>
              ) : normalizedApprovals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No approval data found.
                </div>
              ) : (
                <div className="space-y-5">
                  {normalizedApprovals.map((item) => {
                    const max = Math.max(
                      ...normalizedApprovals.map((x) => x.count),
                      1
                    );
                    const width = `${(item.count / max) * 100}%`;

                    return (
                      <div key={item.label}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {item.label}
                          </span>
                          <span className="text-lg font-semibold text-slate-950 dark:text-white">
                            {item.count}
                          </span>
                        </div>

                        <div className="h-3 rounded-full bg-slate-200">
                          <div
                            className="h-3 rounded-full bg-[#07153A]"
                            style={{ width }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card className="rounded-3xl border border-slate-200/80 bg-white dark:bg-white/5 dark:border-white/10 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6 flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-700" />
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Recent users
                </h2>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Loading users...
                </div>
              ) : recentUsers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No recent users found.
                </div>
              ) : (
                <div className="space-y-4">
                  {recentUsers.map((user, index) => (
                    <div
                      key={user.id || index}
                      className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-4 transition-all duration-200 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-medium text-slate-950 dark:text-white">
                            {user.full_name || user.name || "Unnamed user"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {user.email || "No email"}
                          </p>
                        </div>

                        <div className="text-right">
                          <Badge className={roleBadgeClass(user.role)}>
                            {formatLabel(user.role || "user")}
                          </Badge>
                          <p className="mt-2 text-xs text-slate-500">
                            {formatDate(user.created_at || user.joined_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200/80 bg-white dark:bg-white/5 dark:border-white/10 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-6 flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-700" />
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Recent system activity
                </h2>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Loading activity...
                </div>
              ) : userActivity.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No recent activity found.
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto pr-1" style={{ maxHeight: "420px" }}>
                  {userActivity.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-4 transition-all duration-200 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-medium text-slate-950 dark:text-white">
                            {item.title ||
                              `${formatLabel(item.action)} · ${formatLabel(
                                item.resource_type
                              )}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.description ||
                              item.message ||
                              `${item.user_email || "User"} — activity recorded.`}
                          </p>
                        </div>

                        <p className="text-xs text-slate-500">
                          {formatDate(item.created_at || item.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}