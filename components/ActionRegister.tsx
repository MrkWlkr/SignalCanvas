"use client";

import { useState } from "react";
import type { ActionRegisterEntry } from "@/types";

interface Props {
  register: ActionRegisterEntry[];
  selectedEventIndex: number | null;
  onEntryClick: (eventIndex: number | null) => void;
}

const urgencyDot: Record<string, string> = {
  immediate: "#ef4444",
  urgent: "#f59e0b",
  monitor: "#6b7280",
};

const statusColors: Record<ActionRegisterEntry["status"], { text: string; border: string; dot: string }> = {
  active:          { text: "#fbbf24", border: "#78350f", dot: "#f59e0b" },
  missed:          { text: "#f87171", border: "#7f1d1d", dot: "#ef4444" },
  resolved_system: { text: "#4ade80", border: "#14532d", dot: "#22c55e" },
  resolved_human:  { text: "#4ade80", border: "#14532d", dot: "#22c55e" },
  superseded:      { text: "#6b7280", border: "#374151", dot: "#4b5563" },
};

function EntryCard({
  entry,
  onClick,
}: {
  entry: ActionRegisterEntry;
  onClick: () => void;
}) {
  const sc = statusColors[entry.status];
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "#0f172a",
        border: `1px solid ${sc.border}`,
        borderLeft: `3px solid ${sc.dot}`,
        borderRadius: "0 6px 6px 0",
        padding: "7px 10px",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      className="hover:bg-gray-900"
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: entry.status === "active" ? (urgencyDot[entry.urgency] ?? sc.dot) : sc.dot,
            flexShrink: 0,
            marginTop: 3,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#d1d5db", lineHeight: 1.4 }}>{entry.action}</div>
        </div>
        <span style={{ fontSize: 8, color: "#4b5563", fontFamily: "monospace", flexShrink: 0 }}>{entry.id}</span>
      </div>
      <div style={{ paddingLeft: 12, display: "flex", flexDirection: "column", gap: 1 }}>
        {entry.status === "active" && (
          <>
            <div style={{ fontSize: 9, color: "#6b7280" }}>
              <span style={{ color: "#4b5563" }}>Owner: </span>{entry.owner}
            </div>
            <div style={{ fontSize: 9, color: "#6b7280" }}>
              <span style={{ color: "#4b5563" }}>By: </span>{entry.deadline}
            </div>
          </>
        )}
        {(entry.status === "missed") && entry.resolution_evidence && (
          <div style={{ fontSize: 9, color: "#9ca3af", fontStyle: "italic", lineHeight: 1.4 }}>
            {entry.resolution_evidence}
          </div>
        )}
        {(entry.status === "resolved_system" || entry.status === "resolved_human") && entry.resolution_evidence && (
          <div style={{ fontSize: 9, color: "#6b7280", lineHeight: 1.4 }}>{entry.resolution_evidence}</div>
        )}
      </div>
    </button>
  );
}

function Section({
  label,
  entries,
  defaultOpen,
  emptyText,
  onEntryClick,
}: {
  label: string;
  entries: ActionRegisterEntry[];
  defaultOpen: boolean;
  emptyText: string;
  onEntryClick: (idx: number | null) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sc = statusColors[entries[0]?.status ?? "active"];

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          padding: "4px 0",
          cursor: "pointer",
          width: "100%",
        }}
      >
        <span style={{ fontSize: 9, color: sc.text, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
          {label}
        </span>
        <span style={{ fontSize: 9, color: "#374151", marginLeft: 2 }}>({entries.length})</span>
        <span style={{ fontSize: 9, color: "#374151", marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {entries.length === 0 ? (
            <div style={{ fontSize: 10, color: "#374151", paddingLeft: 4 }}>{emptyText}</div>
          ) : (
            entries.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                onClick={() => onEntryClick(e.issued_at_event_index)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ActionRegister({ register, selectedEventIndex, onEntryClick }: Props) {
  const active     = register.filter((e) => e.status === "active");
  const missed     = register.filter((e) => e.status === "missed");
  const resolved   = register.filter((e) => e.status === "resolved_system" || e.status === "resolved_human");
  const superseded = register.filter((e) => e.status === "superseded");

  return (
    <div style={{ padding: "12px 14px", borderTop: "1px solid #1f2937" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Action Register
        </div>
        {register.length === 0 && (
          <div style={{ fontSize: 9, color: "#374151" }}>No items yet</div>
        )}
      </div>

      {/* Time-travel indicator */}
      {selectedEventIndex !== null && (
        <div
          style={{
            background: "#1a1a2e",
            border: "1px solid #3b3b6b",
            borderRadius: 5,
            padding: "5px 8px",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 9, color: "#818cf8" }}>
            Viewing register at event {selectedEventIndex + 1}
          </span>
          <button
            onClick={() => onEntryClick(null)}
            style={{
              fontSize: 9,
              color: "#6366f1",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "1px 4px",
              borderRadius: 3,
            }}
            className="hover:text-indigo-300"
          >
            Back to present
          </button>
        </div>
      )}

      {register.length > 0 && (
        <>
          <Section label="Active" entries={active} defaultOpen emptyText="No active items" onEntryClick={onEntryClick} />
          <Section label="Missed" entries={missed} defaultOpen={false} emptyText="No missed items" onEntryClick={onEntryClick} />
          <Section label="Resolved" entries={resolved} defaultOpen={false} emptyText="No resolved items" onEntryClick={onEntryClick} />
          <Section label="Superseded" entries={superseded} defaultOpen={false} emptyText="No superseded items" onEntryClick={onEntryClick} />
        </>
      )}
    </div>
  );
}
