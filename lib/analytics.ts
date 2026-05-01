// Pure analytics derivation functions — no server-side state access.
// All inputs come from StateApiResponse (already available client-side).
// Domain-agnostic: reads KPI field name and threshold from DomainConfig.

import type { StateApiResponse } from "@/types";
import type { DomainConfig } from "@/lib/domain-config";
import { configRegistry } from "@/lib/config-registry";

const RISK_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export interface ScenarioAnalytics {
  scenarioId: string;
  domainId: string;
  domainName: string;
  scenarioLabel: string;
  eventsProcessed: number;
  totalEvents: number;
  isComplete: boolean;

  // Agent behavior
  autonomousDecisions: number;
  humanReviewTriggered: number;
  interventionsResolved: number;
  overridesRecorded: number;
  autonomousRate: number;

  // Risk profile
  startingRisk: string;
  startingConfidence: number;
  peakRisk: string;
  peakConfidence: number;
  finalRisk: string;
  finalConfidence: number;

  // KPI arc (for sparkline)
  kpiArc: {
    eventIndex: number;
    eventType: string;
    kpiValue: number;
    riskLevel: string;
  }[];

  // Action register summary
  totalActionsIssued: number;
  resolvedByHuman: number;
  resolvedBySystem: number;
  missed: number;
  active: number;
  superseded: number;

  // API usage
  totalApiCalls: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalTokens: number;
  totalCostEstimate: number;
  avgTokensPerCall: number;
  avgLatencyMs: number;
}

export interface AllAnalytics {
  perScenario: Record<string, ScenarioAnalytics>;
  domainGroups: Record<string, ScenarioAnalytics[]>; // keyed by config.id
  totals: {
    totalApiCalls: number;
    totalTokens: number;
    totalCostEstimate: number;
    scenariosRun: number;
    eventsProcessed: number;
    interventions: number;
    overrides: number;
  };
}

export function deriveScenarioAnalytics(
  stateData: StateApiResponse | null,
  config: DomainConfig
): ScenarioAnalytics | null {
  if (!stateData || stateData.evaluations.length === 0) return null;

  const evals = stateData.evaluations;
  const register = stateData.action_register ?? [];

  // Agent behavior
  const autonomousDecisions = evals.filter((e) => !e.evaluation.human_review_required).length;
  const humanReviewTriggered = evals.filter((e) => e.evaluation.human_review_required).length;
  const humanReviewedEvals = evals.filter((e) => e.status === "human_reviewed");
  const interventionsResolved = humanReviewedEvals.filter(
    (e) => e.human_decision?.option_id !== "override"
  ).length;
  const overridesRecorded = humanReviewedEvals.filter(
    (e) => e.human_decision?.option_id === "override"
  ).length;
  const total = evals.length;
  const autonomousRate = total > 0 ? autonomousDecisions / total : 0;

  // Risk profile
  const startingEval = evals[0].evaluation;
  const finalEval = evals[evals.length - 1].evaluation;
  let peakRisk = startingEval.risk_level;
  let peakConfidence = startingEval.confidence ?? 0;
  for (const e of evals) {
    if ((RISK_ORDER[e.evaluation.risk_level] ?? 0) > (RISK_ORDER[peakRisk] ?? 0)) {
      peakRisk = e.evaluation.risk_level;
    }
    if ((e.evaluation.confidence ?? 0) > peakConfidence) {
      peakConfidence = e.evaluation.confidence ?? 0;
    }
  }

  // KPI arc
  const kpiField = config.canvas.kpiField;
  const kpiArc = evals.map((e) => ({
    eventIndex: e.event_index,
    eventType: e.event_type,
    kpiValue: Number((e.evaluation as unknown as Record<string, unknown>)[kpiField] ?? 0),
    riskLevel: e.evaluation.risk_level,
  }));

  // Action register summary
  const resolvedByHuman = register.filter((r) => r.status === "resolved_human").length;
  const resolvedBySystem = register.filter((r) => r.status === "resolved_system").length;
  const missed = register.filter((r) => r.status === "missed").length;
  const active = register.filter((r) => r.status === "active").length;
  const superseded = register.filter((r) => r.status === "superseded").length;

  // API usage — only count evals that have captured metadata
  const usageEvals = evals.filter((e) => e.usage_metadata != null);
  const totalApiCalls = evals.length;
  const totalTokensInput = usageEvals.reduce((s, e) => s + (e.usage_metadata!.tokens_input), 0);
  const totalTokensOutput = usageEvals.reduce((s, e) => s + (e.usage_metadata!.tokens_output), 0);
  const totalTokens = totalTokensInput + totalTokensOutput;
  const totalCostRaw = usageEvals.reduce((s, e) => s + (e.usage_metadata!.cost_estimate), 0);
  const totalCostEstimate = Math.round(totalCostRaw * 10000) / 10000;
  const avgTokensPerCall = usageEvals.length > 0 ? Math.round(totalTokens / usageEvals.length) : 0;
  const totalLatency = usageEvals.reduce((s, e) => s + (e.usage_metadata!.latency_ms), 0);
  const avgLatencyMs = usageEvals.length > 0 ? Math.round(totalLatency / usageEvals.length) : 0;

  return {
    scenarioId: stateData.scenario_id,
    domainId: config.id,
    domainName: config.domainName,
    scenarioLabel: config.scenarioLabel,
    eventsProcessed: stateData.current_event_index,
    totalEvents: stateData.total_events,
    isComplete: stateData.complete,

    autonomousDecisions,
    humanReviewTriggered,
    interventionsResolved,
    overridesRecorded,
    autonomousRate,

    startingRisk: startingEval.risk_level,
    startingConfidence: startingEval.confidence ?? 0,
    peakRisk,
    peakConfidence,
    finalRisk: finalEval.risk_level,
    finalConfidence: finalEval.confidence ?? 0,

    kpiArc,

    totalActionsIssued: register.length,
    resolvedByHuman,
    resolvedBySystem,
    missed,
    active,
    superseded,

    totalApiCalls,
    totalTokensInput,
    totalTokensOutput,
    totalTokens,
    totalCostEstimate,
    avgTokensPerCall,
    avgLatencyMs,
  };
}

// Aggregate multiple scenarios (e.g. two test cases in the same domain)
export function aggregateScenarioAnalytics(list: ScenarioAnalytics[]): ScenarioAnalytics {
  if (list.length === 0) throw new Error("Cannot aggregate empty list");
  if (list.length === 1) return list[0];
  const first = list[0];
  const last = list[list.length - 1];
  const totalDecisions = list.reduce((s, a) => s + a.autonomousDecisions + a.humanReviewTriggered, 0);
  const totalAuto = list.reduce((s, a) => s + a.autonomousDecisions, 0);
  const totalCalls = list.reduce((s, a) => s + a.totalApiCalls, 0);
  const totalTok = list.reduce((s, a) => s + a.totalTokens, 0);
  return {
    ...last,
    eventsProcessed: list.reduce((s, a) => s + a.eventsProcessed, 0),
    autonomousDecisions: totalAuto,
    humanReviewTriggered: list.reduce((s, a) => s + a.humanReviewTriggered, 0),
    interventionsResolved: list.reduce((s, a) => s + a.interventionsResolved, 0),
    overridesRecorded: list.reduce((s, a) => s + a.overridesRecorded, 0),
    autonomousRate: totalDecisions > 0 ? totalAuto / totalDecisions : 0,
    totalActionsIssued: list.reduce((s, a) => s + a.totalActionsIssued, 0),
    resolvedByHuman: list.reduce((s, a) => s + a.resolvedByHuman, 0),
    resolvedBySystem: list.reduce((s, a) => s + a.resolvedBySystem, 0),
    missed: list.reduce((s, a) => s + a.missed, 0),
    active: list.reduce((s, a) => s + a.active, 0),
    superseded: list.reduce((s, a) => s + a.superseded, 0),
    totalApiCalls: totalCalls,
    totalTokensInput: list.reduce((s, a) => s + a.totalTokensInput, 0),
    totalTokensOutput: list.reduce((s, a) => s + a.totalTokensOutput, 0),
    totalTokens: totalTok,
    totalCostEstimate: Math.round(list.reduce((s, a) => s + a.totalCostEstimate, 0) * 10000) / 10000,
    avgTokensPerCall: totalCalls > 0 ? Math.round(totalTok / totalCalls) : 0,
    avgLatencyMs: Math.round(list.reduce((s, a) => s + a.avgLatencyMs, 0) / list.length),
    // Use first scenario's start, last scenario's final/peak
    startingRisk: first.startingRisk,
    startingConfidence: first.startingConfidence,
    kpiArc: last.kpiArc,
  };
}

export function deriveAllAnalytics(
  allStateData: Record<string, StateApiResponse | null>
): AllAnalytics {
  const perScenario: Record<string, ScenarioAnalytics> = {};
  const domainGroups: Record<string, ScenarioAnalytics[]> = {};

  for (const [scenarioId, stateData] of Object.entries(allStateData)) {
    if (!stateData) continue;
    const config = configRegistry[scenarioId];
    if (!config) continue;
    const analytics = deriveScenarioAnalytics(stateData, config);
    if (!analytics) continue;

    perScenario[scenarioId] = analytics;
    if (!domainGroups[analytics.domainId]) domainGroups[analytics.domainId] = [];
    domainGroups[analytics.domainId].push(analytics);
  }

  const all = Object.values(perScenario);
  const totals = {
    totalApiCalls: all.reduce((s, a) => s + a.totalApiCalls, 0),
    totalTokens: all.reduce((s, a) => s + a.totalTokens, 0),
    totalCostEstimate: Math.round(all.reduce((s, a) => s + a.totalCostEstimate, 0) * 10000) / 10000,
    scenariosRun: all.filter((a) => a.eventsProcessed > 0).length,
    eventsProcessed: all.reduce((s, a) => s + a.eventsProcessed, 0),
    interventions: all.reduce((s, a) => s + a.humanReviewTriggered, 0),
    overrides: all.reduce((s, a) => s + a.overridesRecorded, 0),
  };

  return { perScenario, domainGroups, totals };
}
