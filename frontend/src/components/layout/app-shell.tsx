import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Bell,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Menu,
  Moon,
  Shield,
  Sun,
  LockKeyhole,
  Settings,
  X,
} from "lucide-react";
import { UserButton, useUser } from "@clerk/clerk-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { useRole } from "@/hooks/use-role";

type ContractGroup = {
  name: string;
  count: number;
};

type AppShellProps = {
  title: string;
  subtitle?: string;
  contractGroups?: ContractGroup[];
  actions?: React.ReactNode;
  children: React.ReactNode;
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: {
    value: "light" | "dark";
    icon: React.ElementType;
    label: string;
  }[] = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
  ];

  return (
    <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-100 p-1 shadow-sm dark:border-white/10 dark:bg-white/8">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
            theme === value
              ? "bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white"
              : "text-slate-400 hover:bg-white/60 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/8 dark:hover:text-slate-300"
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  contractGroups = [],
  actions,
  children,
}: AppShellProps) {
  const location = useLocation();
  const { user } = useUser();
  const { role, isAdmin, isAdminOrManager } = useRole();
  const [mobileOpen, setMobileOpen] = useState(false);
  void contractGroups;

  const mainNavigation = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Contracts", href: "/contracts", icon: FileText },
    { label: "Conflict Detection", href: "/conflict-detection", icon: Shield },
    { label: "Calendar", href: "/calendar", icon: CalendarDays },
    { label: "Settings", href: "/settings", icon: Settings },
    ...(isAdminOrManager ? [{ label: "Admin Panel", href: "/admin/functions", icon: LockKeyhole }] : []),
  ];

  const firstName = user?.firstName || user?.username || null;

  const DesktopNavLink = ({
    item,
    onClick,
  }: {
    item: { label: string; href: string; icon: React.ElementType };
    onClick?: () => void;
  }) => {
    const isActive =
      item.href === "/dashboard" || item.href === "/admin"
        ? location.pathname === item.href
        : location.pathname.startsWith(item.href);

    const Icon = item.icon;

    return (
      <Link
        to={item.href}
        onClick={onClick}
        title={item.label}
        aria-label={item.label}
        className="group relative flex w-full justify-center"
      >
        <div className="relative flex w-full flex-col items-center">
          {isActive && (
            <span className="absolute left-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-r-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />
          )}

          <div
            className={cn(
              "relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200",
              isActive
                ? "bg-white text-indigo-600 shadow-lg"
                : "text-white/85 hover:bg-white/14 hover:text-white"
            )}
          >
            <Icon className="h-6 w-6" />
          </div>

          <span
            className={cn(
              "mt-1.5 block max-w-[120px] text-center text-[11px] font-medium leading-tight transition-all duration-200",
              isActive
                ? "text-white"
                : "text-white/72 group-hover:text-white"
            )}
          >
            {item.label}
          </span>
        </div>
      </Link>
    );
  };

  const MobileNavLink = ({
    item,
    onClick,
  }: {
    item: { label: string; href: string; icon: React.ElementType };
    onClick?: () => void;
  }) => {
    const isActive =
      item.href === "/dashboard" || item.href === "/admin"
        ? location.pathname === item.href
        : location.pathname.startsWith(item.href);

    const Icon = item.icon;

    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={cn(
          "group flex items-center gap-3 rounded-2xl px-3.5 py-3.5 text-[13.5px] font-medium transition-all duration-200",
          isActive
            ? "bg-white/18 text-white shadow-lg"
            : "text-white/75 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const DesktopSidebarContent = () => (
    <div className="flex h-full flex-col items-center">
      <div className="pt-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/14 shadow-lg backdrop-blur-sm">
          <img src="/clause-logo.jpeg" alt="Clause" className="h-12 w-12 rounded-[20px] object-contain" />
        </div>
      </div>

      <div className="mt-4 text-center">
        <p className="text-[15px] font-semibold tracking-tight text-white">clause</p>
        <p className="mt-0.5 text-xs text-white/55">workspace</p>
      </div>

      <div className="my-4 h-px w-14 bg-white/15" />

      <nav className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-2 pb-3">
        {mainNavigation.map((item) => (
          <DesktopNavLink key={item.href} item={item} />
        ))}
      </nav>

    </div>
  );

  const MobileSidebarContent = () => (
    <>
      <div className="px-4 py-5">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
          <img src="/clause-logo.jpeg" alt="Clause" className="h-10 w-10 rounded-2xl object-contain" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-tight text-white">
              clause
            </p>
            <p className="text-[11px] leading-tight text-white/50">
              Contract workspace
            </p>
          </div>
        </div>
      </div>

      <div className="mx-4 h-px bg-white/10" />

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
            Main menu
          </p>
        </div>
        <div className="space-y-2">
          {mainNavigation.map((item) => (
            <MobileNavLink
              key={item.href}
              item={item}
              onClick={() => setMobileOpen(false)}
            />
          ))}
        </div>

      </nav>

      <div className="mx-4 mb-4 mt-2 h-px bg-white/10" />
      <div className="px-4 pb-5">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-3">
          <UserButton appearance={{ elements: { avatarBox: "h-7 w-7" } }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-white">
              {firstName ??
                user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
                "User"}
            </p>
            <p className="truncate text-[11px] capitalize text-white/45">
              {role || "member"}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#EEF1F7] dark:bg-[#0C0F1D]">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 flex h-full w-[272px] flex-col bg-gradient-to-b from-[#5E5CE6] via-[#6B64F6] to-[#7C6CFF] shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <MobileSidebarContent />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen">
        <aside className="hidden w-[220px] shrink-0 lg:flex">
          <div className="flex w-full items-center justify-center px-5 py-6">
            <div className="flex h-full min-h-[calc(100vh-48px)] w-full flex-col rounded-[34px] bg-gradient-to-b from-[#6A67F6] via-[#6B63F2] to-[#7164FF] p-3 shadow-[0_30px_60px_-30px_rgba(91,82,255,0.75)] ring-1 ring-white/30">
              <DesktopSidebarContent />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 bg-[#EEF1F7]/95 backdrop-blur-md dark:bg-[#0C0F1D]/95">
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 xl:px-6">
              <button
                onClick={() => setMobileOpen(true)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/8 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1 lg:hidden">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-white">
                  {title}
                </p>
              </div>

              <div className="hidden flex-1 lg:block" />

              <div className="flex items-center gap-2.5">
                <ThemeToggle />

                {isAdminOrManager && (() => {
                  const isAdminDashboard =
                    location.pathname === "/dashboard" &&
                    location.search.includes("view=admin");
                  const toggleTo = isAdminDashboard
                    ? "/dashboard"
                    : "/dashboard?view=admin";
                  const isActive = isAdminDashboard;
                  return (
                    <Link
                      to={toggleTo}
                      className={cn(
                        "hidden h-9 items-center gap-2 rounded-2xl border px-3.5 text-[13px] font-medium transition-all duration-200 sm:inline-flex",
                        isActive
                          ? "border-indigo-500/40 bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
                      )}
                    >
                      <LockKeyhole className="h-3.5 w-3.5" />
                      <span>{isAdminDashboard ? "Contracts" : (isAdmin ? "Admin" : "Manage")}</span>
                    </Link>
                  );
                })()}

                {isAdminOrManager && (
                  <Link
                    to="/admin/notifications"
                    className="relative flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/8 dark:text-slate-400 dark:hover:bg-white/12"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.65)]" />
                  </Link>
                )}

                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 py-1 shadow-sm dark:border-white/10 dark:bg-white/8">
                  <UserButton appearance={{ elements: { avatarBox: "h-6 w-6" } }} />
                  <span className="hidden max-w-[96px] truncate text-sm font-medium text-slate-700 dark:text-slate-300 sm:block">
                    {firstName ??
                      user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
                      "User"}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <div className="bg-[#EEF1F7] px-5 pb-5 pt-5 dark:bg-[#0C0F1D] xl:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
                </p>
                <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white md:text-3xl">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-1.5 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                    {subtitle}
                  </p>
                )}
              </div>
              {actions && (
                <div className="flex flex-wrap items-center gap-2">
                  {actions}
                </div>
              )}
            </div>
          </div>

          <main className="flex-1 bg-[#EEF1F7] px-5 py-6 dark:bg-[#0C0F1D] md:px-6">
            {children}
          </main>
        </div>
      </div>

    </div>
  );
}