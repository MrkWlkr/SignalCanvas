"use client";

import type { HumanDecision } from "@/types";
import type { DomainConfig } from "@/lib/domain-config";

interface HumanDecisionDrawerProps {
  decision: HumanDecision;
  config: DomainConfig;
  scenarioId: string;
  onClose: () => void;
}

const impactColors: Record<string, { text: string; bg: string }> = {
  low:      { text: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  medium:   { text: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  high:     { text: "#f97316", bg: "rgba(249,115,22,0.1)" },
  critical: { text: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

const reversibilityLabel: Record<string, string> = {
  reversible: "Reversible",
  partially_reversible: "Partially reversible",
  irreversible: "Irreversible",
};

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color,
        background: bg,
        padding: "2px 7px",
        borderRadius: 4,
      }}
    >
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4b5563", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #1f2937", margin: "16px 0" }} />;
}

export function HumanDecisionDrawer({ decision, config, scenarioId, onClose }: HumanDecisionDrawerProps) {
  const pathColor = decision.path_switched ? "#4ade80" : "#fbbf24";
  const impactColor = impactColors[decision.impact_magnitude] ?? impactColors.medium;
  const counterfactual = config.counterfactuals?.[scenarioId];

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 380,
        height: "100%",
        background: "#0a0f1a",
        borderLeft: "1px solid #1f2937",
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: "1px solid #1f2937",
          position: "sticky",
          top: 0,
          background: "#0a0f1a",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: pathColor,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb" }}>Human Decision</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#6b7280",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: "2px 4px",
          }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

        {/* Section 1 — Situation Presented */}
        <SectionLabel>Situation presented</SectionLabel>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <Badge
            label={decision.impact_magnitude}
            color={impactColor.text}
            bg={impactColor.bg}
          />
          <Badge
            label={reversibilityLabel[decision.reversibility] ?? decision.reversibility}
            color="#94a3b8"
            bg="rgba(148,163,184,0.1)"
          />
        </div>
        <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6, margin: "0 0 8px" }}>
          {decision.situation_summary}
        </p>
        {decision.human_review_reason && (
          <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.5, margin: 0, fontStyle: "italic" }}>
            &ldquo;{decision.human_review_reason}&rdquo;
          </p>
        )}

        <Divider />

        {/* Section 2 — Decision Made */}
        <SectionLabel>Decision made</SectionLabel>
        <div
          style={{
            background: decision.path_switched ? "rgba(34,197,94,0.06)" : "rgba(245,158,11,0.06)",
            border: `1px solid ${decision.path_switched ? "#166534" : "#92400e"}`,
            borderRadius: 6,
            padding: "10px 12px",
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: pathColor, marginBottom: 4 }}>
            {decision.option_label}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>
            {decision.simulated_response_minutes} min response · {decision.options_enabled} of {decision.options_presented} options enabled
          </div>
        </div>
        {decision.decision_recorded_at && (
          <div style={{ fontSize: 10, color: "#4b5563" }}>
            Recorded {new Date(decision.decision_recorded_at).toLocaleString()}
          </div>
        )}

        <Divider />

        {/* Section 3 — Outcome */}
        <SectionLabel>Outcome</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: pathColor,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, color: pathColor, fontWeight: 600 }}>
            {decision.path_switched ? `Path switched → ${decision.path_name ?? "resolved"}` : "Continued on default path"}
          </span>
        </div>
        {decision.register_items_resolved.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 6 }}>
              Register items resolved ({decision.register_items_resolved.length})
            </div>
            {decision.register_items_resolved.map((id) => (
              <div
                key={id}
                style={{
                  display: "inline-block",
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: "#4ade80",
                  background: "rgba(74,222,128,0.08)",
                  border: "1px solid #166534",
                  borderRadius: 4,
                  padding: "1px 6px",
                  marginRight: 4,
                  marginBottom: 4,
                }}
              >
                {id}
              </div>
            ))}
          </div>
        )}

        {/* Section 4 — Counterfactual */}
        {counterfactual && (
          <>
            <Divider />
            <SectionLabel>Counterfactual — what would have happened</SectionLabel>

            {/* Default path outcome */}
            <div
              style={{
                background: "rgba(239,68,68,0.05)",
                border: "1px solid #7f1d1d",
                borderRadius: 6,
                padding: "10px 12px",
                marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#ef4444", marginBottom: 6 }}>
                Without this decision
              </div>
              {counterfactual.defaultPathOutcome.key_consequences.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <span style={{ color: "#7f1d1d", flexShrink: 0 }}>✗</span>
                  <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>{c}</span>
                </div>
              ))}
            </div>

            {/* Resolved path outcome */}
            <div
              style={{
                background: "rgba(34,197,94,0.05)",
                border: "1px solid #166534",
                borderRadius: 6,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#4ade80", marginBottom: 6 }}>
                With this decision
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ color: "#166534", flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>
                  {counterfactual.resolvedPathOutcome.key_resolution}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
