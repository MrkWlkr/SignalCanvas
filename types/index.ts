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
  minute_offset?: number;
  entity_id: string;
  acted_on?: boolean;
  unactioned_recommendation_indices?: number[];
  payload: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured action types — Phase 8a
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentActionTaken {
  id: string;
  action: string;
  type: "risk_update" | "flag" | "log" | "supersede" | "notify" | "correlate" | "suppress" | "escalate";
  log_to_register: boolean;
  impact_magnitude: "low" | "medium" | "high" | "critical";
  regulatory_basis?: string;
}

export interface SurfacedAwareness {
  id: string;
  observation: string;
  relevance: string;
  horizon: "immediate" | "short_term" | "medium_term";
  clinical_basis?: string;
}

export interface HumanActionRequired {
  id: string;
  action: string;
  owner: string;
  deadline: string;
  consequence: string;
  urgency: "immediate" | "urgent" | "monitor";
  patient_impact?: string;
}

export interface ActionRegisterEntry {
  id: string;
  action: string;
  owner: string;
  deadline: string;
  consequence: string;
  urgency: "immediate" | "urgent" | "monitor";
  status: "active" | "resolved_system" | "resolved_human" | "superseded" | "missed";
  issued_at_event_index: number;
  issued_at_date: string;
  resolved_by?: "system_event" | "human_decision" | "agent_superseded";
  resolved_at?: string;
  resolution_evidence?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Full evaluator output schema — all fields populated by Claude
// ─────────────────────────────────────────────────────────────────────────────

export interface EvaluatorOutput {
  risk_level: RiskLevel;
  confidence: number;
  health_score?: number;
  affected_domains: string[];
  /** @deprecated use agent_actions_taken, surfaced_for_awareness, human_actions_required */
  recommended_actions?: string[];
  reasoning_summary: string;
  next_checks: string[];
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
  // Three typed output arrays replacing recommended_actions
  agent_actions_taken: AgentActionTaken[];
  surfaced_for_awareness: SurfacedAwareness[];
  human_actions_required: HumanActionRequired[];
  // Cross-reference fields for register status tracking
  resolves_prior_actions: string[];
  missed_prior_actions: string[];
  supersedes_prior_actions: string[];
}

export interface HumanDecision {
  option_id: string;
  option_label: string;
  path_result: string | null;

  // Timing audit trail
  intervention_triggered_at: string;
  decision_recorded_at: string;
  simulated_response_minutes: number;

  // What the human was shown
  situation_summary: string;
  impact_magnitude: string;
  reversibility: string;
  human_review_reason: string;
  options_presented: number;
  options_enabled: number;

  // What changed as a result
  register_items_resolved: string[];
  path_switched: boolean;
  path_name: string | null;

  // Legacy fields kept for backward compat
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
  // Snapshot of the action register at this evaluation point — enables time-travel filtering
  registerSnapshot?: ActionRegisterEntry[];
}

export interface PendingIntervention {
  event_id: string;
  event_index: number;
  evaluation: EvaluatorOutput;
  triggered_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Behavioral test suite types
// ─────────────────────────────────────────────────────────────────────────────

export interface AssertionDefinition {
  id: string;
  label: string;
  event_index: number;
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "length_greater_than" | "length_equals" | "includes";
  expected: unknown;
  type: "positive" | "negative" | "threshold";
  explanation: string;
}

export interface AssertionResult {
  id: string;
  label: string;
  status: "pass" | "fail" | "pending";
  expected: unknown;
  actual: unknown;
  explanation: string;
  type: "positive" | "negative" | "threshold";
}

export interface PrimaryEntity {
  name: string;
  subtitle: string;
  tags: string[];
  meta: { label: string; value: string }[];
}

export interface ScenarioApiResponse {
  scenario: ScenarioMeta;
  events: SignalEvent[];
  employee?: Employee;
  visa_case?: unknown;
  payroll_status?: unknown;
  primary_entity?: PrimaryEntity;
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
  action_register: ActionRegisterEntry[];
  assertion_results?: AssertionResult[];
}
