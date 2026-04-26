import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { domainConfig } from "@/lib/domain-config";
import { getBaselineContext } from "@/lib/server/baseline-context";
import type { InterventionThresholds, InterventionRule } from "@/lib/domain-config";
import { TOOL_DEFINITIONS, executeTool, getRecentSignals } from "@/lib/tools";
import { loadSignalEventsFromPath } from "@/lib/data";
import {
  recordEvaluation,
  recordPendingIntervention,
  getState,
  updateActionRegister,
  getRegisterAtEventIndex,
  getActionRegister,
} from "@/lib/state";
import type {
  EvaluatorOutput,
  EvaluationRecord,
  ToolCallTrace,
  PendingIntervention,
  AgentActionTaken,
  SurfacedAwareness,
  HumanActionRequired,
} from "@/types";
import { formatEventDate } from "@/lib/dates";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiter — 40 calls per IP per hour, global singleton (survives HMR)
// ─────────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitRef = global as typeof globalThis & {
  advanceRateLimit?: Map<string, RateLimitEntry>;
};
if (!rateLimitRef.advanceRateLimit) {
  rateLimitRef.advanceRateLimit = new Map<string, RateLimitEntry>();
}
const rateLimitStore = rateLimitRef.advanceRateLimit;

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

// ─────────────────────────────────────────────────────────────────────────────
// Generic threshold evaluator — zero mobility-specific logic lives here.
// ─────────────────────────────────────────────────────────────────────────────

function matchesRule(evaluation: EvaluatorOutput, rule: InterventionRule): boolean {
  const rawValue = (evaluation as unknown as Record<string, unknown>)[rule.field];

  switch (rule.operator) {
    case "is": {
      if (Array.isArray(rule.value)) return rule.value.includes(rawValue as string);
      return rawValue === rule.value;
    }
    case "is_not": {
      if (Array.isArray(rule.value)) return !rule.value.includes(rawValue as string);
      return rawValue !== rule.value;
    }
    case "greater_than": {
      const numeric = Array.isArray(rawValue) ? rawValue.length : (rawValue as number);
      return numeric > (rule.value as number);
    }
    case "less_than": {
      const numeric = Array.isArray(rawValue) ? rawValue.length : (rawValue as number);
      return numeric < (rule.value as number);
    }
    case "includes": {
      if (Array.isArray(rawValue)) return rawValue.length > 0;
      if (typeof rawValue === "string") return rawValue.includes(rule.value as string);
      return false;
    }
    default:
      return false;
  }
}

function matchesGroup(evaluation: EvaluatorOutput, group: InterventionRule[]): boolean {
  return group.every((rule) => matchesRule(evaluation, rule));
}

function evaluateInterventionThresholds(
  evaluation: EvaluatorOutput,
  thresholds: InterventionThresholds
): boolean {
  const alwaysReview = thresholds.always_review.some((group) =>
    matchesGroup(evaluation, group)
  );
  if (alwaysReview) return true;

  const isAutonomous = thresholds.autonomous_when.some((group) =>
    matchesGroup(evaluation, group)
  );
  if (isAutonomous) return false;

  const reviewWhen = thresholds.review_when.some((group) =>
    matchesGroup(evaluation, group)
  );
  if (reviewWhen) return true;

  return evaluation.human_review_required;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-object normalizers for the three typed action arrays
// ─────────────────────────────────────────────────────────────────────────────

function normalizeAgentAction(raw: unknown): AgentActionTaken {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const result: AgentActionTaken = {
    id: (r.id as string) ?? "act_unknown",
    action: (r.action as string) ?? "",
    type: (r.type as AgentActionTaken["type"]) ?? "log",
    log_to_register: (r.log_to_register as boolean) ?? false,
    impact_magnitude: (r.impact_magnitude as AgentActionTaken["impact_magnitude"]) ?? "low",
  };
  if (r.regulatory_basis !== undefined) result.regulatory_basis = r.regulatory_basis as string;
  return result;
}

function normalizeSurfacedAwareness(raw: unknown): SurfacedAwareness {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const result: SurfacedAwareness = {
    id: (r.id as string) ?? "obs_unknown",
    observation: (r.observation as string) ?? "",
    relevance: (r.relevance as string) ?? "",
    horizon: (r.horizon as SurfacedAwareness["horizon"]) ?? "immediate",
  };
  if (r.clinical_basis !== undefined) result.clinical_basis = r.clinical_basis as string;
  return result;
}

function normalizeHumanAction(raw: unknown): HumanActionRequired {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const result: HumanActionRequired = {
    id: (r.id as string) ?? "req_unknown",
    action: (r.action as string) ?? "",
    owner: (r.owner as string) ?? "",
    deadline: (r.deadline as string) ?? "",
    consequence: (r.consequence as string) ?? "",
    urgency: (r.urgency as HumanActionRequired["urgency"]) ?? "monitor",
  };
  if (r.patient_impact !== undefined) result.patient_impact = r.patient_impact as string;
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalise raw Claude JSON into a fully-typed EvaluatorOutput with defaults
// ─────────────────────────────────────────────────────────────────────────────

function normalizeEvaluatorOutput(raw: Record<string, unknown>): EvaluatorOutput {
  return {
    risk_level: (raw.risk_level as EvaluatorOutput["risk_level"]) ?? "medium",
    confidence: (raw.confidence as number) ?? 0.5,
    affected_domains: Array.isArray(raw.affected_domains) ? (raw.affected_domains as string[]) : [],
    recommended_actions: [],
    reasoning_summary: (raw.reasoning_summary as string) ?? "",
    next_checks: Array.isArray(raw.next_checks) ? (raw.next_checks as string[]) : [],
    decision_type:
      (raw.decision_type as EvaluatorOutput["decision_type"]) ?? "recommendation",
    impact_magnitude:
      (raw.impact_magnitude as EvaluatorOutput["impact_magnitude"]) ?? "medium",
    reversibility:
      (raw.reversibility as EvaluatorOutput["reversibility"]) ?? "reversible",
    human_review_required: (raw.human_review_required as boolean) ?? false,
    human_review_reason: (raw.human_review_reason as string) ?? "",
    novel_factors: Array.isArray(raw.novel_factors) ? (raw.novel_factors as string[]) : [],
    causal_chain: Array.isArray(raw.causal_chain) ? (raw.causal_chain as string[]) : [],
    downstream_dependencies: Array.isArray(raw.downstream_dependencies)
      ? (raw.downstream_dependencies as string[])
      : [],
    frequency_context: (raw.frequency_context as EvaluatorOutput["frequency_context"]) ?? {
      decision_type_seen_before: false,
      note: "",
    },
    // Three typed arrays — normalize each item to ensure required fields are present
    agent_actions_taken: Array.isArray(raw.agent_actions_taken)
      ? raw.agent_actions_taken.map(normalizeAgentAction)
      : [],
    surfaced_for_awareness: Array.isArray(raw.surfaced_for_awareness)
      ? raw.surfaced_for_awareness.map(normalizeSurfacedAwareness)
      : [],
    human_actions_required: Array.isArray(raw.human_actions_required)
      ? raw.human_actions_required.map(normalizeHumanAction)
      : [],
    // Cross-reference IDs — safe string array defaults
    resolves_prior_actions: Array.isArray(raw.resolves_prior_actions)
      ? (raw.resolves_prior_actions as string[])
      : [],
    missed_prior_actions: Array.isArray(raw.missed_prior_actions)
      ? (raw.missed_prior_actions as string[])
      : [],
    supersedes_prior_actions: Array.isArray(raw.supersedes_prior_actions)
      ? (raw.supersedes_prior_actions as string[])
      : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/advance
// ─────────────────────────────────────────────────────────────────────────────

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
  const { scenarioId, eventIndex: requestedIndex } = body as {
    scenarioId: string;
    eventIndex?: number;
  };

  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId is required" }, { status: 400 });
  }

  const currentState = getState(scenarioId);

  // Guard: refuse to advance while an intervention is pending
  if (currentState?.pendingIntervention) {
    return NextResponse.json(
      { error: "Intervention pending — resolve before advancing" },
      { status: 400 }
    );
  }

  // Resolve the active events file for this scenario + path
  const currentPath = currentState?.currentPath ?? "default";
  const eventsFilePath =
    domainConfig.scenarioPaths[scenarioId]?.[currentPath] ??
    domainConfig.scenarioPaths[scenarioId]?.["default"];

  if (!eventsFilePath) {
    return NextResponse.json(
      { error: `No events file configured for scenario: ${scenarioId}` },
      { status: 404 }
    );
  }

  const allEvents = loadSignalEventsFromPath(eventsFilePath);
  const scenarioEvents = allEvents.filter((e) => e.scenario_id === scenarioId);
  const totalEvents = scenarioEvents.length;

  if (totalEvents === 0) {
    return NextResponse.json(
      { error: `No events found for scenario: ${scenarioId}` },
      { status: 404 }
    );
  }

  const eventIndex =
    requestedIndex !== undefined
      ? requestedIndex
      : (currentState?.currentEventIndex ?? 0);

  if (eventIndex >= totalEvents) {
    return NextResponse.json(
      {
        error: "Scenario complete — no more events to advance",
        current_event_index: eventIndex,
        total_events: totalEvents,
      },
      { status: 400 }
    );
  }

  const event = scenarioEvents[eventIndex];

  // Compute formatted event date for action register
  const monitoringStartDate =
    domainConfig.timeline.monitoringStartDates[scenarioId] ??
    new Date().toISOString().split("T")[0];
  const eventDate = formatEventDate(
    monitoringStartDate,
    event.day_offset ?? 0,
    domainConfig.timeline.granularity
  ).primary;

  // Fetch baseline context via domain config — no mobility-specific calls in this route
  const baselineData = await getBaselineContext(scenarioId);
  const baselineContext = Object.keys(baselineData).length > 0
    ? `BASELINE CONTEXT (pre-fetched — do not re-fetch unless investigating a specific change):\n${JSON.stringify(baselineData, null, 2)}`
    : "";

  const priorEventTypes =
    eventIndex > 0
      ? scenarioEvents
          .slice(0, eventIndex)
          .map((e) => e.event_type)
          .join(" → ")
      : "none (this is the first signal)";

  // Build register context so Claude continues ID numbering and cross-references correctly
  const existingRegister = getActionRegister(scenarioId);
  const activeReqs = existingRegister.filter((e) => e.status === "active");
  const allReqs = existingRegister;
  let registerContext = "";
  if (allReqs.length > 0) {
    const maxReqNum = allReqs
      .map((e) => parseInt(e.id.replace("req_", ""), 10))
      .filter((n) => !isNaN(n))
      .reduce((a, b) => Math.max(a, b), 0);
    const nextId = `req_${String(maxReqNum + 1).padStart(3, "0")}`;
    const allLines = allReqs.map(
      (e) => `  ${e.id} [${e.status}]: ${e.action.slice(0, 100)}`
    );
    const activeLines = activeReqs.length > 0
      ? activeReqs.map((e) => `  ${e.id}: ${e.action.slice(0, 100)}`).join("\n")
      : "  (none)";
    registerContext = `
PRIOR ACTION REGISTER:
All IDs issued so far (NEVER reuse any of these IDs in human_actions_required):
${allLines.join("\n")}

Next available req ID: ${nextId}

Currently ACTIVE requirements (status=active) that a human has not yet acted on:
${activeLines}

MANDATORY CROSS-REFERENCE RULES — apply these NOW before generating output:
1. missed_prior_actions — If this signal provides evidence that an ACTIVE req's deadline has ALREADY PASSED without completion (e.g. the event type says "deadline_missed", "overdue", "suspended", or the payload confirms the action was never taken), you MUST list that req's ID here.
2. resolves_prior_actions — If this signal confirms an ACTIVE req's action has been completed (e.g. document submitted, approval received, payroll set up), list its ID here.
3. supersedes_prior_actions — If you issue a more urgent version of an ACTIVE req, list the original ID here.
`;
  }

  const userMessage = `NEW SIGNAL — ${scenarioId}
Signal ${eventIndex + 1} of ${totalEvents}

EVENT DETAILS:
  Event ID:       ${event.event_id}
  Event type:     ${event.event_type}
  Category:       ${(event as unknown as Record<string, string>).event_category ?? "—"}
  Source system:  ${(event as unknown as Record<string, string>).source_system ?? "—"}
  Entity:         ${event.entity_id}

PRIOR SIGNALS IN THIS SCENARIO (oldest → newest):
  ${priorEventTypes}

NEW EVENT PAYLOAD:
${JSON.stringify(event.payload, null, 2)}

${baselineContext}
${registerContext}
Using the baseline profile above and the available tools, investigate the impact of this specific new signal. Call tools only to look up information not already provided above or to check something the new signal directly affects. Then output your risk assessment as a single JSON object — no prose before or after it.`;

  // Agentic tool_use loop
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  const toolCallTrace: ToolCallTrace[] = [];
  let finalEvaluation: EvaluatorOutput | null = null;

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: domainConfig.systemPrompt,
      tools: TOOL_DEFINITIONS as unknown as Anthropic.Tool[],
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );

      if (textBlock) {
        try {
          const fenceMatch = textBlock.text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
          const bareMatch = textBlock.text.match(/\{[\s\S]*\}/);
          const jsonStr = fenceMatch ? fenceMatch[1] : bareMatch ? bareMatch[0] : null;
          if (!jsonStr) throw new Error("No JSON found in response");
          const rawParsed = JSON.parse(jsonStr) as Record<string, unknown>;
          finalEvaluation = normalizeEvaluatorOutput(rawParsed);
        } catch {
          finalEvaluation = normalizeEvaluatorOutput({
            risk_level: "medium",
            confidence: 0.5,
            reasoning_summary: textBlock.text,
          });
        }
      }
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolInput = toolUse.input as Record<string, unknown>;

      let toolResult: unknown;
      if (toolUse.name === "get_recent_signals") {
        toolResult = getRecentSignals(
          toolInput.scenario_id as string,
          eventIndex,
          eventsFilePath
        );
      } else {
        toolResult = executeTool(toolUse.name, toolInput);
      }

      toolCallTrace.push({
        tool_name: toolUse.name,
        tool_input: toolInput,
        tool_result: toolResult,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolResult),
      });
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    if (response.stop_reason === "end_turn" && toolUseBlocks.length === 0) {
      break;
    }
  }

  if (!finalEvaluation) {
    return NextResponse.json({ error: "Agent returned no evaluation" }, { status: 500 });
  }

  // ── Threshold evaluation ──────────────────────────────────────────────────
  const requiresIntervention = evaluateInterventionThresholds(
    finalEvaluation,
    domainConfig.interventionThresholds
  );

  if (requiresIntervention) {
    // Paused path: save as pending, do NOT advance event index
    const record: EvaluationRecord = {
      event_index: eventIndex,
      event_id: event.event_id,
      event_type: event.event_type,
      timestamp: new Date().toISOString(),
      evaluation: finalEvaluation,
      tool_trace: toolCallTrace,
      status: "pending_human_review",
      path: currentPath,
    };

    const pending: PendingIntervention = {
      event_id: event.event_id,
      event_index: eventIndex,
      evaluation: finalEvaluation,
    };

    recordPendingIntervention(scenarioId, totalEvents, record, pending);
    updateActionRegister(scenarioId, finalEvaluation, eventIndex, eventDate);

    return NextResponse.json({
      requires_intervention: true,
      event,
      evaluation: finalEvaluation,
      tool_trace: toolCallTrace,
      intervention_options: domainConfig.interventionOptions,
      action_register: getRegisterAtEventIndex(scenarioId, eventIndex),
      progress: {
        current_event_index: eventIndex,
        next_event_index: eventIndex,
        total_events: totalEvents,
        complete: false,
      },
    });
  }

  // Autonomous path: save and advance
  const record: EvaluationRecord = {
    event_index: eventIndex,
    event_id: event.event_id,
    event_type: event.event_type,
    timestamp: new Date().toISOString(),
    evaluation: finalEvaluation,
    tool_trace: toolCallTrace,
    status: "autonomous",
    path: currentPath,
  };

  const updatedState = recordEvaluation(scenarioId, totalEvents, record);
  updateActionRegister(scenarioId, finalEvaluation, eventIndex, eventDate);

  return NextResponse.json({
    requires_intervention: false,
    event,
    evaluation: finalEvaluation,
    tool_trace: toolCallTrace,
    action_register: getRegisterAtEventIndex(scenarioId, eventIndex),
    progress: {
      current_event_index: eventIndex,
      next_event_index: updatedState.currentEventIndex,
      total_events: updatedState.totalEvents,
      complete: updatedState.currentEventIndex >= updatedState.totalEvents,
    },
  });
}
