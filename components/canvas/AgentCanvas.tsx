"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  useReactFlow,
  type NodeMouseHandler,
  type Viewport,
  type OnMove,
} from "reactflow";
// @ts-ignore — CSS side-effect import
import "reactflow/dist/style.css";

import { SpineNode } from "@/components/canvas/SpineNode";
import { SourceNode } from "@/components/canvas/SourceNode";
import { HumanDecisionNode } from "@/components/canvas/HumanDecisionNode";
import { KpiLine } from "@/components/canvas/KpiLine";
import { NodeDetailDrawer } from "@/components/canvas/NodeDetailDrawer";
import { HumanDecisionDrawer } from "@/components/canvas/HumanDecisionDrawer";
import InterventionCard from "@/components/InterventionCard";
import {
  buildSpineNodes,
  buildSourceNodes,
  buildHumanDecisionNodes,
  buildEdges,
  getKpiNodePositions,
} from "@/lib/canvas-data";
import { riskBorderHex, getRiskColors, formatEventType } from "@/components/ui";
import type { DomainConfig } from "@/lib/domain-config";
import type { EvaluationRecord, SignalEvent, HumanDecision } from "@/types";
import type { PendingInterventionState } from "@/hooks/useScenario";

// ── Node types must be defined outside the component to prevent re-renders ───
const nodeTypes = {
  spineNode: SpineNode,
  sourceNode: SourceNode,
  humanDecisionNode: HumanDecisionNode,
};

const KPI_HEIGHT = 80; // px of KPI band overlaid at top of canvas

// ── CanvasController — lives inside ReactFlow provider, handles auto-pan ──────
function CanvasController({
  latestNodeId,
  highlightedNodeId,
}: {
  latestNodeId: string | null;
  highlightedNodeId: string | null;
}) {
  const { fitView } = useReactFlow();
  const prevLatestRef = useRef<string | null>(null);
  const prevHighlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (latestNodeId && latestNodeId !== prevLatestRef.current) {
      prevLatestRef.current = latestNodeId;
      const t = setTimeout(() => {
        fitView({ nodes: [{ id: latestNodeId }], duration: 500, padding: 0.35 });
      }, 60);
      return () => clearTimeout(t);
    }
  }, [latestNodeId, fitView]);

  useEffect(() => {
    if (highlightedNodeId && highlightedNodeId !== prevHighlightRef.current) {
      prevHighlightRef.current = highlightedNodeId;
      const t = setTimeout(() => {
        fitView({ nodes: [{ id: highlightedNodeId }], duration: 400, padding: 0.35 });
      }, 60);
      return () => clearTimeout(t);
    }
    if (!highlightedNodeId) {
      prevHighlightRef.current = null;
    }
  }, [highlightedNodeId, fitView]);

  return null;
}

// ── AgentCanvas props ─────────────────────────────────────────────────────────
export interface AgentCanvasProps {
  evaluations: EvaluationRecord[];
  events: SignalEvent[];
  config: DomainConfig;
  advancing: boolean;
  pendingIntervention: PendingInterventionState | null;
  onIntervene: (optionId: string) => Promise<void>;
  scenarioId: string;
  selectedEventIndex: number | null;
  onSelectEvent: (index: number | null) => void;
}

// ── AgentCanvas — primary canvas orchestrator ─────────────────────────────────
// Manages selection, source-node popover, and viewport state.
// KpiLine SVG sits above the React Flow canvas, both sharing the same container.
// NodeDetailDrawer slides in from the right when a spine node is selected.
// InterventionCard renders as an overlay when a human decision is pending.

export function AgentCanvas({
  evaluations,
  events,
  config,
  advancing,
  pendingIntervention,
  onIntervene,
  scenarioId,
  selectedEventIndex,
  onSelectEvent,
}: AgentCanvasProps) {
  const [selectedSpineId, setSelectedSpineId] = useState<string | null>(null);
  const [selectedHumanNodeId, setSelectedHumanNodeId] = useState<string | null>(null);
  const [openSourceId, setOpenSourceId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 500 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container so KpiLine can size its SVG correctly
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(el);
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const { toolSourceSystemMap, nodeSpacingPx } = config.canvas;
  const latest = evaluations[evaluations.length - 1] ?? null;

  // ── Determine which record's source nodes to display ─────────────────────
  // Show source nodes for the selected spine node, or latest if none selected.
  const activeRecordForSources = useMemo(() => {
    if (selectedSpineId) {
      return evaluations.find((r) => r.event_id === selectedSpineId) ?? latest;
    }
    return latest;
  }, [selectedSpineId, evaluations, latest]);

  // ── Build all React Flow nodes ────────────────────────────────────────────

  const spineNodes = useMemo(
    () => buildSpineNodes(evaluations, events, config, selectedSpineId, advancing, scenarioId, selectedEventIndex),
    [evaluations, events, config, selectedSpineId, advancing, scenarioId, selectedEventIndex]
  );

  const sourceNodes = useMemo(() => {
    if (!activeRecordForSources) return [];
    const spineNode = spineNodes.find((n) => n.id === activeRecordForSources.event_id);
    if (!spineNode) return [];
    return buildSourceNodes(
      activeRecordForSources,
      spineNode.position.x,
      openSourceId,
      toolSourceSystemMap
    );
  }, [activeRecordForSources, spineNodes, openSourceId, toolSourceSystemMap]);

  const humanDecisionNodes = useMemo(
    () =>
      buildHumanDecisionNodes(
        evaluations,
        spineNodes.map((n) => ({ id: n.id, x: n.position.x })),
        nodeSpacingPx,
        selectedHumanNodeId
      ),
    [evaluations, spineNodes, nodeSpacingPx, selectedHumanNodeId]
  );

  const allNodes = useMemo(
    () => [...spineNodes, ...sourceNodes, ...humanDecisionNodes],
    [spineNodes, sourceNodes, humanDecisionNodes]
  );

  const edges = useMemo(
    () => buildEdges(spineNodes, sourceNodes, humanDecisionNodes),
    [spineNodes, sourceNodes, humanDecisionNodes]
  );

  // ── KPI line data ─────────────────────────────────────────────────────────
  const kpiPoints = useMemo(() => {
    const positions = getKpiNodePositions(evaluations, config);
    return positions.map((p, i) => ({
      id: p.id,
      x: p.x,
      value: p.value,
      riskLevel: evaluations[i].evaluation.risk_level,
    }));
  }, [evaluations, config]);

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === "spineNode") {
      const isDeselecting = selectedSpineId === node.id;
      setSelectedSpineId((prev) => (prev === node.id ? null : node.id));
      setSelectedHumanNodeId(null);
      setOpenSourceId(null);
      const record = evaluations.find((r) => r.event_id === node.id);
      if (record) {
        onSelectEvent(isDeselecting ? null : record.event_index);
      }
    } else if (node.type === "sourceNode") {
      setOpenSourceId((prev) => (prev === node.id ? null : node.id));
    } else if (node.type === "humanDecisionNode") {
      setSelectedHumanNodeId((prev) => (prev === node.id ? null : node.id));
      setSelectedSpineId(null);
      setOpenSourceId(null);
      onSelectEvent(null);
    }
  }, [selectedSpineId, evaluations, onSelectEvent]);

  const handlePaneClick = useCallback(() => {
    setSelectedSpineId(null);
    setSelectedHumanNodeId(null);
    setOpenSourceId(null);
    onSelectEvent(null);
  }, [onSelectEvent]);

  const handleMove: OnMove = useCallback((_event, vp) => {
    setViewport(vp);
  }, []);

  // ── Register-driven highlight node ID for CanvasController pan ───────────
  const highlightedNodeId = useMemo(() => {
    if (selectedEventIndex === null) return null;
    const record = evaluations.find((r) => r.event_index === selectedEventIndex);
    return record?.event_id ?? null;
  }, [selectedEventIndex, evaluations]);

  // ── Drawer data ───────────────────────────────────────────────────────────
  const selectedRecord = selectedSpineId
    ? (evaluations.find((r) => r.event_id === selectedSpineId) ?? null)
    : null;
  const selectedEvent = selectedSpineId
    ? (events.find((e) => e.event_id === selectedSpineId) ?? null)
    : null;

  // Derive HumanDecision from the selected human node id (e.g. "human-2" → event_index 2)
  const selectedHumanDecision: HumanDecision | null = useMemo(() => {
    if (!selectedHumanNodeId) return null;
    const idx = parseInt(selectedHumanNodeId.replace("human-", ""), 10);
    const record = evaluations.find((r) => r.event_index === idx);
    return record?.human_decision ?? null;
  }, [selectedHumanNodeId, evaluations]);

  // Hide drawers when intervention card is showing
  const drawerOpen = selectedRecord !== null && pendingIntervention === null;
  const humanDrawerOpen = selectedHumanDecision !== null && pendingIntervention === null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Mobile fallback — vertical card list (hidden on md+) ─────────── */}
      <div className="block md:hidden h-full overflow-y-auto bg-gray-950 p-3">
        {evaluations.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-600 text-sm">
            Advance the scenario to begin
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {[...evaluations].reverse().map((record, i) => {
              const ev = record.evaluation;
              const risk = ev.risk_level;
              const borderColor = riskBorderHex[risk] ?? "#4b5563";
              const colors = getRiskColors(risk);
              const isLatest = i === 0;
              const event = events.find((e) => e.event_id === record.event_id);
              return (
                <div
                  key={record.event_id}
                  style={{
                    background: "#111827",
                    border: `1px solid ${isLatest ? borderColor : "#1f2937"}`,
                    borderLeft: `3px solid ${borderColor}`,
                    borderRadius: 8,
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#d1d5db" }}>
                      {formatEventType(record.event_type)}
                    </div>
                    <span
                      style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "1px 6px", borderRadius: 4 }}
                      className={`${colors.text} ${colors.bg}`}
                    >
                      {risk}
                    </span>
                  </div>
                  {event?.day_offset != null && (
                    <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 4 }}>Day {event.day_offset}</div>
                  )}
                  <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5, margin: 0 }}>
                    {ev.reasoning_summary}
                  </p>
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>
                      {Math.round((ev.confidence ?? 0) * 100)}% conf
                    </span>
                    {record.status === "pending_human_review" && (
                      <span style={{ fontSize: 9, color: "#f59e0b" }}>· Review required</span>
                    )}
                    {record.status === "human_reviewed" && (
                      <span style={{ fontSize: 9, color: "#22c55e" }}>· Human reviewed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Intervention card on mobile */}
        {pendingIntervention && (
          <div className="mt-3">
            <InterventionCard
              evaluation={pendingIntervention.evaluation}
              interventionOptions={pendingIntervention.interventionOptions}
              onIntervene={onIntervene}
            />
          </div>
        )}
      </div>

      {/* ── Desktop canvas (hidden on mobile) ────────────────────────────── */}
    <div
      ref={containerRef}
      className="hidden md:block"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#030712",
        overflow: "hidden",
      }}
    >
      {/* ── KPI line — absolute SVG overlay above the canvas ─────────────── */}
      {kpiPoints.length > 0 && (
        <KpiLine
          points={kpiPoints}
          kpiRange={config.canvas.kpiRange}
          kpiThresholdValue={config.canvas.kpiThresholdValue}
          kpiThresholdLabel={config.canvas.kpiThresholdLabel}
          kpiLabel={config.canvas.kpiLabel}
          viewportX={viewport.x}
          viewportY={viewport.y}
          viewportZoom={viewport.zoom}
          width={containerSize.width}
          height={containerSize.height}
          kpiHeight={KPI_HEIGHT}
          selectedId={selectedSpineId}
        />
      )}

      {/* ── React Flow canvas ─────────────────────────────────────────────── */}
      {evaluations.length === 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 13, color: "#4b5563" }}>No events yet</div>
          <div style={{ fontSize: 11, color: "#374151" }}>
            Advance the scenario to begin
          </div>
        </div>
      ) : (
        <ReactFlow
          nodes={allNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onMove={handleMove}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          style={{ background: "#030712" }}
        >
          <Background color="#111827" gap={24} size={1} />
          <Controls
            showInteractive={false}
            style={{ bottom: 16, left: 16, top: "auto" }}
          />
          <CanvasController latestNodeId={latest?.event_id ?? null} highlightedNodeId={highlightedNodeId} />
        </ReactFlow>
      )}

      {/* ── Node detail drawer — slides in from right ─────────────────────── */}
      {drawerOpen && selectedRecord && (
        <NodeDetailDrawer
          record={selectedRecord}
          eventType={selectedRecord.event_type}
          dayOffset={selectedEvent?.day_offset}
          config={config}
          scenarioId={scenarioId}
          onClose={() => { setSelectedSpineId(null); onSelectEvent(null); }}
        />
      )}

      {/* ── Human decision drawer — slides in from right ──────────────────── */}
      {humanDrawerOpen && selectedHumanDecision && (
        <HumanDecisionDrawer
          decision={selectedHumanDecision}
          config={config}
          scenarioId={scenarioId}
          onClose={() => setSelectedHumanNodeId(null)}
        />
      )}

      {/* ── Intervention card — full-canvas overlay ────────────────────────── */}
      {pendingIntervention && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(3, 7, 18, 0.88)",
            backdropFilter: "blur(3px)",
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "calc(100% - 48px)",
              overflowY: "auto",
            }}
          >
            <InterventionCard
              evaluation={pendingIntervention.evaluation}
              interventionOptions={pendingIntervention.interventionOptions}
              onIntervene={onIntervene}
            />
          </div>
        </div>
      )}
    </div>
    </>
  );
}
