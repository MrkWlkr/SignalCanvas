import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { domainConfig } from "@/lib/domain-config";
import { TOOL_DEFINITIONS, executeTool, getRecentSignals } from "@/lib/tools";
import { loadSignalEvents, loadEmployees } from "@/lib/data";
import { recordEvaluation, getState } from "@/lib/state";
import type { ToolCallTrace, RiskEvaluation } from "@/lib/state";
import {
  getEmployee,
  getVisaCase,
  getPayrollStatus,
  getAssignment,
} from "@/lib/tools";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { scenarioId, eventIndex: requestedIndex } = body as {
    scenarioId: string;
    eventIndex?: number;
  };

  if (!scenarioId) {
    return NextResponse.json({ error: "scenarioId is required" }, { status: 400 });
  }

  const allEvents = loadSignalEvents();
  const scenarioEvents = allEvents.filter((e) => e.scenario_id === scenarioId);
  const totalEvents = scenarioEvents.length;

  if (totalEvents === 0) {
    return NextResponse.json(
      { error: `No events found for scenario: ${scenarioId}` },
      { status: 404 }
    );
  }

  const currentState = getState(scenarioId);
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

  // FIX 1 — Eagerly load the full employee profile as baseline context
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

  // FIX 4 — Build a rich, context-aware user message
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
  let finalEvaluation: RiskEvaluation | null = null;

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
          finalEvaluation = JSON.parse(jsonStr) as RiskEvaluation;
        } catch {
          finalEvaluation = {
            risk_level: "medium",
            confidence: 0.5,
            affected_domains: [],
            recommended_actions: [],
            reasoning_summary: textBlock.text,
            next_checks: [],
          };
        }
      }
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolInput = toolUse.input as Record<string, unknown>;

      // FIX 2 — Intercept get_recent_signals to cap at current event index
      let toolResult: unknown;
      if (toolUse.name === "get_recent_signals") {
        toolResult = getRecentSignals(
          toolInput.scenario_id as string,
          eventIndex
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

  const updatedState = recordEvaluation(scenarioId, totalEvents, {
    event_index: eventIndex,
    event_id: event.event_id,
    event_type: event.event_type,
    timestamp: new Date().toISOString(),
    evaluation: finalEvaluation!,
    tool_trace: toolCallTrace,
  });

  return NextResponse.json({
    event,
    evaluation: finalEvaluation,
    tool_trace: toolCallTrace,
    progress: {
      current_event_index: eventIndex,
      next_event_index: updatedState.currentEventIndex,
      total_events: totalEvents,
      complete: updatedState.currentEventIndex >= totalEvents,
    },
  });
}
