"use client";

import { Handle, Position } from "reactflow";
import type { SourceNodeData } from "@/lib/canvas-data";
import { SOURCE_NODE_WIDTH, SOURCE_NODE_HEIGHT } from "@/lib/canvas-data";

// SourceNode represents a data system the agent queried for this event.
// Clicking it opens an inline popover showing tools called and key results.

export function SourceNode({ data }: { data: SourceNodeData }) {
  const { sourceSystem, toolsCalled, keyResults, isOpen } = data;

  return (
    <>
      <Handle type="source" position={Position.Top} style={{ background: "#374151", border: "none" }} />

      <div style={{ position: "relative" }}>
        {/* ── Popover — rendered above the node, outside React Flow flow ─────── */}
        {isOpen && (
          <div
            style={{
              position: "absolute",
              bottom: SOURCE_NODE_HEIGHT + 10,
              left: "50%",
              transform: "translateX(-50%)",
              width: 240,
              background: "#111827",
              border: "1px solid #374151",
              borderRadius: 8,
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              zIndex: 50,
              padding: "10px 12px",
              pointerEvents: "all",
            }}
          >
            {/* Arrow */}
            <div
              style={{
                position: "absolute",
                bottom: -6,
                left: "50%",
                width: 10,
                height: 10,
                background: "#111827",
                border: "1px solid #374151",
                borderTop: "none",
                borderLeft: "none",
                transform: "translateX(-50%) rotate(45deg)",
              }}
            />

            <div style={{ fontSize: 11, fontWeight: 700, color: "#e5e7eb", marginBottom: 6 }}>
              {sourceSystem}
            </div>
            <div style={{ height: 1, background: "#1f2937", marginBottom: 8 }} />

            {toolsCalled.length > 0 && (
              <>
                <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  Tools called
                </div>
                <ul style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                  {toolsCalled.map((t, i) => (
                    <li key={i} style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                      <span style={{ color: "#4b5563", fontSize: 9, lineHeight: "16px", flexShrink: 0 }}>·</span>
                      <span style={{ fontSize: 10, color: "#60a5fa", fontFamily: "monospace", wordBreak: "break-all" }}>
                        {t}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {keyResults.length > 0 && (
              <>
                <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  Results
                </div>
                <ul style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {keyResults.slice(0, 5).map((kv, i) => (
                    <li key={i} style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                      <span style={{ color: "#4b5563", fontSize: 9, lineHeight: "16px", flexShrink: 0 }}>·</span>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>
                        <span style={{ color: "#6b7280" }}>{kv.field}:</span>{" "}
                        <span style={{ color: "#d1d5db" }}>{kv.value}</span>
                      </span>
                    </li>
                  ))}
                  {keyResults.length > 5 && (
                    <li style={{ fontSize: 9, color: "#4b5563", paddingLeft: 8 }}>
                      +{keyResults.length - 5} more
                    </li>
                  )}
                </ul>
              </>
            )}
          </div>
        )}

        {/* ── Node body ─────────────────────────────────────────────────────── */}
        <div
          style={{
            width: SOURCE_NODE_WIDTH,
            height: SOURCE_NODE_HEIGHT,
            background: isOpen ? "#1f2937" : "#0f172a",
            border: `1px dashed ${isOpen ? "#4b5563" : "#374151"}`,
            borderRadius: 6,
            padding: "7px 10px",
            cursor: "pointer",
            transition: "background 0.15s, border-color 0.15s",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
          className="hover:bg-gray-800/60 hover:border-gray-600"
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: isOpen ? "#e5e7eb" : "#9ca3af", marginBottom: 3, lineHeight: 1.2 }}>
            {sourceSystem}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {toolsCalled.slice(0, 2).map((t, i) => (
              <div key={i} style={{ fontSize: 9, color: "#4b5563", fontFamily: "monospace", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {t.split("(")[0]}
              </div>
            ))}
            {toolsCalled.length > 2 && (
              <div style={{ fontSize: 9, color: "#374151" }}>+{toolsCalled.length - 2} more</div>
            )}
          </div>
        </div>
      </div>

      <Handle type="target" position={Position.Bottom} style={{ background: "#374151", border: "none", opacity: 0 }} />
    </>
  );
}
