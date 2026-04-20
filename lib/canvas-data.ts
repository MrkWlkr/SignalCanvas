// ─────────────────────────────────────────────────────────────────────────────
// canvas-data.ts
// Pure functions that transform evaluation state into React Flow nodes/edges.
// All functions are domain-agnostic — they read domain-specific values from
// DomainConfig. Swapping mobilityConfig for travelConfig requires zero changes here.
// ─────────────────────────────────────────────────────────────────────────────

import type { Node, Edge } from "reactflow";
import { MarkerType } from "reactflow";
import type { EvaluationRecord, ToolCallTrace, SignalEvent } from "@/types";
import type { DomainConfig } from "@/lib/domain-config";
import { riskBorderHex, riskStroke } from "@/components/ui";

// ── Layout constants ──────────────────────────────────────────────────────────
export const SPINE_Y = 160;
export const SOURCE_Y_OFFSET = 160; // below spine
export const HUMAN_Y_OFFSET = -100; // above spine
export const START_X = 80;
export const SPINE_NODE_WIDTH = 160;
export const SOURCE_NODE_WIDTH = 140;
export const SOURCE_NODE_HEIGHT = 56;
export const SPINE_NODE_HEIGHT = 72;

// ── Data types passed into React Flow node `data` prop ───────────────────────

export interface SpineNodeData {
  evaluation: EvaluationRecord["evaluation"];
  eventType: string;
  eventCategory?: string;
  dayOffset?: number;
  isSelected: boolean;
  isCompressed: boolean;
  isLatest: boolean;
  hasIntervention: boolean;
  status: EvaluationRecord["status"];
  path: string;
  isAdvancing: boolean;
}

export interface SourceNodeData {
  sourceSystem: string;
  toolsCalled: string[];
  keyResults: { field: string; value: string }[];
  isOpen: boolean;
  spineEventId: string;
}

export interface HumanDecisionNodeData {
  optionLabel: string;
  optionChosen: string;
  dayOffset?: number;
  pathSwitched: boolean;
}

// ── Key result extraction (domain-specific but tool-name-keyed, not field-keyed) ──

export function getKeyResults(trace: ToolCallTrace): { field: string; value: string }[] {
  const r = trace.tool_result;

  if (Array.isArray(r)) {
    return [{ field: "signals retrieved", value: String(r.length) }];
  }
  if (!r || typeof r !== "object") return [];

  const result = r as Record<string, unknown>;
  // Surface "error" field if present
  if (result.error) return [{ field: "error", value: String(result.error) }];

  switch (trace.tool_name) {
    case "get_employee":
      return [
        { field: "name", value: String(result.employee_name ?? "—") },
        {
          field: "route",
          value:
            result.home_country && result.host_country
              ? `${result.home_country} → ${result.host_country}`
              : "—",
        },
      ].filter((kv) => kv.value !== "—");

    case "get_assignment": {
      const emp = result.employee as Record<string, unknown> | null;
      const policy = result.policy as Record<string, unknown> | null;
      const cr = result.country_rule as Record<string, unknown> | null;
      const out: { field: string; value: string }[] = [];
      if (emp?.employee_name) out.push({ field: "employee", value: String(emp.employee_name) });
      if (policy?.policy_id) out.push({ field: "policy", value: String(policy.policy_id) });
      if (cr?.tax_threshold_days != null)
        out.push({ field: "tax threshold", value: `${cr.tax_threshold_days} days` });
      return out;
    }

    case "get_country_rule":
      return [
        { field: "tax threshold", value: `${result.tax_threshold_days ?? "—"} days` },
        { field: "visa", value: String(result.visa_category ?? "—") },
        {
          field: "processing",
          value: `${result.typical_visa_processing_days ?? "—"} days`,
        },
      ].filter((kv) => !kv.value.includes("—"));

    case "get_policy":
      return [
        {
          field: "max days",
          value:
            result.max_short_term_assignment_days != null
              ? String(result.max_short_term_assignment_days)
              : "—",
        },
        {
          field: "pre-approval",
          value: result.requires_preapproval_for_extension ? "required" : "not required",
        },
      ].filter((kv) => kv.value !== "—");

    case "get_visa_case":
      return [
        { field: "status", value: String(result.visa_status ?? "—") },
        {
          field: "delay prob",
          value:
            result.visa_delay_probability != null
              ? `${Math.round(Number(result.visa_delay_probability) * 100)}%`
              : "—",
        },
        {
          field: "docs complete",
          value:
            result.documents_complete === true
              ? "yes"
              : result.documents_complete === false
              ? "no"
              : "—",
        },
      ].filter((kv) => kv.value !== "—");

    case "get_payroll_status":
      return [
        { field: "alignment risk", value: String(result.alignment_risk ?? "—") },
        { field: "host status", value: String(result.host_payroll_status ?? "—") },
        {
          field: "shadow payroll",
          value: result.shadow_payroll_required ? "required" : "not required",
        },
      ].filter((kv) => kv.value !== "—");

    case "calculate_days_until_start":
      return [{ field: "days until start", value: String(result.days_until_start ?? "—") }].filter(
        (kv) => kv.value !== "—"
      );

    default:
      return Object.entries(result)
        .slice(0, 3)
        .map(([k, v]) => ({ field: k.replace(/_/g, " "), value: String(v) }));
  }
}

// Single-line summary of a tool result — preserved from PathwayView/DataInspector
export function summarizeToolResult(trace: ToolCallTrace): string {
  const r = trace.tool_result as Record<string, unknown>;
  if (!r) return "No result";
  try {
    switch (trace.tool_name) {
      case "get_employee":
        return `Employee: ${(r as any).employee_name ?? "unknown"}`;
      case "get_assignment":
        return `${(r as any).employee?.employee_name ?? "unknown"} — policy: ${(r as any).policy?.policy_id ?? "—"}`;
      case "get_country_rule":
        return `Tax threshold: ${(r as any).tax_threshold_days}d, visa: ${(r as any).visa_category}`;
      case "get_policy":
        return `Max days: ${(r as any).max_short_term_assignment_days}, pre-approval: ${(r as any).requires_preapproval_for_extension}`;
      case "get_visa_case":
        return `Status: ${(r as any).visa_status}, delay prob: ${(r as any).visa_delay_probability}, docs: ${(r as any).documents_complete}`;
      case "get_payroll_status":
        return `Alignment risk: ${(r as any).alignment_risk}, host: ${(r as any).host_payroll_status}`;
      case "get_recent_signals":
        return `${Array.isArray(r) ? r.length : 0} recent signal events`;
      case "calculate_days_until_start":
        return `${(r as any).days_until_start} days until assignment start`;
      default:
        return JSON.stringify(r).slice(0, 80);
    }
  } catch {
    return "—";
  }
}

// ── Source node x-position helper ────────────────────────────────────────────

function getSourceXPositions(count: number, spineCenterX: number): number[] {
  // 20px gap between 140px nodes → 160px slot width
  const slotWidth = SOURCE_NODE_WIDTH + 20;
  return Array.from({ length: count }, (_, i) => {
    const offset = -(count - 1) * slotWidth / 2 + i * slotWidth;
    return spineCenterX + offset - SOURCE_NODE_WIDTH / 2;
  });
}

// ── buildSpineNodes ───────────────────────────────────────────────────────────

export function buildSpineNodes(
  evaluations: EvaluationRecord[],
  events: SignalEvent[],
  config: DomainConfig,
  selectedId: string | null,
  advancing: boolean
): Node<SpineNodeData>[] {
  const { nodeSpacingPx, compressAfterCount } = config.canvas;
  const eventMap = new Map(events.map((e) => [e.event_id, e]));

  return evaluations.map((record, i) => {
    const event = eventMap.get(record.event_id);
    const isLatest = i === evaluations.length - 1;
    const isCompressed = i < evaluations.length - compressAfterCount;
    const isSelected = record.event_id === selectedId;
    const hasIntervention = record.human_decision !== undefined;

    return {
      id: record.event_id,
      type: "spineNode",
      position: { x: START_X + i * nodeSpacingPx, y: SPINE_Y },
      data: {
        evaluation: record.evaluation,
        eventType: record.event_type,
        eventCategory: event?.event_category,
        dayOffset: event?.day_offset,
        isSelected,
        isCompressed,
        isLatest,
        hasIntervention,
        status: record.status,
        path: record.path,
        isAdvancing: advancing && isLatest,
      },
    };
  });
}

// ── buildSourceNodes ──────────────────────────────────────────────────────────

export function buildSourceNodes(
  record: EvaluationRecord,
  spineNodeX: number,
  openSourceId: string | null,
  toolSourceSystemMap: Record<string, string>
): Node<SourceNodeData>[] {
  if (record.tool_trace.length === 0) return [];

  // Group tool calls by source system
  const groups = new Map<string, ToolCallTrace[]>();
  for (const trace of record.tool_trace) {
    const sys = toolSourceSystemMap[trace.tool_name] ?? "External System";
    groups.set(sys, [...(groups.get(sys) ?? []), trace]);
  }

  const groupEntries = Array.from(groups.entries());
  const spineCenterX = spineNodeX + SPINE_NODE_WIDTH / 2;
  const xPositions = getSourceXPositions(groupEntries.length, spineCenterX);
  const sourceY = SPINE_Y + SOURCE_Y_OFFSET;

  return groupEntries.map(([sourceSystem, traces], idx) => {
    const id = `source-${record.event_id}-${sourceSystem.replace(/\s+/g, "_")}`;
    const toolsCalled = traces.map((t) => {
      const inputStr = Object.values(t.tool_input).join(", ");
      return `${t.tool_name}(${inputStr})`;
    });
    const keyResults = traces.flatMap((t) => getKeyResults(t));

    return {
      id,
      type: "sourceNode",
      position: { x: xPositions[idx], y: sourceY },
      data: {
        sourceSystem,
        toolsCalled,
        keyResults,
        isOpen: openSourceId === id,
        spineEventId: record.event_id,
      },
    };
  });
}

// ── buildHumanDecisionNodes ───────────────────────────────────────────────────

export function buildHumanDecisionNodes(
  evaluations: EvaluationRecord[],
  spinePositions: { id: string; x: number }[],
  nodeSpacingPx: number
): Node<HumanDecisionNodeData>[] {
  const posMap = new Map(spinePositions.map((p) => [p.id, p.x]));

  return evaluations
    .filter((r) => r.human_decision !== undefined)
    .map((record) => {
      const decision = record.human_decision!;
      const spineX = posMap.get(record.event_id) ?? 0;
      // Human decision nodes sit above spine, between this node and the previous one
      const x = spineX - nodeSpacingPx / 2 + (SPINE_NODE_WIDTH / 2) - 60; // center 120px node
      const y = SPINE_Y + HUMAN_Y_OFFSET;

      return {
        id: `human-${record.event_index}`,
        type: "humanDecisionNode",
        position: { x, y },
        data: {
          optionLabel: decision.option_label,
          optionChosen: decision.option_id,
          pathSwitched: record.path === "intervention_resolved",
        },
      };
    });
}

// ── buildEdges ────────────────────────────────────────────────────────────────

export function buildEdges(
  spineNodes: Node<SpineNodeData>[],
  sourceNodes: Node<SourceNodeData>[],
  humanDecisionNodes: Node<HumanDecisionNodeData>[]
): Edge[] {
  const edges: Edge[] = [];

  // Spine → Spine: solid animated, colored by downstream node's risk level
  for (let i = 1; i < spineNodes.length; i++) {
    const prev = spineNodes[i - 1];
    const curr = spineNodes[i];
    const riskColor = riskStroke[curr.data.evaluation.risk_level] ?? "#6b7280";
    edges.push({
      id: `spine-${prev.id}-${curr.id}`,
      source: prev.id,
      target: curr.id,
      animated: true,
      style: { stroke: riskColor, strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: riskColor },
    });
  }

  // Spine → Source: dashed gray
  for (const src of sourceNodes) {
    edges.push({
      id: `src-edge-${src.id}`,
      source: src.data.spineEventId,
      target: src.id,
      style: { stroke: "#4b5563", strokeWidth: 1, strokeDasharray: "4 3" },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#4b5563" },
    });
  }

  // Human decision nodes: connect to adjacent spine nodes
  for (const hdn of humanDecisionNodes) {
    const spineEventId = hdn.id.replace("human-", "");
    // Find the spine node whose event_index matches
    const spineNode = spineNodes.find(
      (n) => String(n.data.evaluation) !== undefined &&
             spineNodes.indexOf(n).toString() === spineEventId
    );
    // Simpler: just connect from the preceding spine node to this human node
    // and from this human node to the same spine node
    const eventIndex = parseInt(hdn.id.replace("human-", ""), 10);
    const targetSpine = spineNodes.find(
      (_, i) => i === eventIndex
    );
    const prevSpine = eventIndex > 0 ? spineNodes[eventIndex - 1] : null;

    const pathSwitched = hdn.data.pathSwitched;
    const humanColor = pathSwitched ? "#22c55e" : "#f59e0b";

    if (prevSpine) {
      edges.push({
        id: `human-in-${hdn.id}`,
        source: prevSpine.id,
        target: hdn.id,
        style: { stroke: humanColor, strokeWidth: 1.5, strokeDasharray: "5 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: humanColor },
      });
    }
    if (targetSpine) {
      edges.push({
        id: `human-out-${hdn.id}`,
        source: hdn.id,
        target: targetSpine.id,
        style: { stroke: humanColor, strokeWidth: 1.5, strokeDasharray: "5 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: humanColor },
      });
    }
  }

  return edges;
}

// ── KPI node positions for KpiLine ───────────────────────────────────────────

export function getKpiNodePositions(
  evaluations: EvaluationRecord[],
  config: DomainConfig
): { id: string; x: number; value: number }[] {
  const { nodeSpacingPx, kpiField } = config.canvas;
  return evaluations.map((record, i) => ({
    id: record.event_id,
    x: START_X + i * nodeSpacingPx + SPINE_NODE_WIDTH / 2,
    value: Number((record.evaluation as unknown as Record<string, unknown>)[kpiField] ?? 0),
  }));
}
