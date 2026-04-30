// lib/configs/ops-config.ts
// 
// Domain config for Operational Intelligence — Platform Triage
// Drop-in replacement for mobilityConfig to demonstrate
// domain-agnostic architecture.
//
// Scenario: Vehicle inventory platform pricing field corruption
// following a deployment. Agent correlates signals across
// Jira, Slack, GitHub Enterprise, Splunk, New Relic, and AWS
// to identify root cause and surface resolution options.

import { DomainConfig } from '../domain-config'

export const opsConfig: DomainConfig = {
  id: "ops",
  domainName: "Operational Intelligence",
  scenarioLabel: "Platform issue triage — dealer pricing anomaly",

  systemPrompt: `You are an operational intelligence AI assisting a 
platform engineering team in triaging a reported issue. You receive 
signals one at a time as they arrive from monitoring systems, 
support tickets, deployment logs, and observability tools.

For each new signal, you have access to tools that can query 
service status, deployment history, Slack incident history, 
Splunk logs, New Relic metrics, and AWS infrastructure state. 
Use these tools to build a picture of what is happening, 
correlate signals across systems, and surface a clear root 
cause hypothesis with supporting evidence.

OUTPUT STRUCTURE — populate all three action arrays:

AGENT_ACTIONS_TAKEN — things you did autonomously at this moment. 
Always past tense. Examples: "Queried Slack #incidents for prior 
similar reports — found 2 matches", "Correlated deployment timing 
with issue onset — 73-minute gap, strong correlation", "Identified 
silent failure pattern in Splunk normalization logs", "Assessed 
blast radius — 47 dealers, 3,847 records affected".
Generate stable IDs (act_001, act_002...). Set log_to_register: 
true for actions with medium or higher impact_magnitude.

SURFACED_FOR_AWARENESS — things the team should know but that 
do not require immediate action. Always present observational 
tense. Examples: "Deployment author is available — PR merged 
during business hours today", "Prior incident resolved without 
full rollback — targeted fix was sufficient", "Queue depth is 
elevated but DLQ is empty — writes succeeding, just slow", 
"Standard error monitoring would not have caught this — 
no exceptions thrown". Include relevance and horizon.

HUMAN_ACTIONS_REQUIRED — explicit requests to named team members. 
Always imperative tense. Always include owner (specific role), 
deadline (specific timeframe), consequence (what happens if missed). 
Example: "Review root cause analysis and select resolution path — 
Owner: Platform team lead — Deadline: within 15 minutes — 
Consequence: P1 escalation triggered, financial reconciliation 
risk increases with each additional transaction at incorrect price".
Generate stable IDs (req_001...). Reference prior IDs consistently 
in resolves_prior_actions and missed_prior_actions.

CROSS-REFERENCE FIELDS:
resolves_prior_actions: IDs of prior human_actions_required 
  now resolved by system evidence in this signal.
missed_prior_actions: IDs where deadline passed without resolution 
  and this signal confirms the consequence materialized.
supersedes_prior_actions: IDs replaced by more urgent versions.

HEALTH SCORE GUIDANCE:
Score health_score (0-1, where 1 = fully healthy, 0 = critical):
  Initial escalation with unclear cause: 0.70-0.80
  Correlated signals pointing to a cause: 0.55-0.70
  Root cause identified, fix available: 0.35-0.55
  Blast radius confirmed, SLA breached: 0.20-0.40
  P1 escalation, financial risk: 0.10-0.25

Score confidence to reflect evidence accumulation:
  Single signal, hypothesis forming: 0.30-0.45
  Multiple corroborating signals: 0.55-0.70
  Root cause confirmed with evidence: 0.75-0.88
  Blast radius and fix options confirmed: 0.88-0.95

Output ONLY valid JSON. No prose before or after.`,

  domainSpecificFields: [
    "health_score",
    "affected_services",
    "affected_records",
    "affected_dealers",
    "root_cause_hypothesis",
    "fix_options"
  ],

  interventionThresholds: {
    always_review: [
      [
        { field: "impact_magnitude", operator: "is", value: "critical" },
        { field: "reversibility", operator: "is", value: "irreversible" }
      ],
      [
        { field: "human_review_reason", operator: "includes", 
          value: "named_human_required" }
      ]
    ],
    review_when: [
      [
        { field: "impact_magnitude", operator: "is", 
          value: ["high", "critical"] },
        { field: "human_actions_required", operator: "greater_than", 
          value: 0 }
      ],
      [
        { field: "novel_factors", operator: "greater_than", value: 0 },
        { field: "impact_magnitude", operator: "is", 
          value: ["high", "critical"] }
      ],
      [
        { field: "reversibility", operator: "is", 
          value: "partially_reversible" },
        { field: "impact_magnitude", operator: "is", value: "high" }
      ]
    ],
    autonomous_when: [
      [
        { field: "impact_magnitude", operator: "is", value: "low" }
      ],
      [
        { field: "impact_magnitude", operator: "is", value: "medium" },
        { field: "reversibility", operator: "is", value: "reversible" }
      ]
    ]
  },

  interventionOptions: [
    {
      id: "approve_targeted_patch",
      label: "Approve targeted patch",
      description: "Deploy PR-4475 fix to price-stack-mapper.ts. Preserves other PR-4471 changes. Estimated 20 minutes to deploy and re-process affected records.",
      path: "intervention_resolved",
      enabled_in_demo: true,
      style: "primary"
    },
    {
      id: "approve_rollback",
      label: "Approve full rollback",
      description: "Revert price-stack-service to pre-PR-4471. Safer but reverts 2 unrelated bug fixes. Larger data repair scope.",
      path: null,
      enabled_in_demo: true,
      style: "secondary"
    },
    {
      id: "escalate",
      label: "Escalate to engineering director",
      description: "Route decision to engineering director with full context",
      path: null,
      enabled_in_demo: false,
      style: "secondary"
    },
    {
      id: "investigate_further",
      label: "Investigate further first",
      description: "Request additional signal gathering before deciding",
      path: null,
      enabled_in_demo: false,
      style: "secondary"
    }
  ],

  scenarioPaths: {
    SCENARIO_DEALER_PRICING: {
      default: "data/ops/signal_events_ops.json",
      intervention_resolved: "data/ops/signal_events_ops.json"
    }
  },

  dataFiles: {
    services: "data/ops/services.json",
    deployEvents: "data/ops/deploy_events.json",
    serviceDependencies: "data/ops/service_dependencies.json",
    slaConfigs: "data/ops/sla_configs.json",
    infrastructure: "data/ops/infrastructure.json",
    signalEvents: "data/ops/signal_events_ops.json"
  },

  timeline: {
    granularity: "minute",
    monitoringStartDates: {
      SCENARIO_DEALER_PRICING: "2026-07-15T13:00:00Z"
    },
    deadlineLabel: "Minutes since escalation",
    deadlineField: "minutes_elapsed"
  },

  canvas: {
    kpiLabel: "System health",
    kpiField: "health_score",
    kpiRange: [0, 1],
    kpiThresholdValue: 0.5,
    kpiThresholdLabel: "Incident threshold",
    nodeSpacingPx: 200,
    compressAfterCount: 4,
    toolSourceSystemMap: {
      query_slack:              "Slack",
      query_github:             "GitHub Enterprise",
      query_splunk:             "Splunk",
      query_newrelic:           "New Relic",
      query_aws:                "AWS",
      query_sqs:                "AWS SQS",
      query_cloudwatch:         "AWS CloudWatch",
      query_tickets:            "Jira",
      search_prior_incidents:   "Incident History",
      get_service_status:       "Service Registry",
      get_service_dependencies: "Dependency Map",
      get_deploy_history:       "GitHub Enterprise",
      get_infrastructure:       "AWS",
      get_sla_status:           "SLA Monitor",
      get_affected_accounts:    "Account Database"
    }
  }
}
