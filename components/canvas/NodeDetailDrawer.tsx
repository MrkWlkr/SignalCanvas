"use client";

import { useState } from "react";
import { riskBorderHex, getRiskColors, formatEventType } from "@/components/ui";
import type { EvaluationRecord } from "@/types";

interface NodeDetailDrawerProps {
  record: EvaluationRecord;
  eventType: string;
  dayOffset?: number;
  onClose: () => void;
}

// NodeDetailDrawer — slides in from the right when a spine node is selected.
// Shows the full evaluation output: reasoning, domains, actions, next checks,
// tool trace, and collapsible raw JSON.

export function NodeDetailDrawer({ record, eventType, dayOffset, onClose }: NodeDetailDrawerProps) {
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const ev = record.evaluation;
  const risk = ev.risk_level;
  const borderColor = riskBorderHex[risk] ?? "#4b5563";
  const colors = getRiskColors(risk);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 360,
        height: "100%",
        background: "#0a0f1a",
        borderLeft: "1px solid #1f2937",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "drawerSlideIn 0.2s ease-out",
      }}
    >
      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(360px); }
          to   { transform: translateX(0); }
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 14px 10px",
          borderBottom: "1px solid #1f2937",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb", lineHeight: 1.3 }}>
            {formatEventType(eventType)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span
              style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "1px 6px", borderRadius: 4 }}
              className={`${colors.text} ${colors.bg}`}
            >
              {risk}
            </span>
            <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
              {Math.round((ev.confidence ?? 0) * 100)}% confidence
            </span>
            {dayOffset != null && (
              <span style={{ fontSize: 10, color: "#4b5563" }}>· Day {dayOffset}</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#6b7280",
            cursor: "pointer",
            padding: "2px 4px",
            fontSize: 16,
            lineHeight: 1,
            borderRadius: 4,
            flexShrink: 0,
          }}
          className="hover:text-gray-300 hover:bg-gray-800"
          aria-label="Close drawer"
        >
          ✕
        </button>
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>

        {/* Reasoning summary */}
        <div
          style={{
            background: "#111827",
            borderLeft: `3px solid ${borderColor}`,
            borderRadius: "0 6px 6px 0",
            padding: "10px 12px",
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Reasoning
          </div>
          <p style={{ fontSize: 12, color: "#d1d5db", lineHeight: 1.55, margin: 0 }}>
            {ev.reasoning_summary}
          </p>
        </div>

        {/* Affected domains */}
        {ev.affected_domains.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Affected domains</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {ev.affected_domains.map((d) => (
                <span
                  key={d}
                  style={{
                    fontSize: 10,
                    color: "#9ca3af",
                    background: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: 10,
                    padding: "2px 8px",
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recommended actions */}
        {(ev.recommended_actions?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Recommended actions</SectionLabel>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
              {(ev.recommended_actions ?? []).map((action, i) => (
                <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 9, color: "#4b5563", fontFamily: "monospace", lineHeight: "18px", flexShrink: 0, fontWeight: 700 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.45 }}>{action}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Next checks */}
        {ev.next_checks.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Next checks</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ev.next_checks.map((check, i) => {
                const parts = check.split(" — ");
                const dimension = parts[0] ?? check;
                const explanation = parts.slice(1).join(" — ");
                return (
                  <div key={i} style={{ fontSize: 11, lineHeight: 1.45 }}>
                    <span style={{ color: "#93c5fd", fontWeight: 600 }}>{dimension}</span>
                    {explanation && (
                      <span style={{ color: "#6b7280" }}> — {explanation}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Intervention routing metadata */}
        <div style={{ marginBottom: 14 }}>
          <SectionLabel>Decision metadata</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <MetaRow label="Decision type" value={ev.decision_type.replace(/_/g, " ")} />
            <MetaRow label="Impact" value={ev.impact_magnitude} />
            <MetaRow label="Reversibility" value={ev.reversibility.replace(/_/g, " ")} />
            {ev.human_review_reason && (
              <div style={{ marginTop: 2 }}>
                <div style={{ fontSize: 9, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                  Review reason
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.45 }}>
                  {ev.human_review_reason}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tool call trace */}
        {record.tool_trace.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Tool trace ({record.tool_trace.length})</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {record.tool_trace.map((trace, i) => {
                const inputStr = Object.values(trace.tool_input).join(", ");
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      padding: "5px 8px",
                      background: "#0f172a",
                      borderRadius: 4,
                      borderLeft: "2px solid #1e3a5f",
                    }}
                  >
                    <span style={{ fontSize: 9, color: "#4b5563", fontFamily: "monospace", lineHeight: "16px", flexShrink: 0, fontWeight: 700 }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#60a5fa", fontFamily: "monospace", fontWeight: 600, marginBottom: 1 }}>
                        {trace.tool_name}
                      </div>
                      {inputStr && (
                        <div style={{ fontSize: 9, color: "#6b7280", fontFamily: "monospace", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          {inputStr}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsible raw JSON */}
        <div>
          <button
            onClick={() => setJsonExpanded(!jsonExpanded)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              padding: "4px 0",
              cursor: "pointer",
              marginBottom: jsonExpanded ? 8 : 0,
            }}
          >
            <span style={{ fontSize: 9, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Raw JSON
            </span>
            <span style={{ fontSize: 9, color: "#374151" }}>{jsonExpanded ? "▲" : "▼"}</span>
          </button>
          {jsonExpanded && (
            <pre
              style={{
                margin: 0,
                padding: "10px 12px",
                background: "#0d1117",
                border: "1px solid #1f2937",
                borderRadius: 6,
                fontSize: 9,
                color: "#6b7280",
                overflowX: "auto",
                lineHeight: 1.5,
                fontFamily: "monospace",
              }}
            >
              {JSON.stringify(record.evaluation, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 10, color: "#4b5563" }}>{label}</span>
      <span style={{ fontSize: 10, color: "#9ca3af", textTransform: "capitalize" }}>{value}</span>
    </div>
  );
}
