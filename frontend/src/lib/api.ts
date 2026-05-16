import type {
  AdminRecentUser,
  AdminStats,
  AdminUserActivity,
  AiAnalysisResponse,
  AiChatResponse,
  ApprovalListResponse,
  ApprovalStat,
  AuditLogResponse,
  ConflictResult,
  Contract,
  ContractsByStage,
  ContractsResponse,
  DashboardStats,
  DraftResponse,
  LifecycleStats,
  ReportDefinition,
  ReportPreset,
  ReportResult,
  Template,
  TemplatesResponse,
  UserPreferences,
  UserRole,
  UsersListResponse,
  ValueByType,
  Workflow,
  WorkflowTemplate,
} from "../types/api";

const API_BASE_URL =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env
    ?.VITE_API_BASE_URL ?? "http://localhost:8000";

class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestPayload = {
  question: string;
  contract_id?: string | null;
  history?: ChatHistoryMessage[];
  mode?: string;
};

function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem("clause_auth_token");
  } catch {
    return null;
  }
}

let tokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(
  provider: (() => Promise<string | null>) | null
) {
  tokenProvider = provider;
}

async function resolveToken(): Promise<string | null> {
  if (tokenProvider) {
    try {
      const token = await tokenProvider();
      if (token) return token;
    } catch {
      // Fall through to stored token
    }
  }

  return getStoredAuthToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await resolveToken();

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string> | undefined) || {}),
  };

  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "detail" in data
        ? String((data as { detail?: string }).detail)
        : `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export function buildContractsQuery(
  params: Record<string, string | number | undefined | null>
) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });

  const suffix = search.toString();
  return suffix ? `?${suffix}` : "";
}

export const api = {
  health: () => request<{ status: string; database: string }>("/health"),

  syncUser: (profile?: { full_name?: string; email?: string }) =>
    request<{
      id?: string;
      email?: string;
      full_name?: string;
      role?: string;
      status?: string;
    }>("/api/auth/sync", {
      method: "POST",
      body: profile ? JSON.stringify(profile) : undefined,
    }),

  getMyProfile: () =>
    request<{
      id?: string;
      email?: string;
      full_name?: string;
      role?: string;
      status?: string;
    }>("/api/auth/me"),

  getDashboardStats: () => request<DashboardStats>("/api/dashboard/stats"),

  getContractsByType: () =>
    request<Array<{ type: string; count: number }>>(
      "/api/dashboard/contracts-by-type"
    ),

  getContractsByStatus: () =>
    request<Array<{ status: string; count: number }>>(
      "/api/dashboard/contracts-by-status"
    ),

  getExpiringSoon: () =>
    request<
      Array<{
        id: string;
        title: string;
        contract_type: string;
        end_date: string;
        days_remaining: number;
      }>
    >("/api/dashboard/expiring-soon"),

  getRecentActivity: () =>
    request<
      Array<{
        id: string;
        title: string;
        status: string;
        workflow_stage: string;
        updated_at: string;
      }>
    >("/api/dashboard/recent-activity"),

  listContracts: (query = "") =>
    request<ContractsResponse>(`/api/contracts/${query}`),

  getContract: (id: string) => request<Contract>(`/api/contracts/${id}`),

  createContract: (payload: Record<string, unknown>) =>
    request<Contract>("/api/contracts/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateContract: (id: string, payload: Record<string, unknown>) =>
    request<Contract>(`/api/contracts/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteContract: (id: string) =>
    request<{ message: string }>(`/api/contracts/${id}`, {
      method: "DELETE",
    }),

  permanentDeleteContract: (id: string) =>
    request<{ message: string }>(`/api/contracts/${id}/permanent`, {
      method: "DELETE",
    }),

  restoreContract: (id: string) =>
    request<Contract>(`/api/contracts/${id}/restore`, { method: "PATCH" }),

  archiveContract: (id: string) =>
    request<Contract>(`/api/contracts/${id}/archive`, { method: "PATCH" }),

  unarchiveContract: (id: string) =>
    request<Contract>(`/api/contracts/${id}/unarchive`, { method: "PATCH" }),

  uploadContract: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    return request<{
      id?: string;
      contract?: Contract;
      message?: string;
      extracted_text?: string;
    }>("/api/contracts/upload", {
      method: "POST",
      body: formData,
    });
  },

  listTemplates: (query = "") =>
    request<TemplatesResponse>(`/api/templates/${query}`),

  getTemplate: (id: string) => request<Template>(`/api/templates/${id}`),

  createWorkflow: (payload: Record<string, unknown>) =>
    request<Workflow>("/api/workflows/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAllWorkflows: () =>
    request<{ workflows: Workflow[] }>("/api/workflows/list"),

  getWorkflow: (id: string) => request<Workflow>(`/api/workflows/${id}`),

  getContractWorkflows: (contractId: string) =>
    request<{ workflows: Workflow[] }>(`/api/workflows/contract/${contractId}`),

  advanceWorkflow: (id: string, comments?: string) =>
    request<Workflow>(`/api/workflows/${id}/advance`, {
      method: "POST",
      body: JSON.stringify({ comments }),
    }),

  rejectWorkflow: (id: string, reason?: string) =>
    request<Workflow>(`/api/workflows/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  pauseWorkflow: (id: string, reason?: string) =>
    request<Workflow>(`/api/workflows/${id}/pause`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  resumeWorkflow: (id: string) =>
    request<Workflow>(`/api/workflows/${id}/resume`, { method: "POST" }),

  getApprovalsByContract: (contractId: string) =>
    request<ApprovalListResponse>(`/api/approvals/contract/${contractId}`),

  createApproval: (payload: {
    contract_id: string;
    workflow_id?: string;
    approval_type: string;
    approver_ids: string[];
  }) =>
    request<unknown>("/api/approvals/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  castVote: (approvalId: string, decision: string, comments?: string) =>
    request<unknown>(`/api/approvals/${approvalId}/vote`, {
      method: "POST",
      body: JSON.stringify({ decision, comments: comments || null }),
    }),

  getDocumentText: (contractId: string) =>
    request<{ text: string; file_type: string; has_file: boolean }>(
      `/api/documents/text/${contractId}`
    ),

  getWopiUrl: (contractId: string) =>
    request<{ editor_url: string; file_type: string; filename: string }>(
      `/api/documents/wopi-url/${contractId}`
    ),

  generateDocumentFromTemplate: (contractId: string) =>
    request<{ message: string; version: number; filename: string; file_type: string }>(
      `/api/documents/generate-from-template/${contractId}`,
      { method: "POST" }
    ),

  saveDocumentText: (contractId: string, text: string) =>
    request<{ message: string; version?: number; file_type?: string }>(
      `/api/documents/text/${contractId}`,
      { method: "PUT", body: JSON.stringify({ text }) }
    ),

  // Rich-text (TipTap HTML) editor endpoints
  getDocumentHtml: (contractId: string) =>
    request<{ html: string; title: string }>(`/api/documents/html/${contractId}`),

  saveDocumentHtml: (contractId: string, html: string, title?: string) =>
    request<{ message: string }>(`/api/documents/html/${contractId}`, {
      method: "PUT",
      body: JSON.stringify({ html, title: title ?? "Contract" }),
    }),



  scanContractConflicts: (contractId: string) =>
    request<ConflictResult>(`/api/ai/conflicts/scan/${contractId}`, {
      method: "POST",
    }),

  analyzeText: (text: string) =>
    request<AiAnalysisResponse>("/api/ai/analyze/text", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  analyzeContract: (contractId: string) =>
    request<AiAnalysisResponse>(`/api/ai/analyze/${contractId}`, {
      method: "POST",
    }),

  generateDraft: (payload: Record<string, unknown>) =>
    request<DraftResponse>("/api/ai/generate-draft", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  detectConflicts: (contractIds: string[]) =>
    request<ConflictResult>("/api/ai/conflicts", {
      method: "POST",
      body: JSON.stringify({ contract_ids: contractIds }),
    }),

  scanForDuplicates: (contractId: string) =>
    request<ConflictResult>(`/api/ai/conflicts/scan/${contractId}`, { method: "POST" }),

  addVersion: (contractId: string, fromContractId: string, changeNotes: string) =>
    request<{ message: string; version_number: number; contract_id: string }>(
      `/api/contracts/${contractId}/add-version`,
      { method: "POST", body: JSON.stringify({ from_contract_id: fromContractId, change_notes: changeNotes }) }
    ),

  chat: (
    questionOrPayload: string | ChatRequestPayload,
    contractId?: string,
    history?: ChatHistoryMessage[],
    mode = "general"
  ) => {
    const payload: ChatRequestPayload =
      typeof questionOrPayload === "string"
        ? {
            question: questionOrPayload,
            contract_id: contractId || null,
            history: history || [],
            mode,
          }
        : {
            question: questionOrPayload.question,
            contract_id: questionOrPayload.contract_id ?? null,
            history: questionOrPayload.history || [],
            mode: questionOrPayload.mode || "general",
          };

    return request<AiChatResponse>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  chatWithFile: (question: string, file: File) => {
    const form = new FormData();
    form.append("question", question);
    form.append("file", file);
    return request<AiChatResponse>("/api/ai/chat-file", {
      method: "POST",
      body: form,
    });
  },

  getAdminStats: () => request<AdminStats>("/api/admin/stats"),

  getAdminUserActivity: () =>
    request<AdminUserActivity[]>("/api/admin/user-activity"),

  getAdminContractsByStage: () =>
    request<ContractsByStage[]>("/api/admin/contracts-by-stage"),

  getAdminValueByType: () =>
    request<ValueByType[]>("/api/admin/value-by-type"),

  getAdminApprovalStats: () =>
    request<ApprovalStat[]>("/api/admin/approval-stats"),

  getAdminRecentUsers: () =>
    request<AdminRecentUser[]>("/api/admin/recent-users"),

  listUsers: (page = 1, perPage = 20) =>
    request<UsersListResponse>(
      `/api/auth/users?page=${page}&per_page=${perPage}`
    ),

  changeUserRole: (userId: string, role: UserRole) =>
    request<unknown>(
      `/api/auth/users/${userId}/role?role=${encodeURIComponent(role)}`,
      { method: "PATCH" }
    ),

  deactivateUser: (userId: string) =>
    request<unknown>(`/api/auth/users/${userId}/deactivate`, {
      method: "PATCH",
    }),

  activateUser: (userId: string) =>
    request<unknown>(`/api/auth/users/${userId}/activate`, {
      method: "PATCH",
    }),

  // ── Calendar ──────────────────────────────────────────────────────────────
  getCalendarStatus: () =>
    request<{ connected: boolean; connected_at?: string }>("/api/calendar/status"),

  getCalendarAuthUrl: () =>
    request<{ auth_url: string }>("/api/calendar/auth"),

  getContractDates: () =>
    request<{ events: Array<{ id: string; contract_id: string; title: string; date: string; kind: "start" | "expiry"; contract_type: string }>; count: number }>("/api/calendar/contract-dates"),

  getCalendarEvents: (maxResults = 20) =>
    request<{ events: Array<{ id: string; summary: string; start: string; end: string; html_link: string }>; count: number }>(`/api/calendar/events?max_results=${maxResults}`),

  syncContractToCalendar: (contractId: string) =>
    request<{ message: string; start_event_link: string; end_event_link: string }>(`/api/calendar/sync/${contractId}`, { method: "POST" }),

  syncAllToCalendar: () =>
    request<{ synced: number; failed: number; total: number }>("/api/calendar/sync-all", { method: "POST" }),

  disconnectCalendar: () =>
    request<{ message: string }>("/api/calendar/disconnect", { method: "DELETE" }),

  // ── Document conversion (LibreOffice) ────────────────────────────────────
  libreofficeStatus: () =>
    request<{ available: boolean; supported_formats: string[]; message: string }>(
      "/api/documents/libreoffice-status"
    ),

  /**
   * Convert the latest document for a contract to a different format.
   * Returns a Blob (the converted file) that the caller can turn into a
   * download link.
   */
  convertDocument: async (contractId: string, targetFormat: string): Promise<Blob> => {
    const token = await (async () => {
      // Inline token resolution (same logic as resolveToken above)
      if (tokenProvider) {
        try { const t = await tokenProvider(); if (t) return t; } catch {}
      }
      if (typeof window !== "undefined") {
        try { return window.localStorage.getItem("clause_auth_token"); } catch {}
      }
      return null;
    })();

    const response = await fetch(
      `${API_BASE_URL}/api/documents/convert/${contractId}?target_format=${encodeURIComponent(targetFormat)}`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );

    if (!response.ok) {
      const text = await response.text();
      let msg = `Conversion failed (${response.status})`;
      try { msg = (JSON.parse(text) as { detail?: string }).detail ?? msg; } catch {}
      throw new Error(msg);
    }

    return response.blob();
  },

  getPreferences: () => request<UserPreferences>("/api/preferences/"),

  updatePreferences: (patch: Partial<UserPreferences>) =>
    request<UserPreferences>("/api/preferences/", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  // ── Email / Notifications ──────────────────────────────────────────────────
  getEmailConfig: () =>
    request<{ configured: boolean; smtp_email: string | null }>("/api/notifications/email-config"),

  sendTestEmail: (toEmail: string) =>
    request<{ message: string }>("/api/notifications/send-test-email", {
      method: "POST",
      body: JSON.stringify({ to_email: toEmail }),
    }),

  sendExpiryAlerts: (dryRun = false) =>
    request<{ sent: number; skipped: number; errors: number; dry_run: boolean }>(
      `/api/notifications/send-expiry-alerts?dry_run=${dryRun}`,
      { method: "POST" }
    ),

  getNotificationSettings: () =>
    request<Record<string, unknown>>("/api/notifications/settings"),

  saveNotificationSettings: (body: Record<string, unknown>) =>
    request<{ message: string }>("/api/notifications/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  bootstrapAdmin: () =>
    request<{ message: string; user: Record<string, unknown> }>("/api/auth/bootstrap-admin", {
      method: "POST",
    }),

  // ── Lifecycle stats ───────────────────────────────────────────────────────
  getLifecycleStats: () =>
    request<LifecycleStats>("/api/contracts/lifecycle-stats"),

  // ── Workflow templates ────────────────────────────────────────────────────
  listWorkflowTemplates: () =>
    request<WorkflowTemplate[]>("/api/workflows/templates"),

  createWorkflowTemplate: (payload: {
    name: string;
    description?: string | null;
    steps: Array<{
      step_number: number;
      name: string;
      step_type: string;
      description?: string | null;
    }>;
  }) =>
    request<WorkflowTemplate>("/api/workflows/templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateWorkflowTemplate: (
    id: string,
    payload: Partial<{
      name: string;
      description: string | null;
      steps: Array<{
        step_number: number;
        name: string;
        step_type: string;
        description?: string | null;
      }>;
    }>
  ) =>
    request<WorkflowTemplate>(`/api/workflows/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteWorkflowTemplate: (id: string) =>
    request<{ message: string }>(`/api/workflows/templates/${id}`, {
      method: "DELETE",
    }),
  // ── Reports ─────────────────────────────────────────────────────────────────
  runReport: (definition: ReportDefinition) =>
    request<ReportResult>("/api/reports/run", {
      method: "POST",
      body: JSON.stringify(definition),
    }),

  getReportPresets: () => request<ReportPreset[]>("/api/reports/presets"),

  downloadReportBlob: async (
    definition: ReportDefinition,
    format: "csv" | "pdf",
    title = "CLAUSE Report"
  ): Promise<{ blob: Blob; filename: string }> => {
    const token = await resolveToken();
    const res = await fetch(`${API_BASE_URL}/api/reports/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ definition, format, title }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(`Export failed (${res.status})`, res.status, text);
    }
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename=([^\s;]+)/);
    const filename = match?.[1] ?? `report.${format}`;
    return { blob: await res.blob(), filename };
  },

  listAuditLogs: (
    params: {
      resource_type?: string;
      resource_id?: string;
      user_id?: string;
      action?: string;
      page?: number;
      per_page?: number;
    } = {}
  ) => {
    const search = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, String(value));
      }
    });

    const suffix = search.toString();

    return request<AuditLogResponse>(
      `/api/audit/${suffix ? `?${suffix}` : ""}`
    );
  },
};

export {
  API_BASE_URL,
  ApiError,
  type ChatHistoryMessage,
  type ChatRequestPayload,
};