import { NextRequest, NextResponse } from "next/server";
import { resetState } from "@/lib/state";
import { loadSignalEventsFromPath } from "@/lib/data";
import { domainConfig } from "@/lib/domain-config";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { scenarioId } = body as { scenarioId: string };

  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId is required" }, { status: 400 });
  }

  // Always reset to the default path
  const defaultFilePath = domainConfig.scenarioPaths[scenarioId]?.["default"];
  if (!defaultFilePath) {
    return NextResponse.json(
      { error: `No scenario configured: ${scenarioId}` },
      { status: 404 }
    );
  }

  const allEvents = loadSignalEventsFromPath(defaultFilePath);
  const totalEvents = allEvents.filter((e) => e.scenario_id === scenarioId).length;

  if (totalEvents === 0) {
    return NextResponse.json(
      { error: `No events found for scenario: ${scenarioId}` },
      { status: 404 }
    );
  }

  const state = resetState(scenarioId, totalEvents);

  return NextResponse.json({
    reset: true,
    scenario_id: state.scenarioId,
    current_event_index: state.currentEventIndex,
    total_events: state.totalEvents,
    current_path: state.currentPath,
    evaluation_count: state.evaluations.length,
  });
}
