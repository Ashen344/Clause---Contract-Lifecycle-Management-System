import { useState } from "react";
import {
  BarChart2,
  Bell,
  CheckCheck,
  Layers,
  ScrollText,
  Users,
  Workflow,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";
import { AdminUsersContent } from "./admin-users-page";
import { AdminApprovalsContent } from "./admin-approvals-page";
import { AdminAuditContent } from "./admin-audit-page";
import { AdminNotificationsContent } from "./admin-notifications-page";
import { WorkflowsContent } from "./workflows-page";
import { WorkflowTemplatesContent } from "./workflow-templates-page";
import { ReportsContent } from "./reports-page";

type TabId =
  | "users"
  | "workflows"
  | "templates"
  | "approvals"
  | "audit"
  | "notifications"
  | "reports";

const ADMIN_TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "users",         label: "Users",         icon: Users },
  { id: "workflows",     label: "Workflows",     icon: Workflow },
  { id: "templates",     label: "Templates",     icon: Layers },
  { id: "approvals",     label: "Approvals",     icon: CheckCheck },
  { id: "audit",         label: "Audit Logs",    icon: ScrollText },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "reports",       label: "Reports",       icon: BarChart2 },
];

export default function AdminFunctionsPage() {
  const { isAdminOrManager } = useRole();
  const [activeTab, setActiveTab] = useState<TabId>("users");

  if (!isAdminOrManager) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppShell
      title="Admin Panel"
      subtitle="Manage users, workflows, approvals, audit logs, and more."
    >
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/8 bg-slate-100 dark:bg-white/6 p-1">
        {ADMIN_TABS.map((tab) => {
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
                  : "text-indigo-600 dark:text-indigo-400 hover:bg-white/60 dark:hover:bg-white/8"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === "users"         && <AdminUsersContent />}
        {activeTab === "approvals"     && <AdminApprovalsContent />}
        {activeTab === "audit"         && <AdminAuditContent />}
        {activeTab === "notifications" && <AdminNotificationsContent />}
        {activeTab === "workflows"     && <WorkflowsContent adminView />}
        {activeTab === "templates"     && <WorkflowTemplatesContent />}
        {activeTab === "reports"       && <ReportsContent />}
      </div>
    </AppShell>
  );
}
