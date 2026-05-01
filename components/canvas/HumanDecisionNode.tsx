"use client";

import { Handle, Position } from "reactflow";
import type { HumanDecisionNodeData } from "@/lib/canvas-data";

// HumanDecisionNode appears above the spine between events when a human intervened.
// Amber tint = manual override (default path); green tint = intervention resolved path.

export function HumanDecisionNode({ data }: { data: HumanDecisionNodeData }) {
  const { optionLabel, pathSwitched, dayOffset, isSelected } = data;

  const bg = pathSwitched ? "#052e16" : "#451a03";
  const border = isSelected
    ? (pathSwitched ? "#4ade80" : "#fbbf24")
    : (pathSwitched ? "#166534" : "#92400e");
  const labelColor = pathSwitched ? "#4ade80" : "#fbbf24";
  const headerColor = pathSwitched ? "#16a34a" : "#d97706";

  return (
    <>
      <Handle type="target" position={Position.Bottom} style={{ background: "#374151", border: "none" }} />

      <div
        style={{
          width: 120,
          height: 64,
          background: bg,
          border: `${isSelected ? 2 : 1.5}px solid ${border}`,
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 8px",
          clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          cursor: "pointer",
          boxShadow: isSelected ? `0 0 0 2px ${pathSwitched ? "#4ade80" : "#fbbf24"}40` : "none",
        }}
      >
        <div style={{ fontSize: 8, color: headerColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
          {pathSwitched ? "✓ Human" : "Human"}
        </div>
        <div
          style={{
            fontSize: 10,
            color: labelColor,
            fontWeight: 600,
            textAlign: "center",
            lineHeight: 1.2,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {optionLabel}
        </div>
        {dayOffset != null && (
          <div style={{ fontSize: 8, color: "#6b7280", marginTop: 2 }}>Day {dayOffset}</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: "#374151", border: "none" }} />
    </>
  );
}
