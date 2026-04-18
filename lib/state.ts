import type {
  EvaluatorOutput,
  EvaluationRecord,
  HumanDecision,
  PendingIntervention,
} from "@/types";

export interface ScenarioState {
  scenarioId: string;
  currentEventIndex: number;
  totalEvents: number;
  currentPath: string;
  evaluations: EvaluationRecord[];
  pendingIntervention: PendingIntervention | null;
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
    currentPath: "default",
    evaluations: [],
    pendingIntervention: null,
  };
  scenarioStates.set(scenarioId, fresh);
  return fresh;
}

// Records an autonomous evaluation and advances the event index
export function recordEvaluation(
  scenarioId: string,
  totalEvents: number,
  record: EvaluationRecord
): ScenarioState {
  let state = scenarioStates.get(scenarioId);
  if (!state) {
    state = {
      scenarioId,
      currentEventIndex: 0,
      totalEvents,
      currentPath: "default",
      evaluations: [],
      pendingIntervention: null,
    };
  }
  state.evaluations.push(record);
  state.currentEventIndex = record.event_index + 1;
  state.totalEvents = totalEvents;
  scenarioStates.set(scenarioId, state);
  return state;
}

// Records a pending-human-review evaluation WITHOUT advancing the event index,
// and sets pendingIntervention. The agent is paused until resolveIntervention is called.
export function recordPendingIntervention(
  scenarioId: string,
  totalEvents: number,
  record: EvaluationRecord,
  pending: PendingIntervention
): ScenarioState {
  let state = scenarioStates.get(scenarioId);
  if (!state) {
    state = {
      scenarioId,
      currentEventIndex: record.event_index,
      totalEvents,
      currentPath: "default",
      evaluations: [],
      pendingIntervention: null,
    };
  }
  state.evaluations.push(record);
  state.pendingIntervention = pending;
  state.totalEvents = totalEvents;
  // currentEventIndex intentionally NOT advanced — agent is paused at this event
  scenarioStates.set(scenarioId, state);
  return state;
}

// Resolves a pending intervention:
// - Updates the pending evaluation record with the human's decision
// - Switches path if newPath is non-null
// - Updates totalEvents for the new path
// - Clears pendingIntervention
// - Advances currentEventIndex past the intervention event
export function resolveIntervention(
  scenarioId: string,
  humanDecision: HumanDecision,
  newPath: string | null,
  newTotalEvents: number
): ScenarioState {
  const state = scenarioStates.get(scenarioId);
  if (!state) throw new Error(`No state found for scenario: ${scenarioId}`);
  if (!state.pendingIntervention) throw new Error(`No pending intervention for scenario: ${scenarioId}`);

  const { event_index } = state.pendingIntervention;

  // Update the evaluation record in-place
  const recordIdx = state.evaluations.findIndex((r) => r.event_index === event_index);
  if (recordIdx !== -1) {
    state.evaluations[recordIdx] = {
      ...state.evaluations[recordIdx],
      status: "human_reviewed",
      human_decision: humanDecision,
    };
  }

  // Switch path and update total if requested
  if (newPath !== null) {
    state.currentPath = newPath;
    state.totalEvents = newTotalEvents;
  }

  // Clear pending, advance index
  state.pendingIntervention = null;
  state.currentEventIndex = event_index + 1;

  scenarioStates.set(scenarioId, state);
  return state;
}

export function resetState(scenarioId: string, totalEvents: number): ScenarioState {
  const fresh: ScenarioState = {
    scenarioId,
    currentEventIndex: 0,
    totalEvents,
    currentPath: "default",
    evaluations: [],
    pendingIntervention: null,
  };
  scenarioStates.set(scenarioId, fresh);
  return fresh;
}

// Re-export types needed by route files
export type { EvaluatorOutput, EvaluationRecord, HumanDecision, PendingIntervention };
