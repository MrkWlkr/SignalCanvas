// ─────────────────────────────────────────────────────────────────────────────
// Domain config type definitions
// Litmus test: swapping mobilityConfig for travelConfig or supplyChainConfig
// must require zero changes to any API route or component.
// ─────────────────────────────────────────────────────────────────────────────

import type { EvaluatorOutput } from "@/types";
import {
  loadEmployees,
} from "@/lib/data";
import {
  getEmployee,
  getAssignment,
  getVisaCase,
  getPayrollStatus,
} from "@/lib/tools";

export interface CanvasConfig {
  kpiLabel: string;
  kpiField: keyof EvaluatorOutput;
  kpiRange: [number, number];
  kpiThresholdValue: number;
  kpiThresholdLabel: string;
  nodeSpacingPx: number;
  compressAfterCount: number;
  toolSourceSystemMap: Record<string, string>;
}

export interface InterventionRule {
  field: string;
  operator: "is" | "is_not" | "greater_than" | "less_than" | "includes";
  value: string | number | string[];
  note?: string;
}

export interface InterventionThresholds {
  always_review: InterventionRule[][];
  review_when: InterventionRule[][];
  autonomous_when: InterventionRule[][];
}

export interface InterventionOption {
  id: string;
  label: string;
  description: string;
  path: string | null;
  enabled_in_demo: boolean;
  style: "primary" | "secondary" | "destructive";
}

export interface ScenarioPaths {
  [scenarioId: string]: {
    [pathId: string]: string;
  };
}

export interface TimelineConfig {
  granularity: "day" | "minute" | "second";
  monitoringStartDates: {
    [scenarioId: string]: string;
  };
  deadlineLabel: string;
  deadlineField: string;
}

export interface DomainConfig {
  domainName: string;
  scenarioLabel: string;
  systemPrompt: string;
  domainSpecificFields: string[];
  interventionThresholds: InterventionThresholds;
  interventionOptions: InterventionOption[];
  scenarioPaths: ScenarioPaths;
  dataFiles: {
    employees: string;
    countryRules: string;
    policyRules: string;
    visaCases: string;
    payrollStatus: string;
    signalEvents: string;
  };
  canvas: CanvasConfig;
  timeline: TimelineConfig;
  // Fetch domain-specific baseline context for a scenario.
  // Swapping domains requires only a new implementation here — zero route changes.
  getBaselineContext: (entityId: string) => Promise<Record<string, unknown>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobility domain implementation
// ─────────────────────────────────────────────────────────────────────────────

export const mobilityConfig: DomainConfig = {
  domainName: "Global Mobility",
  scenarioLabel: "Employee assignment risk escalation",

  systemPrompt: `You are a global mobility risk analyst AI monitoring live assignment cases. You receive signals one at a time as they occur. For each new signal you are provided with the employee's full current profile as baseline context.

OUTPUT STRUCTURE — you must populate all three action arrays with correct tense and required fields:

AGENT_ACTIONS_TAKEN — things you did autonomously at this moment. Always past tense. Examples: "Updated risk level to HIGH", "Flagged case for priority review", "Suppressed redundant downstream alert", "Superseded prior payroll recommendation with more urgent version". Generate a stable id for each (act_001, act_002, etc). Set log_to_register: true only for actions with medium or higher impact_magnitude.

SURFACED_FOR_AWARENESS — things a human should know but that do not require immediate action. Always present observational tense. Examples: "VP approval workflow is at 26 of 28-day SLA — approaching breach", "Tax threshold exposure increases if start date slips beyond September", "Similar case resolved in 2024 via emergency attorney engagement". Include relevance explaining why it matters now. Set horizon based on urgency: immediate (today), short_term (this week), medium_term (this month).

HUMAN_ACTIONS_REQUIRED — explicit requests to named humans. Always imperative tense. Always include owner (specific role, not generic), deadline (specific timeframe or date), consequence (what happens if missed). Examples: "Submit employer support letter to consulate portal — Owner: HR Business Partner — Deadline: immediately — Consequence: processing remains suspended, start date breach probable". Generate a stable id for each (req_001, req_002, etc). These IDs must be stable and consistent — if you reference a prior requirement in resolves_prior_actions or missed_prior_actions, use the exact same ID.

CROSS-REFERENCE FIELDS — you will receive the live action register in each user message. You MUST cross-reference it:
resolves_prior_actions: IDs of ACTIVE register entries confirmed completed by evidence in this signal. Example: signal "document_submitted_on_time" → include the req_NNN for "Submit employer support letter".

missed_prior_actions: IDs of ACTIVE register entries whose deadline has NOW PASSED and this signal confirms the consequence materialized. REQUIRED: if the event type or payload contains "deadline_missed", "overdue", "suspended_pending", or explicitly states a required action was not taken, scan EVERY active register entry for ones whose deadline has passed and include their IDs. Do not leave this empty if active reqs exist and the signal confirms their deadline passed.

supersedes_prior_actions: IDs of ACTIVE register entries replaced by a more urgent version you are issuing in this evaluation.

HUMAN_ACTIONS_REQUIRED — POSITIVE EVENTS: If this signal is a positive milestone (approval received, document submitted, payroll set up, assignment cleared), human_actions_required MUST be empty [] unless a new specific action is still outstanding. Do not generate human action items on events that confirm progress or resolution.

CONFIDENCE SCORING:
Score confidence to reflect accumulated evidence — not worst-case extrapolation. Early signals: 0.25-0.45. Multiple converging factors: 0.65-0.85. Confirmed blockers with missed deadlines: 0.88-0.95.

For next_checks, each entry MUST follow this exact format: "[Dimension] — [why it matters for this specific case]". The dimension is a short label (e.g. "Visa timeline", "Payroll alignment", "Policy threshold", "Tax exposure"). The explanation is one concrete sentence about the specific risk or deadline.

For decision_type: use 'pause_for_human' when the situation requires a specific named human to act, when reversibility is partial or irreversible AND impact is high or critical, or when novel factors are present that meaningfully change the risk picture. Use 'autonomous' when the situation is well-understood, low-impact, and no immediate human action is needed. Use 'recommendation' for escalating situations that do not yet require immediate intervention. Use 'escalation' for urgent situations requiring senior involvement beyond the immediate case handler.

For impact_magnitude: the single determining question is whether the deadline or correction window has ALREADY PASSED as of this signal. low = no deadlines at risk. medium = a complication has arisen but a correction window is still open. high = a hard deadline has ALREADY been missed. critical = multiple concurrent confirmed blockers, start date mathematically impossible.

For reversibility: reversible = fully correctable. partially_reversible = action still possible but time lost cannot be recovered. irreversible = correction window has closed or closes imminently.

For human_review_required: set to true ONLY when impact is high or critical AND a specific named human must take an irreversible or time-critical action, reversibility is partially_reversible or irreversible, or novel factors are present. Set to false when impact is low or medium.

For human_review_reason: write a plain-language sentence explaining exactly why human review is or is not required.

For novel_factors: list any aspects of this situation that have not appeared in prior signals for this case.

For causal_chain: list in order the prior events that led to the current situation — readable sequence of cause and effect.

For downstream_dependencies: list what other systems, processes, or decisions will be affected if this situation is not resolved.

Output ONLY valid JSON with ALL of the following fields populated — no prose before or after:
risk_level (low/medium/high/critical), confidence (0.0-1.0), affected_domains (array of strings), reasoning_summary (string, 2-3 sentences), next_checks (array of "[Dimension] — [explanation]" strings), decision_type (autonomous/recommendation/escalation/pause_for_human), impact_magnitude (low/medium/high/critical), reversibility (reversible/partially_reversible/irreversible), human_review_required (boolean), human_review_reason (string), novel_factors (array of strings), causal_chain (array of strings), downstream_dependencies (array of strings), frequency_context (object with decision_type_seen_before boolean and note string), agent_actions_taken (array of AgentActionTaken objects with id/action/type/log_to_register/impact_magnitude), surfaced_for_awareness (array of SurfacedAwareness objects with id/observation/relevance/horizon — use id prefix obs_), human_actions_required (array of HumanActionRequired objects with id/action/owner/deadline/consequence/urgency — use id prefix req_), resolves_prior_actions (array of string IDs), missed_prior_actions (array of string IDs), supersedes_prior_actions (array of string IDs).`,

  domainSpecificFields: [
    "visa_status",
    "payroll_alignment",
    "policy_exception",
    "tax_threshold",
    "assignment_start_date",
    "days_to_start",
  ],

  interventionThresholds: {
    always_review: [
      [
        { field: "impact_magnitude", operator: "is", value: "critical" },
        { field: "reversibility", operator: "is", value: "irreversible" },
      ],
      [
        { field: "human_review_reason", operator: "includes", value: "named_human_required" },
      ],
    ],

    review_when: [
      [
        { field: "impact_magnitude", operator: "is", value: "high" },
        { field: "reversibility", operator: "is", value: "partially_reversible" },
      ],
      [
        { field: "impact_magnitude", operator: "is", value: "critical" },
        { field: "confidence", operator: "less_than", value: 0.9 },
      ],
      [
        { field: "novel_factors", operator: "greater_than", value: 0 },
        { field: "impact_magnitude", operator: "is", value: ["high", "critical"] },
      ],
    ],

    autonomous_when: [
      [
        { field: "impact_magnitude", operator: "is", value: "low" },
      ],
      [
        { field: "impact_magnitude", operator: "is", value: "medium" },
      ],
    ],
  },

  interventionOptions: [
    {
      id: "approve",
      label: "Initiate recommended actions",
      description:
        "Signal Canvas will log this decision and advance the scenario on the resolved path",
      path: "intervention_resolved",
      enabled_in_demo: true,
      style: "primary",
    },
    {
      id: "override",
      label: "I'll handle this manually",
      description:
        "Transfer to manual management — agent steps back, Signal Canvas records the override",
      path: null,
      enabled_in_demo: true,
      style: "secondary",
    },
    {
      id: "escalate",
      label: "Escalate to senior advisor",
      description: "Route to senior advisor with full context",
      path: null,
      enabled_in_demo: false,
      style: "secondary",
    },
    {
      id: "modify",
      label: "Modify recommendations",
      description: "Edit the recommended actions before approving",
      path: null,
      enabled_in_demo: false,
      style: "secondary",
    },
  ],

  scenarioPaths: {
    SCENARIO_ESCALATING: {
      default: "data/signal_events.json",
      intervention_resolved: "data/signal_events_path_a.json",
    },
    SCENARIO_CRITICAL: {
      default: "data/signal_events.json",
    },
  },

  dataFiles: {
    employees: "data/employees.json",
    countryRules: "data/country_rules.json",
    policyRules: "data/policy_rules.json",
    visaCases: "data/visa_cases.json",
    payrollStatus: "data/payroll_status.json",
    signalEvents: "data/signal_events.json",
  },

  canvas: {
    kpiLabel: "Agent confidence",
    kpiField: "confidence",
    kpiRange: [0, 1] as [number, number],
    kpiThresholdValue: 0.7,
    kpiThresholdLabel: "Escalation threshold",
    nodeSpacingPx: 200,
    compressAfterCount: 4,
    toolSourceSystemMap: {
      get_employee:               "HRIS",
      get_assignment:             "HRIS",
      get_country_rule:           "Country Rules DB",
      get_policy:                 "Policy Engine",
      get_visa_case:              "Immigration System",
      get_payroll_status:         "Payroll System",
      get_recent_signals:         "Signal Feed",
      calculate_days_until_start: "Calendar",
    },
  },

  timeline: {
    granularity: "day",
    monitoringStartDates: {
      SCENARIO_ESCALATING: "2026-06-27",
      SCENARIO_CRITICAL:   "2026-06-20",
      SCENARIO_HEALTHY:    "2026-07-03",
    },
    deadlineLabel: "Days until assignment start",
    deadlineField: "days_to_start",
  },

  getBaselineContext: async (scenarioId: string): Promise<Record<string, unknown>> => {
    const allEmployees = loadEmployees();
    const employee = allEmployees.find((e) => e.scenario_id === scenarioId);
    if (!employee) return {};
    const employeeRecord = getEmployee(employee.employee_id);
    const assignment = getAssignment(employee.employee_id);
    const visaCase = getVisaCase(employee.case_id);
    const payroll = getPayrollStatus(employee.employee_id);
    return { employee: employeeRecord, assignment, visaCase, payroll };
  },
};

// Single named export — swap this to switch domains
export const domainConfig = mobilityConfig;
