import { NextRequest, NextResponse } from "next/server";
import { getState, initState, getAssertionResults } from "@/lib/state";
import { loadSignalEventsFromPath } from "@/lib/data";
import { getConfigForScenario } from "@/lib/config-registry";


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get("scenarioId") ?? "SCENARIO_ESCALATING";

  const existingState = getState(scenarioId);
  const currentPath = existingState?.currentPath ?? "default";
  const domainConfig = getConfigForScenario(scenarioId);

  // Derive total events from the current path's file
  const eventsFilePath =
    domainConfig.scenarioPaths[scenarioId]?.[currentPath] ??
    domainConfig.scenarioPaths[scenarioId]?.["default"];

  const totalEvents = eventsFilePath
    ? loadSignalEventsFromPath(eventsFilePath).filter(
        (e) => e.scenario_id === scenarioId
      ).length
    : 0;

  const state = existingState ?? initState(scenarioId, totalEvents);

  const latest =
    state.evaluations.length > 0
      ? state.evaluations[state.evaluations.length - 1]
      : null;

  return NextResponse.json({
    scenario_id: state.scenarioId,
    current_event_index: state.currentEventIndex,
    total_events: state.totalEvents,
    complete: state.currentEventIndex >= state.totalEvents,
    evaluation_count: state.evaluations.length,
    latest_evaluation: latest,
    evaluations: state.evaluations,
    current_path: state.currentPath,
    pending_intervention: state.pendingIntervention,
    action_register: state.actionRegister,
    assertion_results: getAssertionResults(scenarioId),
  });
}
