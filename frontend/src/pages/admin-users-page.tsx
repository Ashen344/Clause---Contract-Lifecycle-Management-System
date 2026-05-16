import { useEffect, useMemo, useState } from "react";
import { Search, UserX, UserCheck, User } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatLabel, formatDate } from "@/lib/utils";
import type { Contract, UserRole } from "@/types/api";

type UserRow = {
  id: string;
  clerk_id?: string;
  email?: string;
  full_name?: string;
  image_url?: string;
  role?: UserRole;
  status?: string;
  company?: string;
  created_at?: string;
};

function roleBadgeClass(role?: string | null) {
  switch ((role || "").toLowerCase()) {
    case "admin":
      return "bg-red-100 text-red-700";
    case "manager":
      return "bg-amber-100 text-amber-700";
    case "viewer":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-blue-100 text-blue-700";
  }
}

function statusBadgeClass(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-700";
    case "inactive":
    case "deactivated":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function AdminUsersContent() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [usersResponse, contractsResponse] = await Promise.all([
        api.listUsers(1, 100),
        api.listContracts("?per_page=200").catch(() => ({ contracts: [] })),
      ]);

      setUsers(Array.isArray(usersResponse?.users) ? usersResponse.users : []);
      setContracts(
        Array.isArray(contractsResponse?.contracts)
          ? contractsResponse.contracts
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load users."
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) => {
      const haystack = [
        user.full_name,
        user.email,
        user.role,
        user.company,
        user.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [users, search]);

  const changeRole = async (userId: string, role: UserRole) => {
    setBusyUserId(userId);
    setError(null);

    try {
      await api.changeUserRole(userId, role);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change role."
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const deactivate = async (userId: string) => {
    setBusyUserId(userId);
    setError(null);
    try {
      await api.deactivateUser(userId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate user.");
    } finally {
      setBusyUserId(null);
    }
  };

  const activate = async (userId: string) => {
    setBusyUserId(userId);
    setError(null);
    try {
      await api.activateUser(userId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate user.");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="border border-slate-200 bg-white shadow-sm dark:bg-white/5 dark:border-white/10">
        <CardContent className="p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or role"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>

            <p className="text-sm text-slate-500">
              {filteredUsers.length} total users
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading users...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left dark:border-white/10">
                    <th colSpan={2} className="pb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      User
                    </th>
                    <th className="pb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Role
                    </th>
                    <th className="pb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Status
                    </th>
                    <th className="pb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Joined
                    </th>
                    <th className="pb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => {
                    const initials = (user.full_name || user.email || "?")
                      .split(" ")
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase() ?? "")
                      .join("");

                    return (
                    <tr
                      key={user.id}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors dark:border-white/10 dark:hover:bg-white/5"
                    >
                      {/* Identity: avatar + name + email */}
                      <td className="py-4 pr-4" colSpan={2}>
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          {user.image_url ? (
                            <img
                              src={user.image_url}
                              alt={user.full_name || "avatar"}
                              className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 ring-2 ring-slate-100">
                              {initials || <User className="h-4 w-4" />}
                            </div>
                          )}
                          {/* Name + email stacked */}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {user.full_name || <span className="italic text-slate-400 font-normal">No name</span>}
                            </p>
                            <p className="text-sm text-slate-500 truncate">
                              {user.email || "—"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 pr-4">
                        <Badge className={`${roleBadgeClass(user.role)} capitalize`}>
                          {user.role || "user"}
                        </Badge>
                      </td>

                      <td className="py-4 pr-4">
                        <Badge className={statusBadgeClass(user.status)}>
                          {formatLabel(user.status) || "Unknown"}
                        </Badge>
                      </td>

                      <td className="py-4 pr-4 text-sm text-slate-600 dark:text-slate-400">
                        {formatDate(user.created_at)}
                      </td>

                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role || "user"}
                            onChange={(e) =>
                              changeRole(user.id, e.target.value as UserRole)
                            }
                            disabled={busyUserId === user.id}
                            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400 disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="user">User</option>
                            <option value="viewer">Viewer</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>

                          {(user.status || "active").toLowerCase() === "inactive" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => activate(user.id)}
                              disabled={busyUserId === user.id}
                              className="rounded-xl text-green-700 border-green-200 hover:bg-green-50"
                            >
                              <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                              Activate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deactivate(user.id)}
                              disabled={busyUserId === user.id}
                              className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <UserX className="mr-1.5 h-3.5 w-3.5" />
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-sm text-slate-500"
                      >
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <AppShell title="User Management" subtitle="Modify user roles and deactivate accounts (admin only).">
      <AdminUsersContent />
    </AppShell>
  );
}