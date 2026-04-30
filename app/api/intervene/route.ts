import { NextRequest, NextResponse } from "next/server";
import { getConfigForScenario } from "@/lib/config-registry";
import { getState, resolveIntervention, updateActionRegister } from "@/lib/state";
import { loadSignalEventsFromPath } from "@/lib/data";
import { formatEventDate } from "@/lib/dates";
import type { HumanDecision } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiter — 40 calls per IP per hour, global singleton (survives HMR)
// ─────────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitRef = global as typeof globalThis & {
  interveneRateLimit?: Map<string, RateLimitEntry>;
};
if (!rateLimitRef.interveneRateLimit) {
  rateLimitRef.interveneRateLimit = new Map<string, RateLimitEntry>();
}
const rateLimitStore = rateLimitRef.interveneRateLimit;

const RATE_LIMIT_MAX = 40;
const RATE_LIMIT_WINDOW_MS = 3_600_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

// POST /api/intervene
// Handles the human's response to a pending intervention.
// Reads all option behaviour from domainConfig — zero domain-specific logic here.

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Demo rate limit reached. Please try again in an hour." },
      { status: 429 }
    );
  }

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

  const domainConfig = getConfigForScenario(scenarioId);

  // 1. Verify there is a pending intervention to resolve
  const currentState = getState(scenarioId);
  if (!currentState?.pendingIntervention) {
    return NextResponse.json(
      { error: "No pending intervention found for this scenario" },
      { status: 400 }
    );
  }

  // 2. Look up the selected option from config
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

  // 5. Compute event date for the intervention event
  const pendingIntervention = currentState.pendingIntervention;
  const currentPath = currentState.currentPath;
  const eventsFilePath =
    domainConfig.scenarioPaths[scenarioId]?.[currentPath] ??
    domainConfig.scenarioPaths[scenarioId]?.["default"];

  let eventDate = new Date().toISOString().split("T")[0];
  if (eventsFilePath) {
    const allEvents = loadSignalEventsFromPath(eventsFilePath);
    const scenarioEvents = allEvents.filter((e) => e.scenario_id === scenarioId);
    const interventionEvent = scenarioEvents[pendingIntervention.event_index];
    if (interventionEvent) {
      const monitoringStartDate =
        domainConfig.timeline.monitoringStartDates[scenarioId] ??
        new Date().toISOString().split("T")[0];
      eventDate = formatEventDate(
        monitoringStartDate,
        interventionEvent.day_offset ?? 0,
        domainConfig.timeline.granularity
      ).primary;
    }
  }

  // 6. If human approved, mark the pending human_actions_required as resolved
  const pendingEval = pendingIntervention.evaluation;
  if (option_id === "approve" && pendingEval.human_actions_required.length > 0) {
    const humanResolvedIds = pendingEval.human_actions_required.map((r) => r.id);
    updateActionRegister(
      scenarioId,
      pendingEval,
      pendingIntervention.event_index,
      eventDate,
      humanResolvedIds
    );
  }

  // 7. Resolve: update evaluation record, switch path, advance index
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
