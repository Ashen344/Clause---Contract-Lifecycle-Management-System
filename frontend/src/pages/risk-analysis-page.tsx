import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, buildContractsQuery } from "@/lib/api";
import { formatLabel, formatDate, formatCurrency, statusBadgeClass as riskBadgeClass } from "@/lib/utils";
import type { Contract, ContractsResponse } from "@/types/api";

function getDaysRemaining(value?: string | null) {
  if (!value) return null;
  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return null;

  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function riskWeight(value?: string | null) {
  switch ((value || "").toLowerCase()) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

const bluePanel =
  "rounded-3xl border border-violet-100 bg-violet-50/60 shadow-sm dark:border-violet-500/20 dark:bg-violet-500/10";

const innerPanel =
  "rounded-2xl border border-violet-100 bg-white/70 dark:border-violet-500/20 dark:bg-white/5";

export default function RiskAnalysisPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [meta, setMeta] = useState<ContractsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadContracts = async () => {
    setLoading(true);
    setError(null);

    try {
      const query = buildContractsQuery({ per_page: 200 });
      const data = await api.listContracts(query);
      setContracts(data.contracts);
      setMeta(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load risk analysis."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, []);

  const contractGroups = useMemo(() => {
    const counts = new Map<string, number>();

    contracts.forEach((contract) => {
      counts.set(
        contract.contract_type,
        (counts.get(contract.contract_type) || 0) + 1
      );
    });

    return Array.from(counts.entries()).map(([name, count]) => ({
      name: formatLabel(name),
      count,
    }));
  }, [contracts]);

  const riskStats = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    let unrated = 0;

    contracts.forEach((contract) => {
      const risk = (contract.risk_level || "").toLowerCase();

      if (risk === "high") high += 1;
      else if (risk === "medium") medium += 1;
      else if (risk === "low") low += 1;
      else unrated += 1;
    });

    return {
      total: contracts.length,
      high,
      medium,
      low,
      unrated,
      rated: high + medium + low,
    };
  }, [contracts]);

  const riskyContracts = useMemo(() => {
    return [...contracts]
      .filter((contract) => {
        const risk = (contract.risk_level || "").toLowerCase();
        return risk === "high" || risk === "medium";
      })
      .sort((a, b) => {
        const riskDiff = riskWeight(b.risk_level) - riskWeight(a.risk_level);
        if (riskDiff !== 0) return riskDiff;

        const aDays = getDaysRemaining(a.end_date);
        const bDays = getDaysRemaining(b.end_date);

        if (aDays == null && bDays == null) return 0;
        if (aDays == null) return 1;
        if (bDays == null) return -1;

        return aDays - bDays;
      });
  }, [contracts]);

  const expiringRiskyContracts = useMemo(() => {
    return riskyContracts
      .filter((contract) => {
        const days = getDaysRemaining(contract.end_date);
        return days != null && days <= 90;
      })
      .slice(0, 6);
  }, [riskyContracts]);

  const riskByType = useMemo(() => {
    const grouped = new Map<
      string,
      {
        total: number;
        high: number;
        medium: number;
        low: number;
        unrated: number;
      }
    >();

    contracts.forEach((contract) => {
      const key = formatLabel(contract.contract_type || "other");

      if (!grouped.has(key)) {
        grouped.set(key, {
          total: 0,
          high: 0,
          medium: 0,
          low: 0,
          unrated: 0,
        });
      }

      const group = grouped.get(key)!;
      group.total += 1;

      const risk = (contract.risk_level || "").toLowerCase();
      if (risk === "high") group.high += 1;
      else if (risk === "medium") group.medium += 1;
      else if (risk === "low") group.low += 1;
      else group.unrated += 1;
    });

    return Array.from(grouped.entries())
      .map(([type, values]) => ({
        type,
        ...values,
      }))
      .sort((a, b) => b.total - a.total);
  }, [contracts]);

  const highestRiskType = useMemo(() => {
    if (riskByType.length === 0) return null;

    return [...riskByType].sort((a, b) => {
      const aScore = a.high * 3 + a.medium * 2 + a.low;
      const bScore = b.high * 3 + b.medium * 2 + b.low;
      return bScore - aScore;
    })[0];
  }, [riskByType]);

  const ratedPercentage = useMemo(() => {
    if (riskStats.total === 0) return 0;
    return Math.round((riskStats.rated / riskStats.total) * 100);
  }, [riskStats]);

  return (
    <AppShell
      title="Risk Analysis"
      subtitle="Live risk overview based on backend contract records."
      contractGroups={contractGroups}
    >
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "High Risk Contracts",
            value: riskStats.high,
            helper: "Immediate attention needed",
            icon: ShieldAlert,
            card: "bg-rose-50 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20",
            iconBox: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
            valueClass: "text-rose-700 dark:text-rose-300",
          },
          {
            title: "Medium Risk Contracts",
            value: riskStats.medium,
            helper: "Needs monitoring",
            icon: AlertTriangle,
            card: "bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20",
            iconBox: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
            valueClass: "text-amber-700 dark:text-amber-300",
          },
          {
            title: "Low Risk Contracts",
            value: riskStats.low,
            helper: "Lower priority review",
            icon: ShieldCheck,
            card: "bg-green-50 border-green-100 dark:bg-green-500/10 dark:border-green-500/20",
            iconBox: "bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300",
            valueClass: "text-green-700 dark:text-green-300",
          },
          {
            title: "Risk Coverage",
            value: `${ratedPercentage}%`,
            helper: `Rated out of ${riskStats.total} contracts`,
            icon: ShieldQuestion,
            card: "bg-violet-50 border-violet-100 dark:bg-violet-500/10 dark:border-violet-500/20",
            iconBox: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
            valueClass: "text-violet-700 dark:text-violet-300",
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Card
              key={item.title}
              className={`overflow-hidden rounded-3xl border shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${item.card}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
                      {item.title}
                    </p>
                    <p
                      className={`mt-2 text-3xl font-semibold ${item.valueClass}`}
                    >
                      {loading ? "—" : item.value}
                    </p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {loading && item.title === "Risk Coverage"
                        ? "Rated out of — contracts"
                        : item.helper}
                    </p>
                  </div>

                  <div className={`rounded-2xl p-3 ${item.iconBox}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {error ? null : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <Card className={bluePanel}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Risk Overview
                </p>
                <CardTitle className="mt-2 text-2xl text-slate-900 dark:text-white">
                  Contracts requiring attention
                </CardTitle>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Live high and medium risk contracts from your backend.
                </p>
              </div>

              {highestRiskType ? (
                <div className={innerPanel + " px-4 py-3 text-right"}>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Highest Risk Type
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    {highestRiskType.type}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {highestRiskType.high} high · {highestRiskType.medium} medium
                  </p>
                </div>
              ) : null}
            </CardHeader>

            <CardContent>
              {loading ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Loading risk data...
                </p>
              ) : riskyContracts.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No high or medium risk contracts found.
                </p>
              ) : (
                <div className="space-y-4">
                  {riskyContracts.slice(0, 8).map((contract) => (
                    <Link
                      key={contract.id}
                      to={`/contracts/${contract.id}`}
                      className={innerPanel + " block p-4 transition hover:bg-violet-50 dark:hover:bg-violet-500/10"}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-slate-950 dark:text-white">
                            {contract.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {contract.description || "No description provided."}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge className={riskBadgeClass(contract.risk_level)}>
                              {formatLabel(contract.risk_level)}
                            </Badge>
                            <Badge className="bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300">
                              {formatLabel(contract.contract_type)}
                            </Badge>
                            <Badge className="bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300">
                              {formatLabel(contract.status)}
                            </Badge>
                          </div>
                        </div>

                        <div className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
                          <p>
                            <span className="font-medium text-slate-900 dark:text-white">
                              Value:
                            </span>{" "}
                            {formatCurrency(contract.value)}
                          </p>
                          <p className="mt-1">
                            <span className="font-medium text-slate-900 dark:text-white">
                              End:
                            </span>{" "}
                            {formatDate(contract.end_date)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className={bluePanel}>
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white">
                  Expiring risky contracts
                </CardTitle>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Loading...
                  </p>
                ) : expiringRiskyContracts.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No risky contracts expiring within 90 days.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {expiringRiskyContracts.map((contract) => {
                      const days = getDaysRemaining(contract.end_date);

                      return (
                        <Link
                          key={contract.id}
                          to={`/contracts/${contract.id}`}
                          className={innerPanel + " flex items-start justify-between gap-3 p-4 transition hover:bg-violet-50 dark:hover:bg-violet-500/10"}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-950 dark:text-white">
                              {contract.title}
                            </p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {formatDate(contract.end_date)}
                            </p>
                          </div>

                          <div className="text-right">
                            <Badge className={riskBadgeClass(contract.risk_level)}>
                              {formatLabel(contract.risk_level)}
                            </Badge>
                            <div className="mt-2 flex items-center justify-end gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <CalendarClock className="h-3.5 w-3.5" />
                              <span>
                                {days != null ? `${days} days left` : "—"}
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={bluePanel}>
              <CardHeader>
                <CardTitle className="text-slate-900 dark:text-white">
                  Risk summary
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {[
                  ["Total contracts", riskStats.total],
                  ["Rated contracts", riskStats.rated],
                  ["Unrated contracts", riskStats.unrated],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className={innerPanel + " flex items-center justify-between px-4 py-3"}
                  >
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {label}
                    </span>
                    <span className="text-lg font-semibold text-slate-950 dark:text-white">
                      {loading ? "—" : value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!error ? (
        <Card className={`mt-6 ${bluePanel}`}>
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">
              Risk distribution by contract type
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Distribution generated from live backend contract records.
            </p>
          </CardHeader>

          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading distribution...
              </p>
            ) : riskByType.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No contract risk data available yet.
              </p>
            ) : (
              <div className="space-y-4">
                {riskByType.map((item) => {
                  const total = item.total || 1;
                  const highPercent = (item.high / total) * 100;
                  const mediumPercent = (item.medium / total) * 100;
                  const lowPercent = (item.low / total) * 100;
                  const unratedPercent = (item.unrated / total) * 100;

                  return (
                    <div key={item.type} className={innerPanel + " p-4"}>
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-medium text-slate-950 dark:text-white">
                          {item.type}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {item.total} contract{item.total === 1 ? "" : "s"}
                        </p>
                      </div>

                      <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                        <div className="flex h-full w-full">
                          <div
                            className="h-full bg-red-400"
                            style={{ width: `${highPercent}%` }}
                          />
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${mediumPercent}%` }}
                          />
                          <div
                            className="h-full bg-green-400"
                            style={{ width: `${lowPercent}%` }}
                          />
                          <div
                            className="h-full bg-slate-300 dark:bg-white/20"
                            style={{ width: `${unratedPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-red-50 px-3 py-1 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                          High: {item.high}
                        </span>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          Medium: {item.medium}
                        </span>
                        <span className="rounded-full bg-green-50 px-3 py-1 text-green-700 dark:bg-green-500/15 dark:text-green-300">
                          Low: {item.low}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-white/10 dark:text-slate-300">
                          Unrated: {item.unrated}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {meta ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Based on {contracts.length} of {meta.total} contracts from the backend.
        </p>
      ) : null}
    </AppShell>
  );
}