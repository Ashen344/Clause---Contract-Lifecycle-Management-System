import { useCallback, useEffect, useRef, useState } from "react";
import { Filter, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { AuditLogResponse } from "@/types/api";

function actionBadgeClass(action: string) {
  const a = action?.toLowerCase() ?? "";
  if (a.includes("delete") || a.includes("reject"))
    return "bg-red-100 text-red-700";
  if (a.includes("create")) return "bg-emerald-100 text-emerald-700";
  if (a.includes("update") || a.includes("change"))
    return "bg-amber-100 text-amber-700";
  if (a.includes("approve") || a.includes("advance"))
    return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

export function AdminAuditContent() {
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const [resourceType, setResourceType] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userId, setUserId] = useState("");

  // Keep a ref to latest filter values so loadData always reads current state
  const filtersRef = useRef({ resourceType, actionFilter, userId });
  useEffect(() => {
    filtersRef.current = { resourceType, actionFilter, userId };
  }, [resourceType, actionFilter, userId]);

  const loadData = useCallback(async (
    targetPage = page,
    filterOverrides?: { resourceType?: string; actionFilter?: string; userId?: string }
  ) => {
    const rt  = filterOverrides?.resourceType  ?? filtersRef.current.resourceType;
    const af  = filterOverrides?.actionFilter  ?? filtersRef.current.actionFilter;
    const uid = filterOverrides?.userId        ?? filtersRef.current.userId;

    setLoading(true);
    setError(null);
    try {
      const result = await api.listAuditLogs({
        resource_type: rt || undefined,
        action: af || undefined,
        user_id: uid || undefined,
        page: targetPage,
        per_page: perPage,
      });
      setData(result);
    } catch (err) {
      console.error("List audit logs failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load audit logs."
      );
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  // Load on page change
  useEffect(() => {
    loadData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => loadData(page), 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handlePerPageChange = (value: number) => {
    setPerPage(value);
    setPage(1);
  };

  const applyFilters = () => {
    if (page === 1) {
      loadData(1);
    } else {
      setPage(1);
    }
  };

  const clearFilters = () => {
    setResourceType("");
    setActionFilter("");
    setUserId("");
    // Pass empty overrides directly — avoids stale closure issue
    if (page === 1) {
      loadData(1, { resourceType: "", actionFilter: "", userId: "" });
    } else {
      setPage(1);
    }
  };

  const totalPages = data?.total_pages ?? 1;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Live · refreshes every 30s
        </span>
        <Button variant="outline" onClick={() => loadData(page)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card className="mb-4 border border-slate-200 bg-white shadow-sm dark:bg-white/5 dark:border-white/10">
        <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Filter className="h-4 w-4" />
          Filters
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              Resource type
            </label>
            <Input
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="contract, user, workflow..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              Action
            </label>
            <Input
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="create, update, delete..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
              User ID
            </label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="clerk_id"
            />
          </div>
        </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 bg-white shadow-sm dark:bg-white/5 dark:border-white/10">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between gap-4 text-sm">
            <p className="text-slate-500">
              {loading
                ? "Loading audit logs..."
                : `${data?.total ?? 0} log${(data?.total ?? 0) === 1 ? "" : "s"}`}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400">Rows per page</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden dark:border-white/10">
                {[10, 25, 50, 100].map((n) => (
                  <button
                    key={n}
                    onClick={() => handlePerPageChange(n)}
                    className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                      perPage === n
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 dark:border-white/10">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Resource</th>
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {(data?.logs ?? []).length === 0 && !loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-sm text-slate-500"
                    >
                      No audit logs found.
                    </td>
                  </tr>
                ) : null}
                {(data?.logs ?? []).map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 last:border-b-0 align-top dark:border-white/10"
                  >
                    <td className="whitespace-nowrap py-3 pr-4 text-slate-600 dark:text-slate-400">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge className={actionBadgeClass(log.action)}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                      <p>{log.resource_type}</p>
                      {log.resource_id ? (
                        <p className="text-xs text-slate-400">
                          {log.resource_id}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                      {log.user_email ?? log.user_id ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">
                      {log.details ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-sm">
              <p className="text-slate-500">
                Page {data?.page ?? page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

export default function AdminAuditPage() {
  return (
    <AppShell title="Audit Logs" subtitle="Immutable record of system activity (admin/manager only).">
      <AdminAuditContent />
    </AppShell>
  );
}
