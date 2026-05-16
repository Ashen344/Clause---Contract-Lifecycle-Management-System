import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unlink,
  Calendar,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { AppCard } from "@/components/ui/app-card";
import { AppBadge } from "@/components/ui/app-badge";
import { AppEmptyState } from "@/components/ui/app-empty-state";
import { api } from "@/lib/api";
import { formatLabel } from "@/lib/utils";

type ContractEvent = {
  id: string;
  contract_id: string;
  title: string;
  date: string;
  kind: "start" | "expiry";
  contract_type: string;
};

type GCalEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  html_link: string;
};

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function getDaysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const then = new Date(dateStr + "T00:00:00");
  return Math.ceil((then.getTime() - now.getTime()) / 86_400_000);
}


function kindColor(kind: "start" | "expiry") {
  return kind === "start" ? "bg-green-500" : "bg-red-500";
}

function kindBg(kind: "start" | "expiry") {
  return kind === "start"
    ? "border-green-200 bg-green-50 text-green-800 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300"
    : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300";
}

function CalendarGrid({
  year,
  month,
  events,
  onDayClick,
  selectedDay,
}: {
  year: number;
  month: number;
  events: ContractEvent[];
  onDayClick: (day: string) => void;
  selectedDay: string | null;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysCount = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const byDay = useMemo(() => {
    const map = new Map<string, ContractEvent[]>();
    events.forEach((e) => {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    });
    return map;
  }, [events]);

  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysCount; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      d
    ).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-violet-100 bg-violet-100 dark:border-violet-500/20 dark:bg-violet-500/20">
        {cells.map((cell, i) => {
          if (!cell.dateStr) {
            return (
              <div
                key={`empty-${i}`}
                className="h-16 bg-white/70 dark:bg-white/5"
              />
            );
          }

          const dayEvents = byDay.get(cell.dateStr) || [];
          const isToday = cell.dateStr === today;
          const isSelected = cell.dateStr === selectedDay;

          return (
            <button
              key={cell.dateStr}
              onClick={() => onDayClick(cell.dateStr!)}
              className={`relative flex h-16 flex-col items-center gap-1 bg-white/80 pt-2 transition-all hover:bg-violet-50 dark:bg-white/5 dark:hover:bg-violet-500/10
                ${isToday ? "ring-2 ring-inset ring-violet-400" : ""}
                ${isSelected ? "bg-violet-100 dark:bg-violet-500/20" : ""}
              `}
            >
              <span
                className={`text-sm font-semibold leading-none ${
                  isToday
                    ? "text-violet-700 dark:text-violet-300"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                {cell.day}
              </span>

              <div className="flex flex-wrap justify-center gap-0.5 px-1">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    className={`h-1.5 w-1.5 rounded-full ${kindColor(
                      ev.kind
                    )}`}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [searchParams] = useSearchParams();

  const [contractEvents, setContractEvents] = useState<ContractEvent[]>([]);
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected === "true") {
      setToast("Google Calendar connected!");
      setTimeout(() => setToast(null), 4000);
    } else if (connected === "false") {
      setError("Google Calendar connection failed. Please try again.");
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [datesRes, statusRes] = await Promise.all([
        api.getContractDates(),
        api.getCalendarStatus().catch(() => ({ connected: false })),
      ]);
      setContractEvents(datesRes.events || []);
      setGcalConnected(statusRes.connected);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load calendar data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!gcalConnected) {
      setGcalEvents([]);
      return;
    }

    setGcalLoading(true);
    api
      .getCalendarEvents(30)
      .then((r) => setGcalEvents(r.events || []))
      .catch(() => setGcalEvents([]))
      .finally(() => setGcalLoading(false));
  }, [gcalConnected]);

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  async function handleConnect() {
    try {
      const res = await api.getCalendarAuthUrl();
      window.location.href = res.auth_url;
    } catch {
      setError("Failed to start Google Calendar connection.");
    }
  }

  async function handleSyncAll() {
    setSyncLoading(true);
    try {
      const res = await api.syncAllToCalendar();
      setToast(`Synced ${res.synced} contracts to Google Calendar!`);
      setTimeout(() => setToast(null), 4000);

      const r = await api.getCalendarEvents(30);
      setGcalEvents(r.events || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Google Calendar? Contract dates will no longer sync."))
      return;

    try {
      await api.disconnectCalendar();
      setGcalConnected(false);
      setGcalEvents([]);
      setToast("Google Calendar disconnected.");
      setTimeout(() => setToast(null), 3000);
    } catch {
      setError("Failed to disconnect.");
    }
  }

  const selectedDayEvents = selectedDay
    ? contractEvents.filter((e) => e.date === selectedDay)
    : [];

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    return contractEvents
      .filter((e) => e.date >= today && e.date <= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [contractEvents]);

  const expiringThisMonth = contractEvents.filter((e) => {
    if (e.kind !== "expiry") return false;
    const d = getDaysUntil(e.date);
    return d >= 0 && d <= 30;
  }).length;

  const contractGroups = useMemo(() => {
    const counts = new Map<string, number>();
    contractEvents.forEach((e) => {
      const t = e.contract_type || "other";
      counts.set(t, (counts.get(t) || 0) + 1);
    });

    return Array.from(counts.entries()).map(([name, count]) => ({
      name: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    }));
  }, [contractEvents]);

  return (
    <AppShell
      title="Calendar"
      subtitle="Contract dates, deadlines, and Google Calendar sync."
      contractGroups={contractGroups}
    >
      {toast && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4" />
          {toast}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
          <button className="ml-3 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-violet-100 bg-violet-50 dark:border-violet-500/20 dark:bg-violet-500/10 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/80 dark:bg-white/10 p-2.5 shadow-sm">
              <CalendarDays className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Total Events</p>
              <p className="mt-0.5 text-2xl font-bold text-violet-700 dark:text-violet-300">
                {loading ? "—" : contractEvents.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/80 dark:bg-white/10 p-2.5 shadow-sm">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Upcoming (30d)</p>
              <p className="mt-0.5 text-2xl font-bold text-blue-700 dark:text-blue-300">
                {loading ? "—" : upcoming.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-rose-100 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-white/80 dark:bg-white/10 p-2.5 shadow-sm">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Expiring (30d)</p>
              <p className="mt-0.5 text-2xl font-bold text-rose-700 dark:text-rose-300">
                {loading ? "—" : expiringThisMonth}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <AppCard tone="soft">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {monthLabel}
                </h2>

                <div className="mt-2 flex gap-4">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    Start date
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    Expiry date
                  </span>
                </div>
              </div>

              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-slate-200 px-2 dark:border-white/10"
                  onClick={prevMonth}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-slate-200 px-2 dark:border-white/10"
                  onClick={nextMonth}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-slate-200 px-3 dark:border-white/10"
                  onClick={() => {
                    setYear(now.getFullYear());
                    setMonth(now.getMonth());
                  }}
                >
                  Today
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <CalendarGrid
                year={year}
                month={month}
                events={contractEvents}
                onDayClick={setSelectedDay}
                selectedDay={selectedDay}
              />
            )}
          </AppCard>

          {selectedDay && (
            <AppCard tone="soft">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {fmtDate(selectedDay)}
                </h2>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              </div>

              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No contract events on this day.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((ev) => (
                    <Link
                      key={ev.id}
                      to={`/contracts/${ev.contract_id}`}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-opacity hover:opacity-80 ${kindBg(
                        ev.kind
                      )}`}
                    >
                      <div>
                        <p className="text-sm font-semibold">{ev.title}</p>
                        <p className="text-xs opacity-70">
                          {ev.kind === "start"
                            ? "Contract Start"
                            : "Contract Expiry"}
                        </p>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    </Link>
                  ))}
                </div>
              )}
            </AppCard>
          )}
        </div>

        <div className="space-y-5">
          <AppCard tone="soft">
            <div className="mb-5 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-violet-500" />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Google Calendar
              </h2>
            </div>

            <div className="space-y-4">
              {gcalConnected ? (
                <>
                  <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 dark:border-green-500/20 dark:bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-300" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      Connected
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Contract dates are synced to your Google Calendar with email
                    reminders.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl"
                      onClick={handleSyncAll}
                      disabled={syncLoading}
                    >
                      {syncLoading ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Syncing…
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Sync All Contracts
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:text-red-300 dark:hover:bg-red-500/10"
                      onClick={handleDisconnect}
                    >
                      <Unlink className="mr-1.5 h-3.5 w-3.5" />
                      Disconnect
                    </Button>
                  </div>

                  {gcalLoading ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading calendar…
                    </div>
                  ) : (
                    gcalEvents.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Your Google Calendar
                        </p>
                        <div className="max-h-48 space-y-1.5 overflow-y-auto">
                          {gcalEvents.map((ev) => (
                            <a
                              key={ev.id}
                              href={ev.html_link}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-2 rounded-xl border border-violet-100 bg-white/70 px-3 py-2 transition-colors hover:bg-violet-50 dark:border-violet-500/20 dark:bg-white/5 dark:hover:bg-violet-500/10"
                            >
                              <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                                {ev.summary}
                              </p>
                              <div className="flex shrink-0 items-center gap-1">
                                <span className="text-[10px] text-slate-400">
                                  {String(ev.start).slice(0, 10)}
                                </span>
                                <ExternalLink className="h-3 w-3 text-slate-400" />
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Connect Google Calendar to automatically add contract start
                    dates, expiry deadlines, and receive email reminders.
                  </p>

                  <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                    {[
                      "Contract start & end dates added automatically",
                      "Email reminder 7 days before expiry",
                      "Popup reminder 1 day before expiry",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Button className="w-full rounded-xl" onClick={handleConnect}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Connect Google Calendar
                  </Button>
                </>
              )}
            </div>
          </AppCard>

          <AppCard tone="soft">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Upcoming Events
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Contract milestones within the next 30 days.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : upcoming.length === 0 ? (
              <AppEmptyState title="No contract events in the next 30 days." />
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {upcoming.map((ev) => {
                  const days = getDaysUntil(ev.date);

                  return (
                    <Link
                      key={ev.id}
                      to={`/contracts/${ev.contract_id}`}
                      className="flex items-center gap-3 rounded-xl border border-violet-100 bg-white/70 px-3 py-2.5 transition-colors hover:bg-violet-50 dark:border-violet-500/20 dark:bg-white/5 dark:hover:bg-violet-500/10"
                    >
                      <div
                        className={`h-8 w-1 shrink-0 rounded-full ${kindColor(
                          ev.kind
                        )}`}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-white">
                          {ev.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {ev.kind === "start" ? "Starts" : "Expires"}{" "}
                          {fmtDate(ev.date)}
                        </p>
                      </div>

                      <AppBadge
                        variant={
                          days <= 7 ? "rose" : days <= 30 ? "amber" : "slate"
                        }
                        className="shrink-0 text-[10px]"
                      >
                        {days === 0
                          ? "Today"
                          : days === 1
                          ? "Tomorrow"
                          : `${days}d`}
                      </AppBadge>
                    </Link>
                  );
                })}
              </div>
            )}
          </AppCard>
        </div>
      </div>
    </AppShell>
  );
}