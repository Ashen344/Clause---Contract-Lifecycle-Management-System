export type ContractType =
  | "service_agreement"
  | "nda"
  | "employment"
  | "vendor"
  | "licensing"
  | "partnership"
  | "other";

export type ContractStatus =
  | "draft"
  | "active"
  | "expired"
  | "terminated"
  | "renewed";

export type WorkflowStage =
  | "request"
  | "authoring"
  | "review"
  | "approval"
  | "execution"
  | "storage"
  | "monitoring"
  | "renewal"
  | "expired"
  | "completed";

export type RiskLevel = "low" | "medium" | "high";

export type ContractParty = {
  name: string;
  role: string;
  email?: string | null;
  organization?: string | null;
};

export type Contract = {
  id: string;
  title: string;
  contract_type: ContractType;
  description?: string | null;
  parties: ContractParty[];
  start_date: string;
  end_date: string;
  value?: number | null;
  payment_terms?: string | null;
  status: ContractStatus;
  workflow_stage: WorkflowStage;
  risk_score?: number | null;
  risk_level?: RiskLevel | null;
  current_version?: number;
  versions?: Array<{
    version_number: number;
    file_url: string;
    original_filename?: string;
    file_size?: number;
    file_type?: string;
    uploaded_by?: string;
    uploaded_at?: string;
    change_notes?: string;
  }>;
  created_by?: string;
  created_by_name?: string | null;
  tags?: string[] | null;
  template_id?: string | null;
  document_status?: "generating" | "ready" | "failed" | null;
  workflow_rejected?: boolean | null;
  workflow_total_steps?: number | null;
  workflow_current_step?: number | null;
  workflow_step_names?: string[] | null;
  created_at: string;
  updated_at: string;
  workflow_id?: string;
  ai_analysis?: {
    summary?: string;
    extracted_clauses?: string[];
    key_information?: Record<string, unknown>;
    risk_score?: number;
    risk_level?: RiskLevel;
    risk_factors?: string[];
    recommendations?: string[];
    analyzed_at?: string;
  } | null;
};

export type ContractsResponse = {
  contracts: Contract[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

export type DashboardStats = {
  total_contracts: number;
  active_contracts: number;
  draft_contracts: number;
  expired_contracts: number;
  terminated_contracts?: number;
  expiring_soon: number;
  pending_approvals?: number;
  active_workflows?: number;
  total_users?: number;
  risk_summary: {
    high: number;
    medium: number;
    low: number;
  };
};

export type WorkflowStep = {
  step_number: number;
  name: string;
  step_type: string;
  status: "pending" | "in_progress" | "completed" | "rejected" | "skipped";
  assigned_to?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  comments?: string | null;
  due_date?: string | null;
};

export type Workflow = {
  id: string;
  contract_id: string;
  name: string;
  status: "active" | "completed" | "cancelled" | "paused";
  current_step: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  steps: WorkflowStep[];
};

export type TemplateField = {
  field_name: string;
  field_type: string;
  required: boolean;
  default_value?: string | null;
  options?: string[] | null;
};

export type Template = {
  id: string;
  name: string;
  description?: string | null;
  contract_type: ContractType;
  content: string;
  fields: TemplateField[];
  tags?: string[] | null;
  version: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type TemplatesResponse = {
  templates: Template[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

export type Approval = {
  id: string;
  contract_id: string;
  workflow_id?: string;
  approval_type: string;
  status: string;
  approvers: Array<{
    user_id: string;
    decision?: string | null;
    comments?: string | null;
    decided_at?: string | null;
  }>;
  due_date?: string | null;
  created_at?: string;
  updated_at?: string;
  decided_at?: string | null;
};

export type ApprovalListResponse = {
  approvals: Approval[];
  count?: number;
};

export type ConflictResult = {
  total_conflicts: number;
  overall_risk: string;
  summary: string;
  conflicts: Array<{
    id: number;
    contract_a: string;
    contract_b: string;
    clause_a: string;
    clause_b: string;
    conflict_type: string;
    severity: string;
    description: string;
    recommendation: string;
  }>;
  contracts_analyzed?: Array<{ id: string; title: string; current_version?: number }>;
  error?: string;
};

export type AiAnalysisResponse = {
  summary?: string;
  extracted_clauses?: string[];
  key_information?: Record<string, unknown>;
  risk_score?: number | null;
  risk_level?: string | null;
  risk_factors?: string[];
  recommendations?: string[];
  analyzed_at?: string;
  error?: string;
};

export type AiChatResponse = {
  answer: string;
  contract_id?: string;
};

export type DraftResponse = {
  contract_type: string;
  content: string;
  generated_at: string;
  error?: string;
};

// ─── Admin / Users / Audit ────────────────────────────────

export type UserRole = "admin" | "manager" | "user" | "viewer";
export type AccountStatus = "active" | "inactive" | "suspended";

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization?: string | null;
  status: AccountStatus;
  created_at: string;
  last_login?: string | null;
};

export type UsersListResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

export type AdminStats = {
  users: {
    total: number;
    active: number;
    inactive: number;
    by_role: Array<{ role: string; count: number }>;
  };
  contracts: {
    total: number;
    active: number;
    draft: number;
    expired: number;
    terminated: number;
    created_this_month: number;
    expiring_soon: number;
  };
  contract_values: {
    total_value: number;
    avg_value: number;
    max_value: number;
  };
  risk: { high: number; medium: number; low: number };
  approvals: {
    pending: number;
    total: number;
    approved: number;
    rejected: number;
  };
  workflows: { active: number; completed: number };
  templates: { total: number; active: number };
  system: {
    recent_audit_actions: number;
    unread_notifications: number;
  };
};

export type AdminUserActivity = {
  id: string;
  action: string;
  resource_type: string;
  user_email?: string | null;
  details?: string | null;
  created_at: string;
};

export type AdminRecentUser = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  created_at?: string | null;
  last_login?: string | null;
};

export type ContractsByStage = { stage: string; count: number };

export type ValueByType = {
  type: string;
  total_value: number;
  count: number;
};

export type ApprovalStat = { status: string; count: number };

export type AuditLogEntry = {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  details?: string | null;
  changes?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
};

export type AuditLogResponse = {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

// ─── User Preferences ────────────────────────────────────────

export type WidgetVisibility = {
  total_contracts?: boolean;
  active_contracts?: boolean;
  pending_approvals?: boolean;
  high_risk?: boolean;
};

export type PinnedContract = {
  id: string;
  title: string;
  status?: string;
};

export type DashboardSection =
  | "activity_trend"
  | "status_overview"
  | "contracts_by_type"
  | "expiring_docs"
  | "recent_activity"
  | "risk_analysis";

export type SectionVisibility = Partial<Record<DashboardSection, boolean>>;

export type UserPreferences = {
  widget_visibility: WidgetVisibility;
  section_visibility: SectionVisibility;
  default_contract_filter: string;
  pinned_contracts: PinnedContract[];
  accent_color: string;
  activity_count: number;
};

// ─── Workflow Templates ───────────────────────────────────────────────────────

export type WorkflowTemplateStep = {
  step_number: number;
  name: string;
  step_type: "review" | "approval" | "signing" | "notification" | "ai_analysis";
  description?: string | null;
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description?: string | null;
  steps: WorkflowTemplateStep[];
  created_by: string;
  created_at: string;
  updated_at: string;
};

// ─── Contract Lifecycle Stats ─────────────────────────────────────────────────

export type LifecycleStats = {
  pending_approval: number;
  pending_negotiation: number;
  pending_signing: number;
  waiting_to_active: number;
  became_active: number;
  upcoming_renewals: number;
};

// ─── Reports ─────────────────────────────────────────────

export type ReportDimension =
  | "contract_type"
  | "status"
  | "workflow_stage"
  | "risk_level"
  | "created_by"
  | "month"
  | "quarter"
  | "year"
  | "tags";

export type ReportMeasure =
  | "count"
  | "total_value"
  | "avg_value"
  | "min_value"
  | "max_value"
  | "avg_risk_score"
  | "max_risk_score"
  | "min_risk_score";

export type ReportChartType =
  | "table"
  | "bar"
  | "pie"
  | "line"
  | "donut"
  | "stacked_bar";

export type ReportDefinition = {
  dimensions: ReportDimension[];
  measures: ReportMeasure[];
  filters?: Record<string, unknown> | null;
  chart_type: ReportChartType;
  sort_by?: string | null;
  sort_order?: "asc" | "desc";
  limit?: number | null;
};

export type ReportColumn = {
  key: string;
  label: string;
  type: string;
};

export type ReportSummary = {
  total_rows: number;
  total_contracts_matched: number;
  summary_stats: Record<string, number>;
};

export type ReportResult = {
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary: ReportSummary;
  chart_type: ReportChartType;
  generated_at: string;
};

export type ReportPreset = {
  id: string;
  name: string;
  description: string;
  definition: ReportDefinition;
};
