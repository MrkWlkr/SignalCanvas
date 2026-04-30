import type { AssertionDefinition, AssertionResult } from "@/types";
import { mobilityConfig, type DomainConfig } from "../domain-config";

// ─── ASSERTION DEFINITIONS ──────────────────────────────────────

export const TC001_ASSERTIONS: AssertionDefinition[] = [
  {
    id: "TC001-A01",
    label: "Event 1 — Agent defers judgment on single intake signal",
    event_index: 0,
    field: "human_review_required",
    operator: "equals",
    expected: false,
    type: "negative",
    explanation: "A single intake signal with 65 days buffer should not trigger human review. Firing here would be a false positive."
  },
  {
    id: "TC001-A02",
    label: "Event 1 — Confidence appropriately low on single signal",
    event_index: 0,
    field: "confidence",
    operator: "less_than",
    expected: 0.50,
    type: "threshold",
    explanation: "Agent should not be highly confident after seeing only the intake signal. Over-confidence on insufficient evidence is a calibration failure."
  },
  {
    id: "TC001-A03",
    label: "Event 2 — No intervention on single external change",
    event_index: 1,
    field: "human_review_required",
    operator: "equals",
    expected: false,
    type: "negative",
    explanation: "A compressed buffer alone is concerning but not intervention-worthy. Firing here would generate alert fatigue."
  },
  {
    id: "TC001-A04",
    label: "Event 3 — Intervention fires when two signals converge",
    event_index: 2,
    field: "human_review_required",
    operator: "equals",
    expected: true,
    type: "positive",
    explanation: "Compressed buffer PLUS processing suspended = HIGH impact, PARTIAL reversibility. This is the correct intervention point."
  },
  {
    id: "TC001-A05",
    label: "Event 3 — Impact correctly assessed as high",
    event_index: 2,
    field: "impact_magnitude",
    operator: "equals",
    expected: "high",
    type: "positive",
    explanation: "Two corroborating signals with start date at risk should produce HIGH impact assessment."
  },
  {
    id: "TC001-A06",
    label: "Event 4 — Risk reduces after human intervention",
    event_index: 3,
    field: "impact_magnitude",
    operator: "not_equals",
    expected: "critical",
    type: "negative",
    explanation: "After human approved document submission, situation is recovering. Critical assessment would indicate agent is not updating on new information."
  }
];

export const TC002_ASSERTIONS: AssertionDefinition[] = [
  {
    id: "TC002-A01",
    label: "Event 1 — Agent issues human action with stable ID",
    event_index: 0,
    field: "human_actions_required",
    operator: "length_greater_than",
    expected: 0,
    type: "positive",
    explanation: "Document request requires a human action — submit the employer support letter within 10 days. Agent must issue this with a stable req_NNN ID."
  },
  {
    id: "TC002-A02",
    label: "Event 2 — Deadline miss triggers missed_prior_actions",
    event_index: 1,
    field: "missed_prior_actions",
    operator: "length_greater_than",
    expected: 0,
    type: "positive",
    explanation: "The document submission deadline passed without action. Agent must reference the prior req_NNN ID in missed_prior_actions. This is the core accountability assertion."
  },
  {
    id: "TC002-A03",
    label: "Event 2 — Prior action NOT marked resolved",
    event_index: 1,
    field: "resolves_prior_actions",
    operator: "length_equals",
    expected: 0,
    type: "negative",
    explanation: "Nothing was resolved — the deadline was missed. resolves_prior_actions must be empty. A false resolution would corrupt the audit trail."
  },
  {
    id: "TC002-A04",
    label: "Event 3 — Cascade correctly attributed",
    event_index: 2,
    field: "causal_chain",
    operator: "length_greater_than",
    expected: 1,
    type: "positive",
    explanation: "By event 3, the agent should be tracking a causal chain — the document miss led to continued suspension which is contributing to the current situation."
  },
  {
    id: "TC002-A05",
    label: "Event 4 — Downstream cascade referenced in reasoning",
    event_index: 3,
    field: "downstream_dependencies",
    operator: "length_greater_than",
    expected: 0,
    type: "positive",
    explanation: "The payroll block is a direct downstream consequence of the approval delay. Agent should identify this dependency chain explicitly."
  },
  {
    id: "TC002-A06",
    label: "Event 4 — Confidence reflects accumulated evidence",
    event_index: 3,
    field: "confidence",
    operator: "greater_than",
    expected: 0.75,
    type: "threshold",
    explanation: "By event 4 with three confirmed blockers and a cascade, confidence should be high. Low confidence here indicates the agent isn't properly synthesizing accumulated evidence."
  }
];

// ─── DOMAIN CONFIGS ─────────────────────────────────────────────

export const tc001Config: DomainConfig = {
  ...mobilityConfig,
  id: "test",
  domainName: "Behavioral Test Suite",
  scenarioLabel: "TC-001 — Intervention Timing",
  isTestCase: true,
  testCaseId: "TC-001",
  testCaseTitle: "Intervention Timing",
  testCaseDescription: "Validates agent triggers human review at correct threshold — not on single signals (false positive) and not after cascade has begun (missed escalation).",
  propertyUnderTest: "Human review trigger accuracy",
  assertions: TC001_ASSERTIONS,
  timeline: {
    ...mobilityConfig.timeline,
    monitoringStartDates: {
      SCENARIO_TC001: "2026-06-27"
    }
  },
  scenarioPaths: {
    SCENARIO_TC001: {
      default: "data/mobility/signal_events_tests.json"
    }
  }
};

export const tc002Config: DomainConfig = {
  ...mobilityConfig,
  id: "test",
  domainName: "Behavioral Test Suite",
  scenarioLabel: "TC-002 — Missed Action Accountability",
  isTestCase: true,
  testCaseId: "TC-002",
  testCaseTitle: "Missed Action Accountability",
  testCaseDescription: "Validates agent correctly identifies when a prior human-required action was not taken, references the original recommendation ID in missed_prior_actions, and traces the downstream cascade to its root cause.",
  propertyUnderTest: "Audit trail integrity and missed action detection",
  assertions: TC002_ASSERTIONS,
  timeline: {
    ...mobilityConfig.timeline,
    monitoringStartDates: {
      SCENARIO_TC002: "2026-07-13"
    }
  },
  scenarioPaths: {
    SCENARIO_TC002: {
      default: "data/mobility/signal_events_tests.json"
    }
  }
};

// ─── LEGACY BUNDLE (for reference) ──────────────────────────────

export const testSuiteConfig = {
  TC001: {
    scenarioId: "SCENARIO_TC001",
    testCaseId: "TC-001",
    title: "Intervention Timing",
    description: "Validates agent triggers human review at correct threshold — not on single signals (false positive) and not after cascade has begun (missed escalation).",
    property_under_test: "Human review trigger accuracy",
    expected_intervention_event: 2,
    event_count: 4,
    assertions: TC001_ASSERTIONS,
    domainConfig: tc001Config
  },
  TC002: {
    scenarioId: "SCENARIO_TC002",
    testCaseId: "TC-002",
    title: "Missed Action Accountability",
    description: "Validates agent correctly identifies when a prior human-required action was not taken, references the original recommendation ID in missed_prior_actions, and traces the downstream cascade to its root cause.",
    property_under_test: "Audit trail integrity and missed action detection",
    expected_missed_action_event: 1,
    event_count: 4,
    assertions: TC002_ASSERTIONS,
    domainConfig: tc002Config
  }
};

// ─── ASSERTION EVALUATOR ────────────────────────────────────────
// Pure function — no domain knowledge, works for any assertion set

export function evaluateAssertions(
  assertions: AssertionDefinition[],
  evaluations: Record<number, Record<string, unknown>>
): AssertionResult[] {
  return assertions.map(assertion => {
    const evaluation = evaluations[assertion.event_index];
    if (!evaluation) {
      return {
        id: assertion.id,
        label: assertion.label,
        status: "pending" as const,
        expected: assertion.expected,
        actual: undefined,
        explanation: assertion.explanation,
        type: assertion.type
      };
    }

    const actual = evaluation[assertion.field];
    let pass = false;

    switch (assertion.operator) {
      case "equals":
        pass = actual === assertion.expected;
        break;
      case "not_equals":
        pass = actual !== assertion.expected;
        break;
      case "greater_than":
        pass = (actual as number) > (assertion.expected as number);
        break;
      case "less_than":
        pass = (actual as number) < (assertion.expected as number);
        break;
      case "length_greater_than":
        pass = Array.isArray(actual) &&
          actual.length > (assertion.expected as number);
        break;
      case "length_equals":
        pass = Array.isArray(actual) &&
          actual.length === (assertion.expected as number);
        break;
      case "includes":
        pass = Array.isArray(actual) &&
          actual.includes(assertion.expected);
        break;
    }

    return {
      id: assertion.id,
      label: assertion.label,
      status: pass ? "pass" as const : "fail" as const,
      expected: assertion.expected,
      actual,
      explanation: assertion.explanation,
      type: assertion.type
    };
  });
}
