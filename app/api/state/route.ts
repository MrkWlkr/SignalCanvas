import { NextRequest, NextResponse } from "next/server";
import { getState, initState } from "@/lib/state";
import { loadSignalEvents } from "@/lib/data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get("scenarioId") ?? "SCENARIO_ESCALATING";

  const allEvents = loadSignalEvents();
  const totalEvents = allEvents.filter((e) => e.scenario_id === scenarioId).length;

  // Return existing state or an empty initial state
  const state = getState(scenarioId) ?? initState(scenarioId, totalEvents);

  const latest = state.evaluations.length > 0
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
  });
}
