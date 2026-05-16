import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import {
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  RedirectToSignIn,
} from "@clerk/clerk-react";
import LandingPage from "./pages/landing-page";
import DashboardPage from "./pages/dashboard-page";
import CalendarPage from "./pages/calendar-page";
import ContractsPage from "./pages/contracts-page";
import ContractTemplatePage from "./pages/contract-template-page";
import CreateContractPage from "./pages/create-contract-page";
import ContractDetailsPage from "./pages/contract-details-page";
import ConflictDetectionPage from "./pages/conflict-detection-page";
import AdminOverviewPage from "./pages/admin-overview-page";
import AdminUsersPage from "./pages/admin-users-page";
import AdminAuditPage from "./pages/admin-audit-page";
import AdminApprovalsPage from "./pages/admin-approvals-page";
import AdminNotificationsPage from "./pages/admin-notifications-page";
import ReportsPage from "./pages/reports-page";
import WorkflowsPage from "./pages/workflows-page";
import WorkflowDetailPage from "./pages/workflow-detail-page";
import WorkflowTemplatesPage from "./pages/workflow-templates-page";
import SettingsPage from "./pages/settings-page";
import AdminFunctionsPage from "./pages/admin-functions-page";
import { AuthBridge } from "./components/auth-bridge";
import { ThemeProvider } from "./components/theme-provider";
import { ChatPopup } from "./components/chat-popup";
import { useRole } from "./hooks/use-role";

function DashboardRouter() {
  const { isAdmin } = useRole();
  const [searchParams] = useSearchParams();
  const showAdminView = isAdmin && searchParams.get("view") === "admin";
  return showAdminView ? <AdminOverviewPage /> : <DashboardPage />;
}

const AUTH_FEATURES = [
  { text: "Centralise all your contracts in one place" },
  { text: "Automated approval workflows and e-signatures" },
  { text: "Risk analysis and clause-level review" },
  { text: "Expiry alerts and renewal tracking" },
];

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      {/* Left branding panel */}
      <div className="relative hidden lg:flex lg:w-[48%] flex-col justify-between overflow-hidden bg-[#0F172A] p-14 text-white">
        {/* Subtle grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Thin top border accent */}
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-slate-500/40 to-transparent" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/8">
            <span className="text-base font-bold tracking-tight text-white">C</span>
          </div>
          <span className="text-[17px] font-semibold tracking-tight text-white">Clause</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-8">
          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Contract LifeCycle Management Platform
            </p>
            <h1 className="text-[2.4rem] font-bold leading-[1.15] tracking-tight text-white">
              Every contract,
              <br />
              under control.
            </h1>
            <p className="mt-5 max-w-[340px] text-[15px] leading-relaxed text-slate-400">
              Clause gives your team a single place to draft, approve, track,
              and renew contracts — with full audit history.
            </p>
          </div>

          <ul className="space-y-3.5">
            {AUTH_FEATURES.map((f) => (
              <li key={f.text} className="flex items-start gap-3">
                <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-slate-600 bg-slate-800">
                  <svg
                    className="h-2.5 w-2.5 text-slate-300"
                    viewBox="0 0 10 8"
                    fill="none"
                  >
                    <path
                      d="M1 4l2.5 2.5L9 1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="text-[13.5px] leading-snug text-slate-400">{f.text}</span>
              </li>
            ))}
          </ul>

          {/* Stats strip */}
          <div className="flex gap-8 border-t border-white/8 pt-6">
            <div>
              <p className="text-xl font-bold text-white">100%</p>
              <p className="mt-0.5 text-xs text-slate-500">Audit trail</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">Real-time</p>
              <p className="mt-0.5 text-xs text-slate-500">Status tracking</p>
            </div>
            <div>
              <p className="text-xl font-bold text-white">Secure</p>
              <p className="mt-0.5 text-xs text-slate-500">Role-based access</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-[11px] text-slate-600">
            © {new Date().getFullYear()} Clause. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12">
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
            <span className="text-base font-bold text-white">C</span>
          </div>
          <span className="text-lg font-semibold text-slate-800">Clause</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          <Route
            path="/sign-in/*"
            element={
              <AuthLayout>
                <SignIn
                  routing="path"
                  path="/sign-in"
                  signUpUrl="/sign-up"
                  fallbackRedirectUrl="/dashboard"
                />
              </AuthLayout>
            }
          />

          <Route
            path="/sign-up/*"
            element={
              <AuthLayout>
                <SignUp
                  routing="path"
                  path="/sign-up"
                  signInUrl="/sign-in"
                  fallbackRedirectUrl="/dashboard"
                />
              </AuthLayout>
            }
          />

          <Route
            path="/*"
            element={
              <>
                <SignedIn>
                  <AuthBridge />
                  <ChatPopup />
                  <Routes>
                    <Route path="/dashboard" element={<DashboardRouter />} />
                    <Route path="/contracts" element={<ContractsPage />} />
                    <Route path="/contracts/new" element={<ContractTemplatePage />} />
                    <Route path="/contracts/create" element={<CreateContractPage />} />
                    <Route path="/contracts/:id" element={<ContractDetailsPage />} />
                    <Route path="/conflict-detection" element={<ConflictDetectionPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/workflows" element={<WorkflowsPage />} />
                    <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
                    <Route path="/admin" element={<AdminOverviewPage />} />
                    <Route path="/admin/users" element={<AdminUsersPage />} />
                    <Route path="/admin/approvals" element={<AdminApprovalsPage />} />
                    <Route path="/admin/audit" element={<AdminAuditPage />} />
                    <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
                    <Route path="/admin/reports" element={<ReportsPage />} />
                    <Route path="/admin/workflows" element={<WorkflowsPage />} />
                    <Route path="/admin/workflows/:id" element={<WorkflowDetailPage />} />
                    <Route path="/admin/workflow-templates" element={<WorkflowTemplatesPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/admin/functions" element={<AdminFunctionsPage />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </SignedIn>

                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
