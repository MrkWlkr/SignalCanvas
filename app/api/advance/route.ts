import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { domainConfig } from "@/lib/domain-config";
import type { InterventionThresholds, InterventionRule } from "@/lib/domain-config";
import { TOOL_DEFINITIONS, executeTool, getRecentSignals } from "@/lib/tools";
import { loadSignalEventsFromPath, loadEmployees } from "@/lib/data";
import {
  recordEvaluation,
  recordPendingIntervention,
  getState,
} from "@/lib/state";
import type { EvaluatorOutput, EvaluationRecord, ToolCallTrace, PendingIntervention } from "@/types";
import {
  getEmployee,
  getVisaCase,
  getPayrollStatus,
  getAssignment,
} from "@/lib/tools";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────────────────────────────────────────
// Generic threshold evaluator — zero mobility-specific logic lives here.
// Operates on the InterventionThresholds shape from any DomainConfig.
// ─────────────────────────────────────────────────────────────────────────────

function matchesRule(evaluation: EvaluatorOutput, rule: InterventionRule): boolean {
  const rawValue = (evaluation as unknown as Record<string, unknown>)[rule.field];

  switch (rule.operator) {
    case "is": {
      // If rule.value is an array, treat as "field value is one of"
      if (Array.isArray(rule.value)) return rule.value.includes(rawValue as string);
      return rawValue === rule.value;
    }
    case "is_not": {
      if (Array.isArray(rule.value)) return !rule.value.includes(rawValue as string);
      return rawValue !== rule.value;
    }
    case "greater_than": {
      // If field value is an array, compare array.length
      const numeric = Array.isArray(rawValue)
        ? rawValue.length
        : (rawValue as number);
      return numeric > (rule.value as number);
    }
    case "less_than": {
      const numeric = Array.isArray(rawValue)
        ? rawValue.length
        : (rawValue as number);
      return numeric < (rule.value as number);
    }
    case "includes": {
      // Array field: non-empty check (any element present)
      if (Array.isArray(rawValue)) return rawValue.length > 0;
      // String field: substring check
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

// Returns the final human_review_required decision after applying all threshold groups.
// Priority order: always_review (highest) > autonomous_when > review_when > Claude's own value.
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

  // Fall back to Claude's own judgement
  return evaluation.human_review_required;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalise raw Claude JSON into a fully-typed EvaluatorOutput with defaults
// ─────────────────────────────────────────────────────────────────────────────

function normalizeEvaluatorOutput(raw: Record<string, unknown>): EvaluatorOutput {
  return {
    risk_level: (raw.risk_level as EvaluatorOutput["risk_level"]) ?? "medium",
    confidence: (raw.confidence as number) ?? 0.5,
    affected_domains: (raw.affected_domains as string[]) ?? [],
    recommended_actions: (raw.recommended_actions as string[]) ?? [],
    reasoning_summary: (raw.reasoning_summary as string) ?? "",
    next_checks: (raw.next_checks as string[]) ?? [],
    decision_type:
      (raw.decision_type as EvaluatorOutput["decision_type"]) ?? "recommendation",
    impact_magnitude:
      (raw.impact_magnitude as EvaluatorOutput["impact_magnitude"]) ?? "medium",
    reversibility:
      (raw.reversibility as EvaluatorOutput["reversibility"]) ?? "reversible",
    human_review_required: (raw.human_review_required as boolean) ?? false,
    human_review_reason: (raw.human_review_reason as string) ?? "",
    novel_factors: (raw.novel_factors as string[]) ?? [],
    causal_chain: (raw.causal_chain as string[]) ?? [],
    downstream_dependencies: (raw.downstream_dependencies as string[]) ?? [],
    frequency_context: (raw.frequency_context as EvaluatorOutput["frequency_context"]) ?? {
      decision_type_seen_before: false,
      note: "",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/advance
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
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

  // Eagerly load the full employee profile as baseline context
  const allEmployees = loadEmployees();
  const employee = allEmployees.find((e) => e.scenario_id === scenarioId);

  let baselineContext = "";
  if (employee) {
    const employeeRecord = getEmployee(employee.employee_id);
    const assignment = getAssignment(employee.employee_id);
    const visaCase = getVisaCase(employee.case_id);
    const payroll = getPayrollStatus(employee.employee_id);

    baselineContext = `
EMPLOYEE PROFILE (pre-fetched baseline — do not re-fetch unless investigating a specific change):
${JSON.stringify(employeeRecord, null, 2)}

ASSIGNMENT CONTEXT (employee + country rule + policy):
${JSON.stringify(assignment, null, 2)}

VISA CASE:
${JSON.stringify(visaCase, null, 2)}

PAYROLL STATUS:
${JSON.stringify(payroll, null, 2)}`;
  }

  const priorEventTypes =
    eventIndex > 0
      ? scenarioEvents
          .slice(0, eventIndex)
          .map((e) => e.event_type)
          .join(" → ")
      : "none (this is the first signal)";

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
        // Intercept to cap at current event index and use path-specific file
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

    const updatedState = recordPendingIntervention(
      scenarioId,
      totalEvents,
      record,
      pending
    );

    return NextResponse.json({
      requires_intervention: true,
      event,
      evaluation: finalEvaluation,
      intervention_options: domainConfig.interventionOptions,
      progress: {
        current_event_index: eventIndex,
        next_event_index: eventIndex, // stays — agent paused
        total_events: updatedState.totalEvents,
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

  return NextResponse.json({
    requires_intervention: false,
    event,
    evaluation: finalEvaluation,
    tool_trace: toolCallTrace,
    progress: {
      current_event_index: eventIndex,
      next_event_index: updatedState.currentEventIndex,
      total_events: updatedState.totalEvents,
      complete: updatedState.currentEventIndex >= updatedState.totalEvents,
    },
  });
}
