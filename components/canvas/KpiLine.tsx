"use client";

// KpiLine — SVG overlay above the React Flow canvas.
// Renders a smooth polyline connecting evaluation KPI values, colored per-segment
// by the downstream node's risk level, with a threshold reference line and dots.
// Synced with the React Flow viewport transform via onMove callback.

import { riskStroke } from "@/components/ui";
import type { RiskLevel } from "@/types";

interface KpiPoint {
  id: string;
  x: number;           // world-space center x of the spine node
  value: number;       // raw KPI value (e.g. 0–1 for confidence)
  riskLevel: RiskLevel;
}

interface KpiLineProps {
  points: KpiPoint[];
  kpiRange: [number, number];
  kpiThresholdValue: number;
  kpiThresholdLabel: string;
  kpiLabel: string;
  // Viewport transform from React Flow (x offset, y offset, zoom)
  viewportX: number;
  viewportY: number;
  viewportZoom: number;
  // Canvas dimensions
  width: number;
  height: number;
  // Y position of the KPI SVG band above the canvas (in canvas-space)
  kpiHeight: number;
  selectedId: string | null;
}

// Map a KPI value to a y-coordinate within the KPI band
function valueToY(value: number, range: [number, number], bandHeight: number, padding = 10): number {
  const [min, max] = range;
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / (max - min);
  // Invert: high value → low y (top)
  return bandHeight - padding - ratio * (bandHeight - padding * 2);
}

export function KpiLine({
  points,
  kpiRange,
  kpiThresholdValue,
  kpiThresholdLabel,
  kpiLabel,
  viewportX,
  viewportY,
  viewportZoom,
  width,
  height,
  kpiHeight,
  selectedId,
}: KpiLineProps) {
  if (points.length === 0) return null;

  // Convert world-space x to screen-space x
  const toScreenX = (worldX: number) => worldX * viewportZoom + viewportX;

  // Map each point to screen coordinates within the KPI band
  const screenPoints = points.map((p) => ({
    ...p,
    sx: toScreenX(p.x),
    sy: valueToY(p.value, kpiRange, kpiHeight),
  }));

  // Threshold line y
  const thresholdY = valueToY(kpiThresholdValue, kpiRange, kpiHeight);

  // Build per-segment paths (colored by downstream risk level)
  const segments: { d: string; color: string }[] = [];
  for (let i = 1; i < screenPoints.length; i++) {
    const prev = screenPoints[i - 1];
    const curr = screenPoints[i];
    // Smooth cubic bezier — control points at 40% of segment width
    const dx = (curr.sx - prev.sx) * 0.4;
    const d = `M ${prev.sx} ${prev.sy} C ${prev.sx + dx} ${prev.sy}, ${curr.sx - dx} ${curr.sy}, ${curr.sx} ${curr.sy}`;
    const color = riskStroke[curr.riskLevel] ?? "#6b7280";
    segments.push({ d, color });
  }

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height: kpiHeight,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 5,
      }}
    >
      {/* Threshold reference line */}
      <line
        x1={0}
        y1={thresholdY}
        x2={width}
        y2={thresholdY}
        stroke="#374151"
        strokeWidth={1}
        strokeDasharray="6 4"
      />
      {/* Threshold label */}
      <text
        x={8}
        y={thresholdY - 4}
        fontSize={8}
        fill="#4b5563"
        fontFamily="ui-monospace, monospace"
      >
        {kpiThresholdLabel}
      </text>

      {/* Per-segment colored lines */}
      {segments.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          stroke={seg.color}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          opacity={0.8}
        />
      ))}

      {/* Dots at each point */}
      {screenPoints.map((p) => {
        const isSelected = p.id === selectedId;
        const color = riskStroke[p.riskLevel] ?? "#6b7280";
        return (
          <circle
            key={p.id}
            cx={p.sx}
            cy={p.sy}
            r={isSelected ? 5 : 3}
            fill={color}
            stroke={isSelected ? "#111827" : "none"}
            strokeWidth={isSelected ? 1.5 : 0}
            opacity={isSelected ? 1 : 0.7}
          />
        );
      })}

      {/* KPI label — top-left */}
      <text
        x={8}
        y={12}
        fontSize={8}
        fill="#4b5563"
        fontFamily="ui-monospace, monospace"
        style={{ textTransform: "uppercase" }}
      >
        {kpiLabel}
      </text>
    </svg>
  );
}
