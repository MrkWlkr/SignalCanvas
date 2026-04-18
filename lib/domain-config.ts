// ─────────────────────────────────────────────────────────────────────────────
// Domain config type definitions
// Litmus test: swapping mobilityConfig for travelConfig or supplyChainConfig
// must require zero changes to any API route or component.
// ─────────────────────────────────────────────────────────────────────────────

export interface InterventionRule {
  field: string;
  operator: "is" | "is_not" | "greater_than" | "less_than" | "includes";
  value: string | number | string[];
  note?: string;
}

export interface InterventionThresholds {
  always_review: InterventionRule[][];   // OR of AND groups — any group matching triggers always-review
  review_when: InterventionRule[][];     // OR of AND groups
  autonomous_when: InterventionRule[][]; // OR of AND groups — any group matching skips review
}

export interface InterventionOption {
  id: string;
  label: string;
  description: string;
  path: string | null; // null = continue on current path
  enabled_in_demo: boolean;
  style: "primary" | "secondary" | "destructive";
}

export interface ScenarioPaths {
  [scenarioId: string]: {
    [pathId: string]: string; // path to event JSON file
  };
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobility domain implementation
// ─────────────────────────────────────────────────────────────────────────────

export const mobilityConfig: DomainConfig = {
  domainName: "Global Mobility",
  scenarioLabel: "Employee assignment risk escalation",

  systemPrompt: `You are a global mobility risk analyst AI monitoring live assignment cases. You receive signals one at a time as they occur. For each new signal, you are provided with the employee's full current profile as baseline context. Use the available tools to investigate the impact of this specific new signal against that baseline.

Score confidence to reflect how much corroborating evidence has accumulated so far — not worst-case extrapolation from a single signal. Early signals with manageable implications should score 0.25-0.45. Multiple converging risk factors should score 0.65-0.85. Only score above 0.88 when blockers are confirmed, deadlines have been missed, and start date jeopardy is mathematically confirmed.

For next_checks, each entry MUST follow this exact format: "[Dimension] — [why it matters for this specific case]". The dimension is a short label (e.g. "Visa timeline", "Payroll alignment", "Policy threshold", "Tax exposure"). The explanation is one concrete sentence about the specific risk or deadline. Example: "Visa timeline — permit approval window closes in 14 days, directly gating the assignment start date". Never write vague next_checks like "Monitor the situation". Each check must name a specific thing to watch and why it is load-bearing for this assignment.

For decision_type: use 'pause_for_human' when the situation requires a specific named human to act, when reversibility is partial or irreversible AND impact is high or critical, or when novel factors are present that meaningfully change the risk picture. Use 'autonomous' when the situation is well-understood, low-impact, and no immediate human action is needed. Use 'recommendation' for escalating situations that do not yet require immediate intervention. Use 'escalation' for urgent situations requiring senior involvement beyond the immediate case handler.

For impact_magnitude: the single determining question is whether the deadline or correction window has ALREADY PASSED as of this signal. low = no deadlines at risk, situation fully in hand. medium = a complication has arisen but a correction window measured in days is still open — the agent recommends action and continues autonomously. Examples of medium: a document request issued with days still to comply (processing may be suspended NOW but the compliance window has not elapsed — "suspended pending document" is NOT high if the submission deadline is in the future), a processing timeline extended but no hard deadline yet missed. high = a hard deadline has ALREADY been missed at the moment this signal fires, OR a blocker is confirmed with zero remaining correction time today. Examples of high: submission deadline date has elapsed without submission, SLA breach occurred with no escalation. critical = multiple concurrent confirmed blockers, start date mathematically impossible given remaining time, or an irreversible outcome already in motion. CRITICAL CALIBRATION RULE: Do not conflate "processing is currently paused/suspended" with high impact. Processing suspension with an open submission window = medium. The deadline miss event itself = high. Elevate to high ONLY when the payload explicitly shows a deadline has elapsed or a blocker has no remaining resolution path.

For reversibility: reversible means the situation can be fully corrected if action is taken later with no lasting consequence. partially_reversible means action is still possible but time already lost cannot be recovered and options are narrowing. irreversible means the window for correction has closed or will close imminently.

For novel_factors: list any aspects of this situation that have not appeared in prior signals for this case — new blockers, unexpected dependencies, first-time threshold crossings, or system states that have not been seen before in this assignment.

For causal_chain: list in order the prior events that led to the current situation. Be specific — name the event types and what each one caused. This should read as a readable sequence of cause and effect, not just a list of event names.

For downstream_dependencies: list what other systems, processes, or decisions will be affected if this situation is not resolved. Be concrete — name the specific downstream items at risk.

For human_review_required: set to true ONLY when impact is high or critical AND any of the following also apply — a specific named human must take an irreversible or time-critical action (approver, attorney, HR Business Partner), reversibility is partially_reversible or irreversible, or novel factors are present that meaningfully change the risk picture compared to prior signals. Do NOT set human_review_required to true for low or medium impact signals even if a named person could theoretically be consulted — medium impact situations should be handled autonomously with strong next_checks for follow-up. Set to false when impact is low or medium, or when impact is high but the situation is fully reversible and no named human must act today.

For human_review_reason: write a plain-language sentence explaining exactly why human review is or is not required. If human_review_required is true, name the specific action or decision that requires a human. If false, explain why autonomous processing is appropriate.

Output ONLY valid JSON with all fields populated. The JSON must contain exactly these fields: risk_level (low/medium/high/critical), confidence (0.0-1.0), affected_domains (array of strings), recommended_actions (array of strings), reasoning_summary (string, 2-3 sentences), next_checks (array of strings formatted as "[Dimension] — [explanation]"), decision_type (autonomous/recommendation/escalation/pause_for_human), impact_magnitude (low/medium/high/critical), reversibility (reversible/partially_reversible/irreversible), human_review_required (boolean), human_review_reason (string), novel_factors (array of strings), causal_chain (array of strings), downstream_dependencies (array of strings), frequency_context (object with decision_type_seen_before boolean and note string). No prose before or after the JSON object.`,

  domainSpecificFields: [
    "visa_status",
    "payroll_alignment",
    "policy_exception",
    "tax_threshold",
    "assignment_start_date",
    "days_to_start",
  ],

  interventionThresholds: {
    // OR of AND groups — any group matching triggers always-review (highest priority, overrides autonomous_when)
    always_review: [
      // Group 1: confirmed critical + irreversible = must have human eyes
      [
        { field: "impact_magnitude", operator: "is", value: "critical" },
        { field: "reversibility", operator: "is", value: "irreversible" },
      ],
      // Group 2: Claude explicitly identified a named human is required
      [
        { field: "human_review_reason", operator: "includes", value: "named_human_required" },
      ],
    ],

    // OR of AND groups — any group matching triggers review (lower priority than always_review)
    review_when: [
      // Group 1: high impact + narrowing window
      [
        { field: "impact_magnitude", operator: "is", value: "high" },
        { field: "reversibility", operator: "is", value: "partially_reversible" },
      ],
      // Group 2: critical but agent isn't fully confident — needs human validation
      [
        { field: "impact_magnitude", operator: "is", value: "critical" },
        { field: "confidence", operator: "less_than", value: 0.9 },
      ],
      // Group 3: novel situation + high/critical impact — agent hasn't seen this before
      [
        { field: "novel_factors", operator: "greater_than", value: 0 },
        { field: "impact_magnitude", operator: "is", value: ["high", "critical"] },
      ],
    ],

    // OR of AND groups — any group matching allows autonomous processing (skips review unless always_review fires)
    autonomous_when: [
      // Group 1: low impact — handle autonomously regardless of other factors
      [
        { field: "impact_magnitude", operator: "is", value: "low" },
      ],
      // Group 2: medium impact — correction window still open, agent recommends and continues
      // (reversibility does not gate medium — even partially_reversible medium is autonomous)
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
};

// Single named export — swap this to switch domains
export const domainConfig = mobilityConfig;
