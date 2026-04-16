export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ScenarioMeta {
  id: string;
  label: string;
  employee_name: string;
  route: string;
  start_date: string;
  duration_days: number;
}

export interface Employee {
  employee_id: string;
  employee_name: string;
  home_country: string;
  host_country: string;
  assignment_type: string;
  start_date: string;
  planned_duration_days: number;
  department: string;
  policy_id: string;
  case_id: string;
  scenario_id: string;
}

export interface SignalEvent {
  event_id: string;
  scenario_id: string;
  timestamp_offset_sec: number;
  event_type: string;
  event_category?: string;
  source_system?: string;
  day_offset?: number;
  entity_id: string;
  acted_on?: boolean;
  unactioned_recommendation_indices?: number[];
  payload: Record<string, unknown>;
}

export interface RiskEvaluation {
  risk_level: RiskLevel;
  confidence: number;
  affected_domains: string[];
  recommended_actions: string[];
  reasoning_summary: string;
  next_checks: string[];
}

export interface ToolCallTrace {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_result: unknown;
}

export interface EvaluationRecord {
  event_index: number;
  event_id: string;
  event_type: string;
  timestamp: string;
  evaluation: RiskEvaluation;
  tool_trace: ToolCallTrace[];
}

export interface ScenarioApiResponse {
  scenario: ScenarioMeta;
  events: SignalEvent[];
  employee: Employee;
  visa_case: unknown;
  payroll_status: unknown;
}

export interface StateApiResponse {
  scenario_id: string;
  current_event_index: number;
  total_events: number;
  complete: boolean;
  evaluation_count: number;
  latest_evaluation: EvaluationRecord | null;
  evaluations: EvaluationRecord[];
}
