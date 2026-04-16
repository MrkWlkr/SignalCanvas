export interface ToolCallTrace {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_result: unknown;
}

export interface RiskEvaluation {
  risk_level: "low" | "medium" | "high" | "critical";
  confidence: number;
  affected_domains: string[];
  recommended_actions: string[];
  reasoning_summary: string;
  next_checks: string[];
}

export interface EvaluationRecord {
  event_index: number;
  event_id: string;
  event_type: string;
  timestamp: string; // ISO string
  evaluation: RiskEvaluation;
  tool_trace: ToolCallTrace[];
}

export interface ScenarioState {
  scenarioId: string;
  currentEventIndex: number;
  totalEvents: number;
  evaluations: EvaluationRecord[];
}

// Anchor to global so Next.js HMR doesn't reset the Map between hot reloads
const globalRef = global as typeof globalThis & {
  scenarioStates?: Map<string, ScenarioState>;
};
if (!globalRef.scenarioStates) {
  globalRef.scenarioStates = new Map<string, ScenarioState>();
}
const scenarioStates = globalRef.scenarioStates;

export function getState(scenarioId: string): ScenarioState | undefined {
  return scenarioStates.get(scenarioId);
}

export function initState(scenarioId: string, totalEvents: number): ScenarioState {
  const existing = scenarioStates.get(scenarioId);
  if (existing) return existing;
  const fresh: ScenarioState = {
    scenarioId,
    currentEventIndex: 0,
    totalEvents,
    evaluations: [],
  };
  scenarioStates.set(scenarioId, fresh);
  return fresh;
}

export function recordEvaluation(
  scenarioId: string,
  totalEvents: number,
  record: EvaluationRecord
): ScenarioState {
  let state = scenarioStates.get(scenarioId);
  if (!state) {
    state = { scenarioId, currentEventIndex: 0, totalEvents, evaluations: [] };
  }
  state.evaluations.push(record);
  state.currentEventIndex = record.event_index + 1;
  state.totalEvents = totalEvents;
  scenarioStates.set(scenarioId, state);
  return state;
}

export function resetState(scenarioId: string, totalEvents: number): ScenarioState {
  const fresh: ScenarioState = {
    scenarioId,
    currentEventIndex: 0,
    totalEvents,
    evaluations: [],
  };
  scenarioStates.set(scenarioId, fresh);
  return fresh;
}
