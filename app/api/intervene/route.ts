import { NextRequest, NextResponse } from "next/server";
import { domainConfig } from "@/lib/domain-config";
import { getState, resolveIntervention } from "@/lib/state";
import { loadSignalEventsFromPath } from "@/lib/data";
import type { HumanDecision } from "@/types";

// POST /api/intervene
// Handles the human's response to a pending intervention.
// Reads all option behaviour from domainConfig — zero domain-specific logic here.

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { scenarioId, decision_id, option_id, modified_actions } = body as {
    scenarioId: string;
    decision_id?: string;
    option_id: string;
    modified_actions?: string[];
  };

  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId is required" }, { status: 400 });
  }
  if (!option_id) {
    return NextResponse.json({ error: "option_id is required" }, { status: 400 });
  }

  // 1. Verify there is a pending intervention to resolve
  const currentState = getState(scenarioId);
  if (!currentState?.pendingIntervention) {
    return NextResponse.json(
      { error: "No pending intervention found for this scenario" },
      { status: 400 }
    );
  }

  // 2. Look up the selected option from config (generic — works for any domain)
  const option = domainConfig.interventionOptions.find((o) => o.id === option_id);
  if (!option) {
    return NextResponse.json(
      { error: `Unknown option_id: ${option_id}` },
      { status: 400 }
    );
  }

  // 3. Build the human decision record
  const humanDecision: HumanDecision = {
    option_id: option.id,
    option_label: option.label,
    decision_id: decision_id,
    modified_actions: modified_actions,
    timestamp: new Date().toISOString(),
  };

  // 4. Determine new path and compute new totalEvents for that path
  const newPath = option.path;
  let newTotalEvents = currentState.totalEvents;

  if (newPath !== null) {
    const newFilePath =
      domainConfig.scenarioPaths[scenarioId]?.[newPath] ??
      domainConfig.scenarioPaths[scenarioId]?.["default"];

    if (newFilePath) {
      const newEvents = loadSignalEventsFromPath(newFilePath);
      newTotalEvents = newEvents.filter((e) => e.scenario_id === scenarioId).length;
    }
  }

  // 5. Resolve: update evaluation record, switch path, advance index
  const updatedState = resolveIntervention(
    scenarioId,
    humanDecision,
    newPath,
    newTotalEvents
  );

  return NextResponse.json({
    resolved: true,
    scenario_id: updatedState.scenarioId,
    option_id: option.id,
    option_label: option.label,
    path_switched: newPath !== null,
    current_path: updatedState.currentPath,
    current_event_index: updatedState.currentEventIndex,
    total_events: updatedState.totalEvents,
    complete: updatedState.currentEventIndex >= updatedState.totalEvents,
  });
}
