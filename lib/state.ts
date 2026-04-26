import type {
  EvaluatorOutput,
  EvaluationRecord,
  HumanDecision,
  PendingIntervention,
  ActionRegisterEntry,
} from "@/types";

export interface ScenarioState {
  scenarioId: string;
  currentEventIndex: number;
  totalEvents: number;
  currentPath: string;
  evaluations: EvaluationRecord[];
  pendingIntervention: PendingIntervention | null;
  // Living action register — maintained across evaluations
  actionRegister: ActionRegisterEntry[];
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
    actionRegister: [],
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
      actionRegister: [],
    };
  }
  state.evaluations.push(record);
  state.currentEventIndex = record.event_index + 1;
  state.totalEvents = totalEvents;
  scenarioStates.set(scenarioId, state);
  return state;
}

// Records a pending-human-review evaluation WITHOUT advancing the event index
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
      actionRegister: [],
    };
  }
  state.evaluations.push(record);
  state.pendingIntervention = pending;
  state.totalEvents = totalEvents;
  scenarioStates.set(scenarioId, state);
  return state;
}

// Resolves a pending intervention
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

  const recordIdx = state.evaluations.findIndex((r) => r.event_index === event_index);
  if (recordIdx !== -1) {
    state.evaluations[recordIdx] = {
      ...state.evaluations[recordIdx],
      status: "human_reviewed",
      human_decision: humanDecision,
    };
  }

  if (newPath !== null) {
    state.currentPath = newPath;
    state.totalEvents = newTotalEvents;
  }

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
    actionRegister: [],
  };
  scenarioStates.set(scenarioId, fresh);
  return fresh;
}

// ─────────────────────────────────────────────────────────────────────────────
// Action register — maintained across evaluations, domain-agnostic
// ─────────────────────────────────────────────────────────────────────────────

// Update the living action register after each evaluation.
// Also snapshots the resulting register state onto the evaluation record
// so time-contextual queries don't need to replay history.
export function updateActionRegister(
  scenarioId: string,
  evaluation: EvaluatorOutput,
  eventIndex: number,
  eventDate: string,
  resolvedByHuman?: string[]
): void {
  const state = scenarioStates.get(scenarioId);
  if (!state) return;

  const register = state.actionRegister;

  // 1. Add new human_actions_required items that are not already in the register
  for (const req of evaluation.human_actions_required) {
    const exists = register.some((e) => e.id === req.id);
    if (!exists) {
      register.push({
        id: req.id,
        action: req.action,
        owner: req.owner,
        deadline: req.deadline,
        consequence: req.consequence,
        urgency: req.urgency,
        status: "active",
        issued_at_event_index: eventIndex,
        issued_at_date: eventDate,
      });
    }
  }

  // 2. Mark system-resolved entries (also recovers previously "missed" entries when
  //    a subsequent signal confirms the action was eventually completed)
  for (const id of evaluation.resolves_prior_actions) {
    const entry = register.find((e) => e.id === id);
    if (entry && (entry.status === "active" || entry.status === "missed")) {
      entry.status = "resolved_system";
      entry.resolved_by = "system_event";
      entry.resolved_at = eventDate;
      entry.resolution_evidence = evaluation.reasoning_summary.split(".")[0] + ".";
    }
  }

  // 3. Mark missed entries
  for (const id of evaluation.missed_prior_actions) {
    const entry = register.find((e) => e.id === id);
    if (entry && entry.status === "active") {
      const matchingReq = evaluation.human_actions_required.find((r) => r.id === id);
      const consequence = matchingReq?.consequence ?? entry.consequence;
      entry.status = "missed";
      entry.resolved_at = eventDate;
      entry.resolution_evidence = `Consequence confirmed: ${consequence}`;
    }
  }

  // 4. Mark superseded entries
  for (const id of evaluation.supersedes_prior_actions) {
    const entry = register.find((e) => e.id === id);
    if (entry && entry.status === "active") {
      entry.status = "superseded";
      entry.resolved_by = "agent_superseded";
      entry.resolved_at = eventDate;
    }
  }

  // 5. Mark human-resolved entries (from intervene route)
  if (resolvedByHuman) {
    for (const id of resolvedByHuman) {
      const entry = register.find((e) => e.id === id);
      if (entry && entry.status === "active") {
        entry.status = "resolved_human";
        entry.resolved_by = "human_decision";
        entry.resolved_at = eventDate;
      }
    }
  }

  // 6. Snapshot current register state onto the evaluation record for time-travel
  const recordIdx = state.evaluations.findIndex((r) => r.event_index === eventIndex);
  if (recordIdx !== -1) {
    state.evaluations[recordIdx] = {
      ...state.evaluations[recordIdx],
      registerSnapshot: register.map((e) => ({ ...e })),
    };
  }

  scenarioStates.set(scenarioId, state);
}

// Returns register entries with their status as it was at the given event index.
// Uses the snapshot stored on the evaluation record for O(1) time-travel.
export function getRegisterAtEventIndex(
  scenarioId: string,
  eventIndex: number
): ActionRegisterEntry[] {
  const state = scenarioStates.get(scenarioId);
  if (!state) return [];

  // Find the evaluation record for this event index
  const record = state.evaluations.find((r) => r.event_index === eventIndex);
  if (record?.registerSnapshot) {
    return record.registerSnapshot;
  }

  // Fallback: filter by issued_at_event_index if snapshot not yet available
  return state.actionRegister.filter((e) => e.issued_at_event_index <= eventIndex);
}

// Returns the full living action register for a scenario
export function getActionRegister(scenarioId: string): ActionRegisterEntry[] {
  return scenarioStates.get(scenarioId)?.actionRegister ?? [];
}

// Re-export types needed by route files
export type { EvaluatorOutput, EvaluationRecord, HumanDecision, PendingIntervention };
