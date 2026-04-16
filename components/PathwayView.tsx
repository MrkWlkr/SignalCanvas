"use client";

import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  Handle,
  type NodeMouseHandler,
} from "reactflow";
// @ts-ignore — CSS side-effect import
import "reactflow/dist/style.css";

import type { EvaluationRecord, RiskLevel, SignalEvent, ToolCallTrace } from "@/types";
import { formatEventType, riskColors, riskBorderHex } from "@/components/ui";

// Node types must be defined outside the component to prevent re-renders
function RiskNode({
  data,
  selected,
}: {
  data: {
    label: string;
    category?: string;
    risk_level: RiskLevel;
    confidence: number;
    isLatest: boolean;
  };
  selected?: boolean;
}) {
  const c = riskColors[data.risk_level] ?? riskColors.medium;
  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: "#4b5563" }} />
      <div
        style={{
          background: "#111827",
          border: `1.5px solid ${
            selected ? "#f59e0b" : data.isLatest ? "#3b82f6" : riskBorderHex[data.risk_level]
          }`,
          borderRadius: "8px",
          padding: "10px 14px",
          minWidth: "170px",
          boxShadow: selected
            ? "0 0 12px rgba(245,158,11,0.4)"
            : data.isLatest
            ? "0 0 12px rgba(59,130,246,0.4)"
            : undefined,
        }}
      >
        <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "2px", textTransform: "capitalize" }}>
          {data.category ?? "signal"}
        </div>
        <div style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "4px" }}>{data.label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "1px 6px",
              borderRadius: "4px",
            }}
            className={`${c.text} ${c.bg}`}
          >
            {data.risk_level}
          </span>
          <span style={{ fontSize: "11px", color: "#d1d5db", fontFamily: "monospace" }}>
            {data.confidence.toFixed(2)}
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: "#4b5563" }} />
    </>
  );
}

const nodeTypes = { riskNode: RiskNode };

function summarizeToolResult(trace: ToolCallTrace): string {
  const r = trace.tool_result as Record<string, unknown>;
  if (!r) return "No result";
  try {
    switch (trace.tool_name) {
      case "get_employee":
        return `Employee: ${(r as any).employee_name ?? "unknown"}`;
      case "get_assignment":
        return `Employee: ${(r as any).employee?.employee_name ?? "unknown"}, policy: ${(r as any).policy?.policy_id ?? "—"}`;
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

interface Props {
  evaluations: EvaluationRecord[];
  events: SignalEvent[];
}

export default function PathwayView({ evaluations, events }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const eventMap = useMemo(() => new Map(events.map((e) => [e.event_id, e])), [events]);

  const nodes: Node[] = useMemo(
    () =>
      evaluations.map((ev, i) => {
        const event = eventMap.get(ev.event_id);
        return {
          id: ev.event_id,
          type: "riskNode",
          position: { x: i * 220, y: 60 },
          data: {
            label: formatEventType(ev.event_type),
            category: event?.event_category,
            risk_level: ev.evaluation.risk_level,
            confidence: ev.evaluation.confidence,
            isLatest: i === evaluations.length - 1,
          },
        };
      }),
    [evaluations, eventMap]
  );

  const edges: Edge[] = useMemo(
    () =>
      evaluations.slice(1).map((ev, i) => ({
        id: `e${i}`,
        source: evaluations[i].event_id,
        target: ev.event_id,
        animated: true,
        style: { stroke: "#3b82f6", strokeWidth: 1.5 },
      })),
    [evaluations]
  );

  const selectedEval = selectedNodeId
    ? evaluations.find((e) => e.event_id === selectedNodeId)
    : null;
  const latest = evaluations[evaluations.length - 1];
  const displayTrace = selectedEval ?? latest;

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* React Flow graph */}
      <div
        className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
        style={{ height: "280px" }}
      >
        {evaluations.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Advance to see the decision pathway
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnDrag={true}
            onNodeClick={handleNodeClick}
          >
            <Background color="#1f2937" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        )}
      </div>

      {/* Reasoning summary for selected node */}
      {selectedEval && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-4">
          <div className="text-xs text-amber-500 uppercase tracking-wider mb-2">
            {formatEventType(selectedEval.event_type)} — Reasoning
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            {selectedEval.evaluation.reasoning_summary}
          </p>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="mt-2 text-xs text-amber-600 hover:text-amber-400 transition-colors"
          >
            ✕ deselect
          </button>
        </div>
      )}

      {/* Tool call trace */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">
          Tool Call Trace
          {displayTrace && (
            <span className="ml-2 text-gray-600 normal-case">
              — {formatEventType(displayTrace.event_type)}
            </span>
          )}
        </div>
        {!displayTrace ? (
          <div className="text-gray-600 text-sm">No tool calls yet</div>
        ) : (
          <ol className="flex flex-col gap-2">
            {displayTrace.tool_trace.map((trace, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span className="text-xs text-gray-600 font-mono w-4 flex-shrink-0 pt-0.5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-blue-400">{trace.tool_name}</span>
                    <span className="text-xs text-gray-600 font-mono truncate">
                      ({Object.entries(trace.tool_input).map(([k, v]) => `${k}: ${v}`).join(", ")})
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 truncate">{summarizeToolResult(trace)}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
