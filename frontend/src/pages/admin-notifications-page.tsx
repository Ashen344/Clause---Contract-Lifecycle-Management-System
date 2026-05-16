import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatLabel as fmt, statusBadgeClass as badgeClass } from "@/lib/utils";
import type { Contract } from "@/types/api";

// ─ Types ─────────────────────────────────────────────────────────────────────

type SmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  from_name: string;
  encryption: "ssl" | "starttls" | "none";
};

type SmsSettings = {
  enabled: boolean;
  provider: "twilio" | "vonage" | "aws_sns";
  account_sid: string;
  auth_token: string;
  from_number: string;
};

type TriggerSettings = {
  expiry_days: number[];
  on_approval_request: boolean;
  on_workflow_update: boolean;
  on_contract_created: boolean;
  on_contract_terminated: boolean;
  on_high_risk: boolean;
};

type RecipientSettings = {
  notify_owner: boolean;
  notify_admins: boolean;
  notify_managers: boolean;
  additional_emails: string[];
};

type NotificationSettings = {
  email: SmtpSettings;
  sms: SmsSettings;
  triggers: TriggerSettings;
  recipients: RecipientSettings;
};

const DEFAULT: NotificationSettings = {
  email: { enabled: false, host: "smtp.gmail.com", port: 465, username: "", password: "", from_name: "Clause CLM", encryption: "ssl" },
  sms: { enabled: false, provider: "twilio", account_sid: "", auth_token: "", from_number: "" },
  triggers: { expiry_days: [90, 30, 7], on_approval_request: true, on_workflow_update: true, on_contract_created: false, on_contract_terminated: true, on_high_risk: false },
  recipients: { notify_owner: true, notify_admins: false, notify_managers: false, additional_emails: [] },
};

const MASKED = "__set__";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${checked ? "bg-indigo-600" : "bg-slate-200 dark:bg-white/15"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${checked ? "left-[calc(100%-1.125rem)]" : "left-0.5"}`} />
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder = "" }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-white/10 dark:bg-white/6 dark:text-slate-100 dark:focus:border-indigo-500"
    />
  );
}

function PasswordInput({ value, onChange, placeholder = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const isSet = value === MASKED;
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={isSet ? "••••••••••••" : value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (isSet) onChange(""); }}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 dark:border-white/10 dark:bg-white/6 dark:text-slate-100 dark:focus:border-indigo-500"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function SaveRow({ section, saving, result, onSave }: {
  section: string;
  saving: boolean;
  result: { ok: boolean; msg: string } | null;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <Button size="sm" onClick={onSave} disabled={saving} className="rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
        {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        Save {section}
      </Button>
      {result && (
        <span className={`text-xs ${result.ok ? "text-green-600" : "text-red-600"}`}>
          {result.ok ? "✓" : "✗"} {result.msg}
        </span>
      )}
    </div>
  );
}

// ── Email Server Card ─────────────────────────────────────────────────────────

function EmailServerCard({ data, onChange, onSave, saving, result }: {
  data: SmtpSettings;
  onChange: (p: Partial<SmtpSettings>) => void;
  onSave: () => void;
  saving: boolean;
  result: { ok: boolean; msg: string } | null;
}) {
  const [testTo, setTestTo] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function sendTest() {
    if (!testTo.trim()) return;
    setTestLoading(true); setTestResult(null);
    try {
      await api.sendTestEmail(testTo.trim());
      setTestResult({ ok: true, msg: `Sent to ${testTo}` });
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "Failed" });
    } finally { setTestLoading(false); }
  }

  return (
    <Card className="border-slate-200 shadow-sm dark:border-white/8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-slate-500" /> Email Server (SMTP)
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>{data.enabled ? "Enabled" : "Disabled"}</span>
            <Toggle checked={data.enabled} onChange={(v) => onChange({ enabled: v })} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="SMTP host">
              <Input value={data.host} onChange={(v) => onChange({ host: v })} placeholder="smtp.gmail.com" />
            </Field>
          </div>
          <Field label="Port">
            <Input value={String(data.port)} onChange={(v) => onChange({ port: Number(v) || 465 })} placeholder="465" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Username / sender email">
            <Input value={data.username} onChange={(v) => onChange({ username: v })} placeholder="you@gmail.com" />
          </Field>
          <Field label="Password / App password">
            <PasswordInput value={data.password} onChange={(v) => onChange({ password: v })} placeholder="App password" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From name">
            <Input value={data.from_name} onChange={(v) => onChange({ from_name: v })} placeholder="Clause CLM" />
          </Field>
          <Field label="Encryption">
            <select
              value={data.encryption}
              onChange={(e) => onChange({ encryption: e.target.value as SmtpSettings["encryption"] })}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 dark:border-white/10 dark:bg-white/6 dark:text-slate-100"
            >
              <option value="ssl">SSL (port 465)</option>
              <option value="starttls">STARTTLS (port 587)</option>
              <option value="none">None (port 25)</option>
            </select>
          </Field>
        </div>

        <SaveRow section="email settings" saving={saving} result={result} onSave={onSave} />

        <div className="border-t border-slate-100 pt-4 dark:border-white/8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Send test email</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="recipient@example.com"
              className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-white/6 dark:text-slate-100"
            />
            <Button size="sm" onClick={sendTest} disabled={testLoading || !testTo.trim() || !data.enabled} className="rounded-lg">
              {testLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Send</span>
            </Button>
          </div>
          {testResult && (
            <p className={`mt-1.5 text-xs ${testResult.ok ? "text-green-600" : "text-red-600"}`}>
              {testResult.ok ? "✓" : "✗"} {testResult.msg}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── SMS Gateway Card ──────────────────────────────────────────────────────────

function SmsGatewayCard({ data, onChange, onSave, saving, result }: {
  data: SmsSettings;
  onChange: (p: Partial<SmsSettings>) => void;
  onSave: () => void;
  saving: boolean;
  result: { ok: boolean; msg: string } | null;
}) {
  const providerLabels: Record<SmsSettings["provider"], string> = {
    twilio: "Twilio",
    vonage: "Vonage (Nexmo)",
    aws_sns: "AWS SNS",
  };

  const sidLabel = data.provider === "aws_sns" ? "Access Key ID" : "Account SID / API Key";
  const tokenLabel = data.provider === "aws_sns" ? "Secret Access Key" : "Auth Token";
  const fromLabel = data.provider === "aws_sns" ? "SNS Topic / Sender ID" : "From number (+1234567890)";

  return (
    <Card className="border-slate-200 shadow-sm dark:border-white/8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-slate-500" /> SMS Gateway
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span>{data.enabled ? "Enabled" : "Disabled"}</span>
            <Toggle checked={data.enabled} onChange={(v) => onChange({ enabled: v })} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Provider">
          <select
            value={data.provider}
            onChange={(e) => onChange({ provider: e.target.value as SmsSettings["provider"] })}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-white/6 dark:text-slate-100"
          >
            {Object.entries(providerLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={sidLabel}>
            <Input value={data.account_sid} onChange={(v) => onChange({ account_sid: v })} placeholder={data.provider === "aws_sns" ? "AKIAIOSFODNN7EXAMPLE" : "ACxxxxxxxx"} />
          </Field>
          <Field label={tokenLabel}>
            <PasswordInput value={data.auth_token} onChange={(v) => onChange({ auth_token: v })} placeholder="••••••••" />
          </Field>
        </div>

        <Field label={fromLabel}>
          <Input value={data.from_number} onChange={(v) => onChange({ from_number: v })} placeholder={data.provider === "aws_sns" ? "arn:aws:sns:..." : "+15551234567"} />
        </Field>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          SMS delivery requires the corresponding SDK installed on the backend server ({data.provider === "twilio" ? "twilio" : data.provider === "vonage" ? "vonage" : "boto3"}).
        </div>

        <SaveRow section="SMS settings" saving={saving} result={result} onSave={onSave} />
      </CardContent>
    </Card>
  );
}

// ── Triggers Card ─────────────────────────────────────────────────────────────

const EXPIRY_OPTIONS = [90, 60, 30, 14, 7, 3, 1];

function TriggersCard({ data, onChange, onSave, saving, result }: {
  data: TriggerSettings;
  onChange: (p: Partial<TriggerSettings>) => void;
  onSave: () => void;
  saving: boolean;
  result: { ok: boolean; msg: string } | null;
}) {
  const toggleDay = (day: number) => {
    const days = data.expiry_days.includes(day)
      ? data.expiry_days.filter((d) => d !== day)
      : [...data.expiry_days, day].sort((a, b) => b - a);
    onChange({ expiry_days: days });
  };

  const eventToggles: { key: keyof TriggerSettings; label: string }[] = [
    { key: "on_approval_request", label: "Approval request submitted" },
    { key: "on_workflow_update", label: "Workflow stage advanced" },
    { key: "on_contract_created", label: "New contract created" },
    { key: "on_contract_terminated", label: "Contract terminated or rejected" },
    { key: "on_high_risk", label: "Contract flagged as high risk" },
  ];

  return (
    <Card className="border-slate-200 shadow-sm dark:border-white/8">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-slate-500" /> Notification Triggers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Contract expiry alerts</p>
          <div className="flex flex-wrap gap-2">
            {EXPIRY_OPTIONS.map((day) => {
              const active = data.expiry_days.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${active
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-white/10 dark:bg-white/4 dark:text-slate-400"
                    }`}
                >
                  {day === 1 ? "1 day" : `${day} days`} before
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Event triggers</p>
          <div className="space-y-2">
            {eventToggles.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-2.5 hover:bg-slate-50 dark:border-white/6 dark:bg-white/3 dark:hover:bg-white/5">
                <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                <Toggle
                  checked={data[key] as boolean}
                  onChange={(v) => onChange({ [key]: v } as Partial<TriggerSettings>)}
                />
              </label>
            ))}
          </div>
        </div>

        <SaveRow section="triggers" saving={saving} result={result} onSave={onSave} />
      </CardContent>
    </Card>
  );
}

// ── Recipients Card ───────────────────────────────────────────────────────────

function RecipientsCard({ data, onChange, onSave, saving, result }: {
  data: RecipientSettings;
  onChange: (p: Partial<RecipientSettings>) => void;
  onSave: () => void;
  saving: boolean;
  result: { ok: boolean; msg: string } | null;
}) {
  const [newEmail, setNewEmail] = useState("");

  const addEmail = () => {
    const e = newEmail.trim().toLowerCase();
    if (!e || !e.includes("@") || data.additional_emails.includes(e)) return;
    onChange({ additional_emails: [...data.additional_emails, e] });
    setNewEmail("");
  };

  const removeEmail = (e: string) =>
    onChange({ additional_emails: data.additional_emails.filter((x) => x !== e) });

  const roleToggles: { key: keyof RecipientSettings; label: string; icon: React.ElementType }[] = [
    { key: "notify_owner", label: "Contract owner / creator", icon: Users },
    { key: "notify_admins", label: "All admin users", icon: Users },
    { key: "notify_managers", label: "All manager users", icon: Users },
  ];

  return (
    <Card className="border-slate-200 shadow-sm dark:border-white/8">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-slate-500" /> Recipients
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Role-based recipients</p>
          <div className="space-y-2">
            {roleToggles.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-2.5 hover:bg-slate-50 dark:border-white/6 dark:bg-white/3 dark:hover:bg-white/5">
                <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                <Toggle
                  checked={data[key] as boolean}
                  onChange={(v) => onChange({ [key]: v } as Partial<RecipientSettings>)}
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Additional email addresses</p>
          <div className="space-y-1.5">
            {data.additional_emails.map((e) => (
              <div key={e} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-white/8 dark:bg-white/4">
                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{e}</span>
                <button onClick={() => removeEmail(e)} className="text-slate-400 hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
              placeholder="add@example.com"
              className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-white/6 dark:text-slate-100"
            />
            <Button size="sm" variant="outline" onClick={addEmail} disabled={!newEmail.trim()} className="rounded-lg px-3">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <SaveRow section="recipients" saving={saving} result={result} onSave={onSave} />
      </CardContent>
    </Card>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AdminNotificationsContent() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<Array<{ id: string; title: string; contract_type: string; days_remaining: number }>>([]);
  const [recentActivity, setRecentActivity] = useState<Array<{ id: string; title: string; status: string; workflow_stage: string; updated_at: string }>>([]);
  const [loadingMonitor, setLoadingMonitor] = useState(true);

  type SaveState = { saving: boolean; result: { ok: boolean; msg: string } | null };
  const [emailSave, setEmailSave] = useState<SaveState>({ saving: false, result: null });
  const [smsSave, setSmsSave] = useState<SaveState>({ saving: false, result: null });
  const [triggerSave, setTriggerSave] = useState<SaveState>({ saving: false, result: null });
  const [recipientSave, setRecipientSave] = useState<SaveState>({ saving: false, result: null });

  useEffect(() => {
    api.getNotificationSettings()
      .then((raw) => { setSettings({ ...DEFAULT, ...(raw as unknown as NotificationSettings) }); })
      .catch(() => { })
      .finally(() => setLoadingSettings(false));

    Promise.all([
      api.listContracts("?per_page=100").catch(() => ({ contracts: [] })),
      api.getExpiringSoon().catch(() => []),
      api.getRecentActivity().catch(() => []),
    ]).then(([contractsRes, expiring, recent]) => {
      setContracts(Array.isArray((contractsRes as { contracts?: Contract[] }).contracts) ? (contractsRes as { contracts: Contract[] }).contracts : []);
      setExpiringSoon(Array.isArray(expiring) ? expiring as typeof expiringSoon : []);
      setRecentActivity(Array.isArray(recent) ? recent as typeof recentActivity : []);
    }).finally(() => setLoadingMonitor(false));
  }, []);

  const update = <K extends keyof NotificationSettings>(section: K, patch: Partial<NotificationSettings[K]>) =>
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));

  const save = async (
    section: keyof NotificationSettings,
    setState: React.Dispatch<React.SetStateAction<SaveState>>
  ) => {
    setState({ saving: true, result: null });
    try {
      await api.saveNotificationSettings(settings as unknown as Record<string, unknown>);
      setState({ saving: false, result: { ok: true, msg: "Saved successfully" } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      const is403 = msg.toLowerCase().includes("admin") || msg.includes("403");
      setState({ saving: false, result: { ok: false, msg: is403 ? "Admin access required — use the banner above to claim admin, then retry." : msg } });
    }
  };

  const highRiskContracts = useMemo(() =>
    contracts.filter((c) => (c.risk_level || "").toLowerCase() === "high").slice(0, 6),
    [contracts]);

  if (loadingSettings) {
    return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading settings…</div>;
  }

  return (
    <div className="space-y-5">
      {/* ── Configuration ── */}
      <EmailServerCard
        data={settings.email}
        onChange={(p) => update("email", p)}
        onSave={() => save("email", setEmailSave)}
        saving={emailSave.saving}
        result={emailSave.result}
      />

      <SmsGatewayCard
        data={settings.sms}
        onChange={(p) => update("sms", p)}
        onSave={() => save("sms", setSmsSave)}
        saving={smsSave.saving}
        result={smsSave.result}
      />

      <TriggersCard
        data={settings.triggers}
        onChange={(p) => update("triggers", p)}
        onSave={() => save("triggers", setTriggerSave)}
        saving={triggerSave.saving}
        result={triggerSave.result}
      />

      <RecipientsCard
        data={settings.recipients}
        onChange={(p) => update("recipients", p)}
        onSave={() => save("recipients", setRecipientSave)}
        saving={recipientSave.saving}
        result={recipientSave.result}
      />

      {/* ── Monitoring ── */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-slate-500" /> Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMonitor ? (
              <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : expiringSoon.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
                <p className="text-sm text-slate-500">No contracts expiring soon.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {expiringSoon.map((item) => (
                  <Link key={item.id} to={`/contracts/${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-white">{item.title}</p>
                      <p className="text-xs text-slate-500">{fmt(item.contract_type)}</p>
                    </div>
                    <Badge className={`shrink-0 text-xs ${item.days_remaining <= 7 ? "bg-red-100 text-red-700" :
                        item.days_remaining <= 30 ? "bg-amber-100 text-amber-700" :
                          "bg-blue-100 text-blue-700"
                      }`}>
                      {item.days_remaining}d left
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-slate-500" /> High Risk Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMonitor ? (
              <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : highRiskContracts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
                <p className="text-sm text-slate-500">No high-risk contracts.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {highRiskContracts.map((contract) => (
                  <Link key={contract.id} to={`/contracts/${contract.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-white">{contract.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">{contract.description || "No description."}</p>
                    </div>
                    <Badge className={`shrink-0 ${badgeClass(contract.risk_level)}`}>{fmt(contract.risk_level)}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-500" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMonitor ? (
            <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map((item) => (
                <Link key={item.id} to={`/contracts/${item.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmt(item.status)} · {fmt(item.workflow_stage)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-slate-400">
                    <Bell className="h-3.5 w-3.5" />
                    <span className="text-xs">{new Date(item.updated_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminNotificationsPage() {
  return (
    <AppShell title="Notifications & Alerts" subtitle="Configure notification channels, triggers, and recipients.">
      <AdminNotificationsContent />
    </AppShell>
  );
}
