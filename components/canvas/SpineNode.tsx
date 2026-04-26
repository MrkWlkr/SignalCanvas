"use client";

import { Handle, Position } from "reactflow";
import { riskBorderHex, riskStroke, formatEventType, getRiskColors } from "@/components/ui";
import type { SpineNodeData } from "@/lib/canvas-data";
import { SPINE_NODE_WIDTH, SPINE_NODE_HEIGHT } from "@/lib/canvas-data";

// SpineNode is the primary decision node on the horizontal spine.
// It adapts its visual state based on selection, compression, latest, and intervention flags.

export function SpineNode({ data }: { data: SpineNodeData }) {
  const { evaluation, eventType, eventCategory, dayOffset, formattedDate,
          isSelected, isCompressed, isLatest, hasIntervention,
          isRegisterHighlighted, isAdvancing } = data;

  const risk = evaluation.risk_level;
  const borderColor = riskBorderHex[risk] ?? "#4b5563";
  const colors = getRiskColors(risk);
  const confidence = evaluation.confidence ?? 0;

  // ── Compressed state — small colored circle ─────────────────────────────────
  if (isCompressed) {
    return (
      <>
        <Handle type="target" position={Position.Left} style={{ background: "#374151", border: "none" }} />
        <div
          title={`${formatEventType(eventType)}${dayOffset != null ? ` — Day ${dayOffset}` : ""}`}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: borderColor,
            opacity: 0.6,
            border: "2px solid " + borderColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "opacity 0.2s",
          }}
          className="hover:opacity-90"
        >
          <span style={{ fontSize: 9, color: "#fff", fontWeight: 700, textTransform: "uppercase" }}>
            {risk.slice(0, 1)}
          </span>
        </div>
        <Handle type="source" position={Position.Right} style={{ background: "#374151", border: "none" }} />
      </>
    );
  }

  // ── Normal / selected / latest / register-highlighted state ─────────────────
  const boxShadow = isSelected
    ? `0 0 0 2px ${borderColor}, 0 4px 20px ${borderColor}33`
    : isRegisterHighlighted
    ? `0 0 0 2px #e5e7eb, 0 4px 16px #e5e7eb33`
    : isLatest
    ? `0 0 14px ${borderColor}33`
    : "none";

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: "#374151", border: "none" }} />

      <div
        style={{
          width: SPINE_NODE_WIDTH,
          minHeight: SPINE_NODE_HEIGHT,
          background: "#111827",
          border: `1.5px solid ${isSelected ? borderColor : isRegisterHighlighted ? "#e5e7eb" : "#1f2937"}`,
          borderRadius: 8,
          overflow: "visible",
          cursor: "pointer",
          boxShadow,
          transition: "border-color 0.2s, box-shadow 0.2s",
          position: "relative",
        }}
        className={isSelected ? "" : "hover:border-gray-600"}
      >
        {/* Left risk border — pulses on latest */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: borderColor,
            borderRadius: "8px 0 0 8px",
          }}
          className={isLatest && !isAdvancing ? "animate-pulse" : ""}
        />

        {/* Human intervention badge */}
        {hasIntervention && (
          <div
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              background: "#f59e0b",
              borderRadius: "50%",
              width: 18,
              height: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              zIndex: 10,
              border: "1.5px solid #111827",
            }}
          >
            👤
          </div>
        )}

        {/* Advancing spinner */}
        {isAdvancing && (
          <div
            style={{
              position: "absolute",
              top: -6,
              right: hasIntervention ? 16 : -6,
              background: "#3b82f6",
              borderRadius: "50%",
              width: 14,
              height: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <svg className="animate-spin h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        )}

        <div style={{ padding: "10px 12px 8px 16px" }}>
          {/* Category + event type */}
          {eventCategory && (
            <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>
              {eventCategory.replace(/_/g, " ")}
            </div>
          )}
          <div style={{ fontSize: 11, color: "#d1d5db", fontWeight: 500, lineHeight: 1.3, marginBottom: 6 }}>
            {formatEventType(eventType)}
          </div>

          {/* Risk badge + confidence */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "1px 6px",
                borderRadius: 4,
              }}
              className={`${colors.text} ${colors.bg}`}
            >
              {risk}
            </span>
            <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>
              {Math.round(confidence * 100)}%
            </span>
            {isAdvancing && (
              <span style={{ fontSize: 9, color: "#3b82f6", fontStyle: "italic" }}>
                reasoning…
              </span>
            )}
          </div>

          {/* Date display */}
          {formattedDate ? (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 9, color: "#6b7280" }}>{formattedDate.primary}</div>
              <div style={{ fontSize: 9, color: "#374151" }}>{formattedDate.secondary}</div>
            </div>
          ) : dayOffset != null ? (
            <div style={{ fontSize: 9, color: "#4b5563", marginTop: 4 }}>Day {dayOffset}</div>
          ) : null}

          {/* Domain pills — only when selected */}
          {isSelected && evaluation.affected_domains.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 3 }}>
              {evaluation.affected_domains.slice(0, 3).map((d) => (
                <span
                  key={d}
                  style={{
                    fontSize: 8,
                    color: "#9ca3af",
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: 10,
                    padding: "1px 5px",
                  }}
                >
                  {d}
                </span>
              ))}
              {evaluation.affected_domains.length > 3 && (
                <span style={{ fontSize: 8, color: "#6b7280" }}>
                  +{evaluation.affected_domains.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: "#374151", border: "none" }} />
    </>
  );
}
