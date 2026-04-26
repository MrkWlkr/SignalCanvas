"use client";

import { useState } from "react";
import { riskBorderHex, getRiskColors, formatEventType } from "@/components/ui";
import type { EvaluationRecord } from "@/types";
import type { DomainConfig } from "@/lib/domain-config";
import { formatEventDate } from "@/lib/dates";

interface NodeDetailDrawerProps {
  record: EvaluationRecord;
  eventType: string;
  dayOffset?: number;
  config: DomainConfig;
  scenarioId: string;
  onClose: () => void;
}

const urgencyDot: Record<string, string> = {
  immediate: "#ef4444",
  urgent: "#f59e0b",
  monitor: "#6b7280",
};

const horizonLabel: Record<string, string> = {
  immediate: "Today",
  short_term: "This week",
  medium_term: "This month",
};

export function NodeDetailDrawer({
  record,
  eventType,
  dayOffset,
  config,
  scenarioId,
  onClose,
}: NodeDetailDrawerProps) {
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const ev = record.evaluation;
  const risk = ev.risk_level;
  const borderColor = riskBorderHex[risk] ?? "#4b5563";
  const colors = getRiskColors(risk);

  const monitoringStart = config.timeline.monitoringStartDates[scenarioId] ?? "";
  const formattedDate =
    monitoringStart && dayOffset != null
      ? formatEventDate(monitoringStart, dayOffset, config.timeline.granularity)
      : null;

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
            {formattedDate ? (
              <span style={{ fontSize: 10, color: "#4b5563" }}>· {formattedDate.primary}</span>
            ) : dayOffset != null ? (
              <span style={{ fontSize: 10, color: "#4b5563" }}>· Day {dayOffset}</span>
            ) : null}
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

        {/* ── Section 1: Reasoning summary ────────────────────────────────────── */}
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

        {/* ── Section 2: Agent did ─────────────────────────────────────────────── */}
        {(ev.agent_actions_taken?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Agent did</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {ev.agent_actions_taken.map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    padding: "6px 8px",
                    background: "#0f172a",
                    borderRadius: 4,
                    borderLeft: "2px solid #1e3a5f",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "#93c5fd", lineHeight: 1.4 }}>{act.action}</div>
                    <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {act.type.replace(/_/g, " ")} · {act.impact_magnitude}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section 3: Action needed (human_actions_required) ───────────────── */}
        {(ev.human_actions_required?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 14 }}>
            <SectionLabel>Action needed</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ev.human_actions_required.map((req) => (
                <div
                  key={req.id}
                  style={{
                    background: "#1a0a0a",
                    border: "1px solid #3f1515",
                    borderLeft: `3px solid ${urgencyDot[req.urgency] ?? "#6b7280"}`,
                    borderRadius: "0 6px 6px 0",
                    padding: "8px 10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: urgencyDot[req.urgency] ?? "#6b7280",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 9, color: urgencyDot[req.urgency] ?? "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                      {req.urgency}
                    </span>
                    <span style={{ fontSize: 9, color: "#4b5563", fontFamily: "monospace" }}>{req.id}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#fca5a5", lineHeight: 1.45, marginBottom: 4 }}>
                    {req.action}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 9, color: "#6b7280" }}>
                      <span style={{ color: "#4b5563" }}>Owner: </span>{req.owner}
                    </div>
                    <div style={{ fontSize: 9, color: "#6b7280" }}>
                      <span style={{ color: "#4b5563" }}>By: </span>{req.deadline}
                    </div>
                    <div style={{ fontSize: 9, color: "#9ca3af", fontStyle: "italic", lineHeight: 1.4 }}>
                      If missed: {req.consequence}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Section 4: Agent noted (surfaced_for_awareness) ─────────────────── */}
        {(ev.surfaced_for_awareness?.length ?? 0) > 0 && (
          <CollapsibleSection label="Agent noted" defaultOpen>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {ev.surfaced_for_awareness.map((obs) => (
                <div
                  key={obs.id}
                  style={{
                    padding: "6px 8px",
                    background: "#111827",
                    borderRadius: 4,
                    borderLeft: "2px solid #1f2937",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.4 }}>{obs.observation}</div>
                    <span style={{ fontSize: 8, color: "#6b7280", textTransform: "uppercase", flexShrink: 0 }}>
                      {horizonLabel[obs.horizon] ?? obs.horizon}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: "#6b7280", lineHeight: 1.4 }}>{obs.relevance}</div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* ── Collapsible detail section ───────────────────────────────────────── */}
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setDetailExpanded(!detailExpanded)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              padding: "4px 0",
              cursor: "pointer",
              marginBottom: detailExpanded ? 10 : 0,
              width: "100%",
            }}
          >
            <span style={{ fontSize: 9, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Evaluation detail
            </span>
            <span style={{ fontSize: 9, color: "#374151" }}>{detailExpanded ? "▲" : "▼"}</span>
          </button>

          {detailExpanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Decision badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                <Badge label="Decision" value={ev.decision_type.replace(/_/g, " ")} />
                <Badge label="Impact" value={ev.impact_magnitude} />
                <Badge label="Reversibility" value={ev.reversibility.replace(/_/g, " ")} />
              </div>

              {/* Next checks */}
              {ev.next_checks.length > 0 && (
                <div>
                  <SectionLabel>Next checks</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
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

              {/* Tool trace */}
              {record.tool_trace.length > 0 && (
                <div>
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

              {/* Raw JSON */}
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

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ fontSize: 9, color: "#9ca3af", background: "#1f2937", border: "1px solid #374151", borderRadius: 10, padding: "2px 8px" }}>
      <span style={{ color: "#4b5563" }}>{label}: </span>{value}
    </span>
  );
}

function CollapsibleSection({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 14 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          padding: "0 0 6px 0",
          cursor: "pointer",
          width: "100%",
        }}
      >
        <span style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
        <span style={{ fontSize: 9, color: "#374151" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && children}
    </div>
  );
}
