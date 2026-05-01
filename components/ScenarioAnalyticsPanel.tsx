"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DomainConfig } from "@/lib/domain-config";
import {
  type ScenarioAnalytics,
  type AllAnalytics,
  aggregateScenarioAnalytics,
} from "@/lib/analytics";

interface Props {
  analytics: ScenarioAnalytics | null;
  allAnalytics: AllAnalytics | null;
  activeDomainConfig: DomainConfig;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_TEXT: Record<string, string> = {
  low: "#4ade80",
  medium: "#fbbf24",
  high: "#f97316",
  critical: "#ef4444",
};

function riskColor(level: string) {
  return RISK_TEXT[level] ?? "#9ca3af";
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function fmtNum(n: number) {
  return n.toLocaleString();
}

function domainPillLabel(id: string) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "#4b5563",
        marginBottom: 8,
        marginTop: 14,
      }}
    >
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  valueColor,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 5,
      }}
    >
      <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
      <span
        style={{
          fontSize: 11,
          color: valueColor ?? "#d1d5db",
          fontFamily: mono ? "monospace" : undefined,
          fontWeight: mono ? 500 : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── KPI Sparkline tooltip ─────────────────────────────────────────────────────

function SparkTooltip({ active, payload }: { active?: boolean; payload?: unknown[] }) {
  if (!active || !Array.isArray(payload) || !payload[0]) return null;
  const d = (payload[0] as { payload: ScenarioAnalytics["kpiArc"][number] }).payload;
  return (
    <div
      style={{
        background: "#0a0f1a",
        border: "1px solid #1f2937",
        padding: "5px 8px",
        borderRadius: 4,
        fontSize: 10,
        maxWidth: 160,
      }}
    >
      <div style={{ color: "#9ca3af", marginBottom: 2 }}>
        {d.eventType.replace(/_/g, " ")}
      </div>
      <div style={{ color: "#e5e7eb", fontWeight: 600 }}>{pct(d.kpiValue)}</div>
      <div
        style={{
          color: riskColor(d.riskLevel),
          textTransform: "uppercase",
          fontSize: 8,
          marginTop: 1,
        }}
      >
        {d.riskLevel}
      </div>
    </div>
  );
}

// ── All-session totals view ───────────────────────────────────────────────────

function AllTotalsView({
  allAnalytics,
}: {
  allAnalytics: AllAnalytics;
}) {
  const { totals, domainGroups } = allAnalytics;

  return (
    <div>
      <SectionHeader>Session totals</SectionHeader>
      <Row label="Scenarios run" value={totals.scenariosRun} mono />
      <Row label="Events processed" value={fmtNum(totals.eventsProcessed)} mono />
      <Row label="Interventions triggered" value={totals.interventions} mono />
      <Row label="Human overrides" value={totals.overrides} mono />

      {Object.entries(domainGroups).map(([domainId, scenarios]) => (
        <div key={domainId} style={{ marginTop: 4, paddingLeft: 8 }}>
          <Row
            label={`  ${domainPillLabel(domainId)}`}
            value={`${scenarios.reduce((s, a) => s + a.eventsProcessed, 0)} events`}
            valueColor="#6b7280"
          />
        </div>
      ))}

      <SectionHeader>API usage this session</SectionHeader>
      <Row label="Claude API calls" value={fmtNum(totals.totalApiCalls)} mono />
      <Row label="Total tokens" value={`~${fmtNum(totals.totalTokens)}`} mono />
      <Row
        label="Est. session cost"
        value={`$${totals.totalCostEstimate.toFixed(4)}`}
        mono
        valueColor="#a78bfa"
      />
      <div
        style={{
          marginTop: 8,
          fontSize: 9,
          color: "#374151",
          fontStyle: "italic",
          lineHeight: 1.5,
        }}
      >
        Estimates based on claude-sonnet-4-6 pricing. Actual costs may vary.
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScenarioAnalyticsPanel({
  analytics,
  allAnalytics,
  activeDomainConfig,
  onClose,
}: Props) {
  // Determine unique domain IDs that have analytics data
  const domainIds = useMemo(
    () => Object.keys(allAnalytics?.domainGroups ?? {}),
    [allAnalytics]
  );
  const showPills = domainIds.length >= 2;

  // Default to the current scenario's domain (or "all" if no analytics yet)
  const [selectedView, setSelectedView] = useState<string>(
    analytics?.domainId ?? "all"
  );

  // Derive what data to show based on selected view
  const displayAnalytics = useMemo((): ScenarioAnalytics | null => {
    if (selectedView === "all") return null;
    const group = allAnalytics?.domainGroups[selectedView];
    if (group && group.length > 0) return aggregateScenarioAnalytics(group);
    return analytics;
  }, [selectedView, allAnalytics, analytics]);

  const showAllView = selectedView === "all";

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!analytics && !allAnalytics) {
    return (
      <div
        style={{
          padding: "32px 16px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ fontSize: 12, color: "#4b5563" }}>Run a scenario to see analytics</div>
        <div style={{ fontSize: 10, color: "#374151" }}>
          Advance through events to populate metrics
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 14px 16px" }}>
      {/* Domain filter pills */}
      {showPills && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 10, marginBottom: 2 }}>
          <button
            onClick={() => setSelectedView("all")}
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 4,
              border: `1px solid ${selectedView === "all" ? "#6366f1" : "#374151"}`,
              background: selectedView === "all" ? "rgba(99,102,241,0.15)" : "transparent",
              color: selectedView === "all" ? "#818cf8" : "#6b7280",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            All
          </button>
          {domainIds.map((id) => (
            <button
              key={id}
              onClick={() => setSelectedView(id)}
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 4,
                border: `1px solid ${selectedView === id ? "#6366f1" : "#374151"}`,
                background: selectedView === id ? "rgba(99,102,241,0.15)" : "transparent",
                color: selectedView === id ? "#818cf8" : "#6b7280",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {domainPillLabel(id)}
            </button>
          ))}
        </div>
      )}

      {/* All-session totals view */}
      {showAllView && allAnalytics && (
        <AllTotalsView allAnalytics={allAnalytics} />
      )}

      {/* Per-domain / current scenario view */}
      {!showAllView && displayAnalytics && (
        <>
          {/* Current scenario info */}
          <SectionHeader>Scenario</SectionHeader>
          <div style={{ fontSize: 11, color: "#d1d5db", marginBottom: 3 }}>
            {displayAnalytics.scenarioLabel}
          </div>
          <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>
            Events processed:{" "}
            <span style={{ color: "#9ca3af" }}>
              {displayAnalytics.eventsProcessed} of {displayAnalytics.totalEvents}
            </span>{" "}
            {displayAnalytics.isComplete ? (
              <span style={{ color: "#4ade80" }}>✓ Complete</span>
            ) : (
              <span style={{ color: "#f59e0b" }}>● In progress</span>
            )}
          </div>

          {/* Agent behavior */}
          <SectionHeader>Agent behavior</SectionHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
            <div>
              <Row
                label="Autonomous"
                value={`${displayAnalytics.autonomousDecisions} (${pct(displayAnalytics.autonomousRate)})`}
                valueColor="#4ade80"
              />
              <Row
                label="Human review"
                value={`${displayAnalytics.humanReviewTriggered} (${pct(1 - displayAnalytics.autonomousRate)})`}
                valueColor="#fbbf24"
              />
            </div>
            <div>
              <Row label="Resolved" value={displayAnalytics.interventionsResolved} />
              <Row label="Overrides" value={displayAnalytics.overridesRecorded} />
            </div>
          </div>
          {/* Autonomous bar */}
          <div style={{ marginTop: 4, marginBottom: 2 }}>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "#1f2937",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: pct(displayAnalytics.autonomousRate),
                  background: "linear-gradient(90deg, #16a34a, #4ade80)",
                  borderRadius: 3,
                  transition: "width 0.4s",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 9,
                color: "#4b5563",
                marginTop: 3,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "#4ade80" }}>
                {pct(displayAnalytics.autonomousRate)} autonomous
              </span>
              <span style={{ color: "#fbbf24" }}>
                {pct(1 - displayAnalytics.autonomousRate)} human review
              </span>
            </div>
          </div>

          {/* Risk profile */}
          <SectionHeader>Risk profile</SectionHeader>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 4,
              textAlign: "center",
            }}
          >
            {[
              { label: "Start", risk: displayAnalytics.startingRisk, conf: displayAnalytics.startingConfidence },
              { label: "Peak", risk: displayAnalytics.peakRisk, conf: displayAnalytics.peakConfidence },
              { label: "Final", risk: displayAnalytics.finalRisk, conf: displayAnalytics.finalConfidence },
            ].map(({ label, risk, conf }) => (
              <div
                key={label}
                style={{
                  background: "#0f172a",
                  border: "1px solid #1f2937",
                  borderRadius: 5,
                  padding: "6px 4px",
                }}
              >
                <div style={{ fontSize: 9, color: "#4b5563", marginBottom: 4 }}>{label}</div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: riskColor(risk),
                    letterSpacing: "0.04em",
                  }}
                >
                  {risk}
                </div>
                <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2, fontFamily: "monospace" }}>
                  {pct(conf)}
                </div>
              </div>
            ))}
          </div>

          {/* KPI sparkline */}
          <SectionHeader>{activeDomainConfig.canvas.kpiLabel}</SectionHeader>
          {displayAnalytics.kpiArc.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart
                  data={displayAnalytics.kpiArc}
                  margin={{ top: 6, right: 6, bottom: 4, left: 6 }}
                >
                  <Line
                    type="monotone"
                    dataKey="kpiValue"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: "#818cf8" }}
                    isAnimationActive={false}
                  />
                  <ReferenceLine
                    y={activeDomainConfig.canvas.kpiThresholdValue}
                    stroke="#374151"
                    strokeDasharray="4 3"
                    label={{
                      value: activeDomainConfig.canvas.kpiThresholdLabel,
                      position: "insideTopRight",
                      fontSize: 8,
                      fill: "#4b5563",
                    }}
                  />
                  <Tooltip content={<SparkTooltip />} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 9, color: "#4b5563", textAlign: "center", marginTop: 2 }}>
                {displayAnalytics.kpiArc.length} events ·{" "}
                {pct(displayAnalytics.kpiArc[0]?.kpiValue ?? 0)} →{" "}
                {pct(displayAnalytics.kpiArc[displayAnalytics.kpiArc.length - 1]?.kpiValue ?? 0)}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 10, color: "#374151" }}>No data yet</div>
          )}

          {/* Action register summary */}
          <SectionHeader>Action register</SectionHeader>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 10, color: "#4b5563" }}>Total issued</span>
            <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
              {displayAnalytics.totalActionsIssued}
            </span>
          </div>
          {[
            { dot: "#f59e0b", label: "● Active", value: displayAnalytics.active, color: displayAnalytics.active > 0 ? "#fbbf24" : "#6b7280" },
            { dot: "#4ade80", label: "✓ Resolved (human)", value: displayAnalytics.resolvedByHuman, color: "#4ade80" },
            { dot: "#4ade80", label: "✓ Resolved (system)", value: displayAnalytics.resolvedBySystem, color: "#4ade80" },
            { dot: "#ef4444", label: "⚠ Missed", value: displayAnalytics.missed, color: displayAnalytics.missed > 0 ? "#ef4444" : "#6b7280", bold: displayAnalytics.missed > 0 },
            { dot: "#4b5563", label: "→ Superseded", value: displayAnalytics.superseded, color: "#6b7280" },
          ].map(({ label, value, color, bold }) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 10, color: "#6b7280" }}>{label}</span>
              <span
                style={{
                  fontSize: 11,
                  color,
                  fontFamily: "monospace",
                  fontWeight: bold ? 700 : undefined,
                }}
              >
                {value}
              </span>
            </div>
          ))}
          {displayAnalytics.missed > 0 && (
            <div
              style={{
                background: "rgba(239,68,68,0.07)",
                border: "1px solid #7f1d1d",
                borderRadius: 5,
                padding: "6px 8px",
                marginTop: 4,
                fontSize: 10,
                color: "#fca5a5",
                lineHeight: 1.5,
              }}
            >
              ⚠ {displayAnalytics.missed} action(s) were not taken — consequences materialized in subsequent events
            </div>
          )}

          {/* API usage */}
          <SectionHeader>API usage this session</SectionHeader>
          <Row label="Claude API calls" value={fmtNum(displayAnalytics.totalApiCalls)} mono />
          <Row
            label="Avg tokens per call"
            value={displayAnalytics.avgTokensPerCall > 0 ? `~${fmtNum(displayAnalytics.avgTokensPerCall)}` : "—"}
            mono
          />
          <Row
            label="Total tokens"
            value={displayAnalytics.totalTokens > 0 ? `~${fmtNum(displayAnalytics.totalTokens)}` : "—"}
            mono
          />
          <Row
            label="Est. session cost"
            value={
              displayAnalytics.totalCostEstimate > 0
                ? `$${displayAnalytics.totalCostEstimate.toFixed(4)}`
                : "—"
            }
            mono
            valueColor="#a78bfa"
          />
          <div
            style={{
              marginTop: 8,
              fontSize: 9,
              color: "#374151",
              fontStyle: "italic",
              lineHeight: 1.5,
            }}
          >
            Estimates based on claude-sonnet-4-6 pricing. Actual costs may vary.
          </div>
        </>
      )}
    </div>
  );
}
