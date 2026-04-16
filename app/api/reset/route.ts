import { NextRequest, NextResponse } from "next/server";
import { resetState } from "@/lib/state";
import { loadSignalEvents } from "@/lib/data";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { scenarioId } = body as { scenarioId: string };

  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId is required" }, { status: 400 });
  }

  const allEvents = loadSignalEvents();
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
    evaluation_count: state.evaluations.length,
  });
}
