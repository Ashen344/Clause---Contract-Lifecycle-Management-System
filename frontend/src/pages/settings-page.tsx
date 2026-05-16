import { useState } from "react";
import {
  CalendarClock,
  CheckCheck,
  Clock3,
  FileText,
  LayoutDashboard,
  Monitor,
  Moon,
  Palette,
  Sun,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { usePreferences } from "@/hooks/use-preferences";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const THEMES = {
  indigo:  { label: "Indigo",  from: "#4F46E5", to: "#7C3AED", light: "#EEF2FF", darkBg: "#1E1B4B", border: "#C7D2FE", darkBorder: "#4338CA", text: "#4338CA", darkText: "#A5B4FC" },
  violet:  { label: "Violet",  from: "#7C3AED", to: "#A855F7", light: "#F5F3FF", darkBg: "#1D1035", border: "#DDD6FE", darkBorder: "#6D28D9", text: "#6D28D9", darkText: "#C4B5FD" },
  blue:    { label: "Blue",    from: "#2563EB", to: "#0EA5E9", light: "#EFF6FF", darkBg: "#0F1E3D", border: "#BFDBFE", darkBorder: "#1D4ED8", text: "#1D4ED8", darkText: "#93C5FD" },
  emerald: { label: "Emerald", from: "#059669", to: "#0D9488", light: "#ECFDF5", darkBg: "#022C22", border: "#A7F3D0", darkBorder: "#047857", text: "#047857", darkText: "#6EE7B7" },
  rose:    { label: "Rose",    from: "#E11D48", to: "#EC4899", light: "#FFF1F2", darkBg: "#2D0A14", border: "#FECDD3", darkBorder: "#BE123C", text: "#BE123C", darkText: "#FDA4AF" },
  amber:   { label: "Amber",   from: "#D97706", to: "#F97316", light: "#FFFBEB", darkBg: "#271A03", border: "#FDE68A", darkBorder: "#92400E", text: "#92400E", darkText: "#FCD34D" },
} as const;

type ThemeKey = keyof typeof THEMES;


type TabId = "appearance" | "dashboard";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "dashboard",  label: "Dashboard",  icon: LayoutDashboard },
];

type FontSize = "sm" | "md" | "lg";
type RadiusStyle = "sharp" | "rounded" | "extra";

const FONT_SIZES: { value: FontSize; label: string; desc: string; preview: string }[] = [
  { value: "sm", label: "Small",   desc: "14px — compact",  preview: "text-xs" },
  { value: "md", label: "Default", desc: "16px — standard", preview: "text-sm" },
  { value: "lg", label: "Large",   desc: "18px — relaxed",  preview: "text-base" },
];

const RADIUS_STYLES: { value: RadiusStyle; label: string; desc: string; px: string }[] = [
  { value: "sharp",   label: "Sharp",   desc: "Clean edges",     px: "6px" },
  { value: "rounded", label: "Rounded", desc: "Default",         px: "12px" },
  { value: "extra",   label: "Pill",    desc: "Soft & bubbly",   px: "28px" },
];

function AppearanceTab() {
  const { prefs, setAccentColor } = usePreferences();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const currentTheme = (prefs.accent_color as ThemeKey) ?? "indigo";
  const t = THEMES[currentTheme] ?? THEMES.indigo;

  const [fontSize, setFontSizeState] = useState<FontSize>(
    () => (localStorage.getItem("clause-font-size") as FontSize) ?? "md"
  );
  const [radius, setRadiusState] = useState<RadiusStyle>(
    () => (localStorage.getItem("clause-radius") as RadiusStyle) ?? "rounded"
  );

  const applyFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem("clause-font-size", size);
    document.documentElement.dataset.fontSize = size;
  };

  const applyRadius = (r: RadiusStyle) => {
    setRadiusState(r);
    localStorage.setItem("clause-radius", r);
    document.documentElement.dataset.radius = r;
  };

  const COLOR_MODES = [
    { value: "light"  as const, label: "Light",  Icon: Sun },
    { value: "dark"   as const, label: "Dark",   Icon: Moon },
    { value: "system" as const, label: "System", Icon: Monitor },
  ];

  const cardClass = "rounded-3xl border border-slate-200 dark:border-white/8 shadow-sm";
  const sectionHeading = "text-lg font-semibold text-slate-900 dark:text-white";
  const sectionDesc = "mt-1 text-sm text-slate-500 dark:text-slate-400";

  return (
    <div className="space-y-4">
      {/* Color mode */}
      <Card className={cardClass}>
        <CardContent className="p-6">
          <div className="mb-5">
            <h2 className={sectionHeading}>Color mode</h2>
            <p className={sectionDesc}>Choose your preferred interface brightness.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {COLOR_MODES.map(({ value, label, Icon }) => {
              const isActive = theme === value;
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className="flex flex-col items-center gap-2 rounded-2xl border px-4 py-4 transition-all"
                  style={
                    isActive
                      ? { borderColor: dark ? t.darkBorder : t.border, backgroundColor: dark ? t.darkBg : t.light, boxShadow: `0 0 0 2px ${t.from}40` }
                      : { borderColor: dark ? "rgba(255,255,255,0.1)" : "#E2E8F0", backgroundColor: "transparent" }
                  }
                >
                  <Icon className="h-5 w-5" style={{ color: isActive ? (dark ? t.darkText : t.text) : (dark ? "#94A3B8" : "#64748B") }} />
                  <p className="text-sm font-semibold" style={{ color: isActive ? (dark ? t.darkText : t.text) : (dark ? "#E2E8F0" : "#1E293B") }}>
                    {label}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Accent colour */}
      <Card className={cardClass}>
        <CardContent className="p-6">
          <div className="mb-5">
            <h2 className={sectionHeading}>Accent colour</h2>
            <p className={sectionDesc}>Changes the highlight colour used throughout your dashboard.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.entries(THEMES) as [ThemeKey, typeof THEMES[ThemeKey]][]).map(([key, val]) => {
              const isActive = currentTheme === key;
              return (
                <button
                  key={key}
                  onClick={() => setAccentColor(key)}
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all"
                  style={
                    isActive
                      ? { borderColor: dark ? val.darkBorder : val.border, backgroundColor: dark ? val.darkBg : val.light, boxShadow: `0 0 0 2px ${val.from}40` }
                      : { borderColor: dark ? "rgba(255,255,255,0.1)" : "#E2E8F0", backgroundColor: "transparent" }
                  }
                >
                  <span className="h-8 w-8 shrink-0 rounded-full shadow-sm" style={{ background: `linear-gradient(135deg, ${val.from}, ${val.to})` }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: isActive ? (dark ? val.darkText : val.text) : (dark ? "#E2E8F0" : "#1E293B") }}>
                      {val.label}
                    </p>
                    {isActive && <p className="text-xs" style={{ color: dark ? val.darkText : val.text }}>Active</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Text size */}
      <Card className={cardClass}>
        <CardContent className="p-6">
          <div className="mb-5">
            <h2 className={sectionHeading}>Text size</h2>
            <p className={sectionDesc}>Scales all text across the interface.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {FONT_SIZES.map(({ value, label, desc, preview }) => {
              const isActive = fontSize === value;
              return (
                <button
                  key={value}
                  onClick={() => applyFontSize(value)}
                  className="flex flex-col items-center gap-2 rounded-2xl border px-4 py-4 transition-all"
                  style={
                    isActive
                      ? { borderColor: dark ? t.darkBorder : t.border, backgroundColor: dark ? t.darkBg : t.light, boxShadow: `0 0 0 2px ${t.from}40` }
                      : { borderColor: dark ? "rgba(255,255,255,0.1)" : "#E2E8F0", backgroundColor: "transparent" }
                  }
                >
                  <span className={`${preview} font-bold leading-none`} style={{ color: isActive ? (dark ? t.darkText : t.text) : (dark ? "#94A3B8" : "#64748B") }}>
                    Aa
                  </span>
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: isActive ? (dark ? t.darkText : t.text) : (dark ? "#E2E8F0" : "#1E293B") }}>
                      {label}
                    </p>
                    <p className="text-[11px]" style={{ color: dark ? "#64748B" : "#94A3B8" }}>{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Border radius */}
      <Card className={cardClass}>
        <CardContent className="p-6">
          <div className="mb-5">
            <h2 className={sectionHeading}>Corner style</h2>
            <p className={sectionDesc}>Controls how rounded cards and buttons appear.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {RADIUS_STYLES.map(({ value, label, desc, px }) => {
              const isActive = radius === value;
              return (
                <button
                  key={value}
                  onClick={() => applyRadius(value)}
                  className="flex flex-col items-center gap-3 rounded-2xl border px-4 py-4 transition-all"
                  style={
                    isActive
                      ? { borderColor: dark ? t.darkBorder : t.border, backgroundColor: dark ? t.darkBg : t.light, boxShadow: `0 0 0 2px ${t.from}40` }
                      : { borderColor: dark ? "rgba(255,255,255,0.1)" : "#E2E8F0", backgroundColor: "transparent" }
                  }
                >
                  <div
                    className="h-8 w-14 border-2"
                    style={{
                      borderRadius: px,
                      borderColor: isActive ? (dark ? t.darkBorder : t.border) : (dark ? "rgba(255,255,255,0.25)" : "#CBD5E1"),
                      background: isActive ? `linear-gradient(135deg, ${t.from}25, ${t.to}25)` : "transparent",
                    }}
                  />
                  <div className="text-center">
                    <p className="text-sm font-semibold" style={{ color: isActive ? (dark ? t.darkText : t.text) : (dark ? "#E2E8F0" : "#1E293B") }}>
                      {label}
                    </p>
                    <p className="text-[11px]" style={{ color: dark ? "#64748B" : "#94A3B8" }}>{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import type { DashboardSection } from "@/types/api";

const WIDGET_META_FULL = [
  { key: "total_contracts"   as const, label: "Total Contracts",   desc: "All contracts across repositories",   icon: FileText,       iconBg: "from-indigo-500 to-violet-500" },
  { key: "active_contracts"  as const, label: "Active Contracts",  desc: "Currently in-force contracts",        icon: CheckCheck,     iconBg: "from-emerald-500 to-teal-500" },
  { key: "pending_approvals" as const, label: "Pending Approvals", desc: "Awaiting stakeholder action",         icon: Clock3,         iconBg: "from-amber-500 to-orange-500" },
  { key: "high_risk"         as const, label: "High Risk Items",   desc: "Contracts needing immediate review",  icon: ShieldAlert,    iconBg: "from-rose-500 to-red-500" },
];

const SECTION_META: { key: DashboardSection; label: string; desc: string; icon: React.ElementType }[] = [
  { key: "activity_trend",   label: "Activity Trend",          desc: "30-day contract activity chart",       icon: TrendingUp },
  { key: "status_overview",  label: "Status & Risk Overview",  desc: "Status breakdown + risk donut chart",  icon: BarChart3 },
  { key: "contracts_by_type",label: "Contracts by Type",       desc: "Bar chart of contracts by category",   icon: BarChart2 },
  { key: "expiring_docs",    label: "Expiring Documents",      desc: "Contracts due within 30 days",         icon: CalendarClock },
  { key: "recent_activity",  label: "Recent Activity",         desc: "Latest contract updates and changes",  icon: Clock3 },
  { key: "risk_analysis",    label: "Risk Analysis",           desc: "Full risk breakdown and risky contracts", icon: ShieldAlert },
];

function DashboardToggleRow({
  icon: Icon, iconBg, label, desc, checked, onChange, accentFrom,
}: {
  icon: React.ElementType; iconBg?: string; label: string; desc: string;
  checked: boolean; onChange: (v: boolean) => void; accentFrom: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-slate-200 dark:border-white/8 bg-slate-50/60 dark:bg-white/4 px-4 py-3.5 transition-all hover:bg-slate-50 dark:hover:bg-white/6">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${iconBg ?? "from-slate-400 to-slate-500"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
      <div className="relative ml-2 shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
        <div className="h-6 w-11 rounded-full transition-all duration-200"
          style={{ backgroundColor: checked ? accentFrom : "rgba(203,213,225,1)" }} />
        <div className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
          style={{ left: checked ? "calc(100% - 1.25rem - 2px)" : "2px" }} />
      </div>
    </label>
  );
}

function DashboardTab() {
  const { prefs, setWidgetVisibility, setSectionVisibility, setActivityCount, setDefaultFilter } = usePreferences();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const currentTheme = (prefs.accent_color as ThemeKey) ?? "indigo";
  const t = THEMES[currentTheme] ?? THEMES.indigo;

  const cardClass = "rounded-3xl border border-slate-200 dark:border-white/8 shadow-sm";
  const heading   = "text-lg font-semibold text-slate-900 dark:text-white";
  const subtext   = "mt-1 text-sm text-slate-500 dark:text-slate-400";
  void dark;

  const FILTER_OPTIONS = [
    { value: "",                       label: "All contracts" },
    { value: "status=active",          label: "Active contracts only" },
    { value: "status=pending_approval",label: "Pending approval" },
    { value: "risk_level=high",        label: "High risk contracts" },
    { value: "expiring=30",            label: "Expiring within 30 days" },
  ];

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <Card className={cardClass}>
        <CardContent className="p-6">
          <div className="mb-5">
            <h2 className={heading}>Summary stat cards</h2>
            <p className={subtext}>Choose which metric cards appear at the top of your dashboard.</p>
          </div>
          <div className="space-y-2.5">
            {WIDGET_META_FULL.map((w) => (
              <DashboardToggleRow
                key={w.key}
                icon={w.icon}
                iconBg={w.iconBg}
                label={w.label}
                desc={w.desc}
                checked={prefs.widget_visibility[w.key] !== false}
                onChange={(v) => setWidgetVisibility(w.key, v)}
                accentFrom={t.from}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dashboard sections */}
      <Card className={cardClass}>
        <CardContent className="p-6">
          <div className="mb-5">
            <h2 className={heading}>Dashboard sections</h2>
            <p className={subtext}>Show or hide the main content sections on your dashboard.</p>
          </div>
          <div className="space-y-2.5">
            {SECTION_META.map((s) => (
              <DashboardToggleRow
                key={s.key}
                icon={s.icon}
                label={s.label}
                desc={s.desc}
                checked={prefs.section_visibility?.[s.key] !== false}
                onChange={(v) => setSectionVisibility(s.key, v)}
                accentFrom={t.from}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Display preferences */}
      <Card className={cardClass}>
        <CardContent className="p-6">
          <div className="mb-5">
            <h2 className={heading}>Display preferences</h2>
            <p className={subtext}>Control how much data is shown and the default contracts view.</p>
          </div>
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Recent activity items shown
              </label>
              <div className="flex rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden w-fit">
                {[5, 10, 20, 50].map((n) => {
                  const active = (prefs.activity_count ?? 10) === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setActivityCount(n)}
                      className="px-4 py-2 text-sm font-medium transition-colors"
                      style={active
                        ? { background: `linear-gradient(135deg,${t.from},${t.to})`, color: "#fff" }
                        : { background: "transparent", color: dark ? "#94a3b8" : "#475569" }
                      }
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Default contracts filter
              </label>
              <select
                value={prefs.default_contract_filter ?? ""}
                onChange={(e) => setDefaultFilter(e.target.value)}
                className="h-10 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-white/6 dark:text-slate-100"
              >
                {FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-400">Applied when you navigate to the Contracts page.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  const { loading } = usePreferences();
  const [activeTab, setActiveTab] = useState<TabId>("appearance");

  if (loading) {
    return (
      <AppShell title="Settings" subtitle="Manage your workspace preferences.">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading preferences...</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Settings" subtitle="Personalise your Clause workspace. All changes save automatically.">
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/8 bg-slate-100 dark:bg-white/6 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150 whitespace-nowrap",
                isActive
                  ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-white/8 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-3xl">
        {activeTab === "appearance" && <AppearanceTab />}
        {activeTab === "dashboard"  && <DashboardTab />}
      </div>
    </AppShell>
  );
}
