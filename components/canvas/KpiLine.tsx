"use client";

// KpiLine — SVG overlay above the React Flow canvas.
// Renders a smooth polyline connecting evaluation KPI values, colored per-segment
// by the downstream node's risk level, with a threshold reference line and dots.
// Synced with the React Flow viewport transform via onMove callback.

import { riskStroke } from "@/components/ui";
import type { RiskLevel } from "@/types";

interface KpiPoint {
  id: string;
  x: number;        // world-space center x of the spine node
  value: number;    // raw KPI value (e.g. 0–1 for confidence)
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
  // Height of the KPI band at the top of the canvas
  kpiHeight: number;
  selectedId: string | null;
}

// ── Layout constants ──────────────────────────────────────────────────────────
const AXIS_X = 44;       // x position of the Y axis line
const LABEL_X = 40;      // right-align tick labels to this x
const PADDING_TOP = 12;  // px from top of band to max value y
const PADDING_BTM = 12;  // px from bottom border to min value y

// Map a KPI value to a y-coordinate within the KPI band
function valueToY(
  value: number,
  range: [number, number],
  bandHeight: number
): number {
  const [min, max] = range;
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / (max - min);
  const chartTop = PADDING_TOP;
  const chartBottom = bandHeight - 1 - PADDING_BTM; // 1px for bottom border
  return chartBottom - ratio * (chartBottom - chartTop);
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
  // Convert world-space x to screen-space x
  const toScreenX = (worldX: number) => worldX * viewportZoom + viewportX;

  const [minVal, maxVal] = kpiRange;
  const midVal = (minVal + maxVal) / 2;
  const thresholdY = valueToY(kpiThresholdValue, kpiRange, kpiHeight);
  const bottomY = kpiHeight - 1; // bottom border y

  // Y axis tick definitions
  const ticks: { value: number; label: string }[] = [
    { value: maxVal,           label: maxVal.toFixed(1) },
    { value: kpiThresholdValue, label: kpiThresholdValue.toFixed(1) },
    { value: midVal,           label: midVal.toFixed(1) },
    { value: minVal,           label: minVal.toFixed(1) },
  ];
  // Deduplicate ticks that land within 4px of each other
  const dedupedTicks = ticks.filter((t, i, arr) => {
    const ty = valueToY(t.value, kpiRange, kpiHeight);
    return !arr.slice(0, i).some(
      (prev) => Math.abs(valueToY(prev.value, kpiRange, kpiHeight) - ty) < 4
    );
  });

  // ── Shared chrome (axis, background, border) ──────────────────────────────
  const chrome = (
    <>
      {/* Subtle background fill for the chart area */}
      <rect
        x={0}
        y={0}
        width={width}
        height={kpiHeight - 1}
        fill="#050c1a"
        opacity={0.55}
      />

      {/* Bottom border — separates KPI band from node canvas */}
      <line
        x1={0}
        y1={bottomY}
        x2={width}
        y2={bottomY}
        stroke="#1f2937"
        strokeWidth={1}
      />

      {/* Y axis line */}
      <line
        x1={AXIS_X}
        y1={PADDING_TOP - 2}
        x2={AXIS_X}
        y2={bottomY}
        stroke="#1f2937"
        strokeWidth={1}
      />

      {/* Tick marks and labels */}
      {dedupedTicks.map((tick) => {
        const ty = valueToY(tick.value, kpiRange, kpiHeight);
        const isThreshold = tick.value === kpiThresholdValue;
        return (
          <g key={tick.value}>
            <line
              x1={AXIS_X - 3}
              y1={ty}
              x2={AXIS_X + 3}
              y2={ty}
              stroke={isThreshold ? "#4b5563" : "#1f2937"}
              strokeWidth={1}
            />
            <text
              x={LABEL_X}
              y={ty + 3.5}
              fontSize={9}
              fill={isThreshold ? "#4b5563" : "#374151"}
              fontFamily="ui-monospace, monospace"
              textAnchor="end"
            >
              {tick.label}
            </text>
          </g>
        );
      })}

      {/* KPI label — horizontal, top-left of chart area */}
      <text
        x={AXIS_X + 4}
        y={PADDING_TOP - 1}
        fontSize={8}
        fill="#374151"
        fontFamily="ui-monospace, monospace"
        style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
      >
        {kpiLabel}
      </text>
    </>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (points.length === 0) {
    const baselineY = valueToY(0.35, kpiRange, kpiHeight);
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
        {chrome}
        {/* Suggested baseline */}
        <line
          x1={AXIS_X}
          y1={baselineY}
          x2={width}
          y2={baselineY}
          stroke="#1f2937"
          strokeWidth={1}
          strokeDasharray="6 5"
        />
        {/* Empty state label */}
        <text
          x={(width + AXIS_X) / 2}
          y={baselineY + 13}
          fontSize={10}
          fill="#374151"
          fontFamily="ui-sans-serif, sans-serif"
          textAnchor="middle"
        >
          Confidence trend will appear here
        </text>
      </svg>
    );
  }

  // ── Map points to screen space ────────────────────────────────────────────
  const screenPoints = points.map((p) => ({
    ...p,
    sx: toScreenX(p.x),
    sy: valueToY(p.value, kpiRange, kpiHeight),
  }));

  // ── Threshold reference line (runs across the chart area only) ───────────
  const thresholdLine = (
    <>
      <line
        x1={AXIS_X}
        y1={thresholdY}
        x2={width}
        y2={thresholdY}
        stroke="#374151"
        strokeWidth={1}
        strokeDasharray="6 4"
      />
      <text
        x={AXIS_X + 4}
        y={thresholdY - 3}
        fontSize={8}
        fill="#4b5563"
        fontFamily="ui-monospace, monospace"
      >
        {kpiThresholdLabel}
      </text>
    </>
  );

  // ── Single point — dot + dashed hint lines ────────────────────────────────
  if (screenPoints.length === 1) {
    const p = screenPoints[0];
    const color = riskStroke[p.riskLevel] ?? "#6b7280";
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
        {chrome}
        {thresholdLine}
        {/* Hint lines extending left and right from the single dot */}
        <line
          x1={Math.max(AXIS_X + 2, p.sx - 40)}
          y1={p.sy}
          x2={p.sx - 6}
          y2={p.sy}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.35}
        />
        <line
          x1={p.sx + 6}
          y1={p.sy}
          x2={p.sx + 40}
          y2={p.sy}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.35}
        />
        {/* Dot */}
        <circle
          cx={p.sx}
          cy={p.sy}
          r={p.id === selectedId ? 5 : 3.5}
          fill={color}
          stroke={p.id === selectedId ? "#111827" : "none"}
          strokeWidth={p.id === selectedId ? 1.5 : 0}
          opacity={0.9}
        />
        {/* Hint label */}
        <text
          x={p.sx}
          y={p.sy + 14}
          fontSize={9}
          fill="#374151"
          fontFamily="ui-sans-serif, sans-serif"
          textAnchor="middle"
        >
          Advance to build the trend
        </text>
      </svg>
    );
  }

  // ── Multi-point — smooth bezier segments ─────────────────────────────────
  const segments: { d: string; color: string }[] = [];
  for (let i = 1; i < screenPoints.length; i++) {
    const prev = screenPoints[i - 1];
    const curr = screenPoints[i];
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
      {chrome}
      {thresholdLine}

      {/* Per-segment colored bezier curves */}
      {segments.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          stroke={seg.color}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}

      {/* Dots at each evaluation point */}
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
            opacity={isSelected ? 1 : 0.75}
          />
        );
      })}
    </svg>
  );
}
