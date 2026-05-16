import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Clock3, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatLabel } from "@/lib/utils";
import type { Contract } from "@/types/api";

type ApprovalItem = {
  id: string;
  contractId: string;
  contractTitle: string;
  approver?: string;
  status?: string;
  createdAt?: string;
};

function badgeClass(value?: string | null) {
  switch ((value || "").toLowerCase()) {
    case "approved":
    case "accepted":
    case "completed":
      return "bg-green-100 text-green-700";
    case "rejected":
    case "declined":
      return "bg-red-100 text-red-700";
    case "pending":
    default:
      return "bg-amber-100 text-amber-700";
  }
}

export function AdminApprovalsContent() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadApprovals = async () => {
    setLoading(true);
    setError(null);

    try {
      const contractsRes = await api.listContracts("?per_page=100");
      const contractList = Array.isArray(contractsRes?.contracts)
        ? contractsRes.contracts
        : [];

      setContracts(contractList);

      const approvalResults = await Promise.all(
        contractList.map(async (contract) => {
          try {
            const res = await api.getApprovalsByContract(contract.id);
            const items = Array.isArray((res as any)?.approvals)
              ? (res as any).approvals
              : Array.isArray(res)
              ? res
              : [];

            return items.map((item: any, index: number) => ({
              id: item.id || `${contract.id}-${index}`,
              contractId: contract.id,
              contractTitle: contract.title,
              approver:
                item.approver_name || item.approver || item.name || "Approver",
              status: item.status || "pending",
              createdAt: item.created_at || item.updated_at || "",
            }));
          } catch {
            return [];
          }
        })
      );

      setApprovals(approvalResults.flat());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load approvals."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
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

  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    approvals.forEach((item) => {
      const status = (item.status || "").toLowerCase();
      if (status === "approved" || status === "accepted" || status === "completed") {
        approved += 1;
      } else if (status === "rejected" || status === "declined") {
        rejected += 1;
      } else {
        pending += 1;
      }
    });

    return {
      total: approvals.length,
      pending,
      approved,
      rejected,
    };
  }, [approvals]);

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-slate-200 bg-white shadow-sm dark:bg-white/5 dark:border-white/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pending</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                  {loading ? "—" : stats.pending}
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3 text-amber-600 dark:bg-amber-500/20">
                <Clock3 className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm dark:bg-white/5 dark:border-white/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Approved</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                  {loading ? "—" : stats.approved}
                </p>
              </div>
              <div className="rounded-2xl bg-green-50 p-3 text-green-600 dark:bg-green-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm dark:bg-white/5 dark:border-white/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Approvals</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
                  {loading ? "—" : stats.total}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-600 dark:bg-white/10 dark:text-slate-300">
                <CheckCheck className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 border border-slate-200 bg-white shadow-sm dark:bg-white/5 dark:border-white/10">
        <CardHeader>
          <CardTitle>Approval Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading approvals...</p>
          ) : approvals.length === 0 ? (
            <p className="text-sm text-slate-500">No approvals found.</p>
          ) : (
            <div className="space-y-3">
              {approvals.map((item) => (
                <Link
                  key={item.id}
                  to={`/contracts/${item.contractId}`}
                  className="block rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium text-slate-950 dark:text-white">
                        {item.contractTitle}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Approver: {item.approver || "Unknown"}
                      </p>
                    </div>

                    <Badge className={badgeClass(item.status)}>
                      {formatLabel(item.status)}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function AdminApprovalsPage() {
  return (
    <AppShell title="Admin Approvals" subtitle="Review approval activity across all backend contracts.">
      <AdminApprovalsContent />
    </AppShell>
  );
}