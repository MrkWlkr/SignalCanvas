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

// Full evaluator output schema — all fields populated by Claude
export interface EvaluatorOutput {
  // Original fields
  risk_level: RiskLevel;
  confidence: number;
  affected_domains: string[];
  recommended_actions: string[];
  reasoning_summary: string;
  next_checks: string[];
  // New intervention-routing fields
  decision_type: "autonomous" | "recommendation" | "escalation" | "pause_for_human";
  impact_magnitude: "low" | "medium" | "high" | "critical";
  reversibility: "reversible" | "partially_reversible" | "irreversible";
  human_review_required: boolean;
  human_review_reason: string;
  novel_factors: string[];
  causal_chain: string[];
  downstream_dependencies: string[];
  frequency_context: {
    decision_type_seen_before: boolean;
    note: string;
  };
}

export interface HumanDecision {
  option_id: string;
  option_label: string;
  decision_id?: string;
  modified_actions?: string[];
  timestamp: string;
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
  evaluation: EvaluatorOutput;
  tool_trace: ToolCallTrace[];
  status: "autonomous" | "pending_human_review" | "human_reviewed";
  path: string;
  human_decision?: HumanDecision;
}

export interface PendingIntervention {
  event_id: string;
  event_index: number;
  evaluation: EvaluatorOutput;
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
  current_path: string;
  pending_intervention: PendingIntervention | null;
}
