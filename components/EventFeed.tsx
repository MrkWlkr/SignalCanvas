"use client";

import type { SignalEvent, EvaluationRecord } from "@/types";
import { formatEventType, getRiskColors, getEventCategoryColors } from "@/components/ui";

// Fields to always show in payload (in order, if present)
const PRIORITY_FIELDS = [
  "status", "delay_probability", "risk_flag", "alignment_risk",
  "days_until_start", "extension_days", "documents_complete",
  "host_payroll_status", "visa_status", "approval_status",
  "threshold_days", "current_days", "overstay_risk",
];

function getPriorityPayload(payload: Record<string, unknown>): [string, unknown][] {
  const entries = Object.entries(payload);
  const priority: [string, unknown][] = [];
  const rest: [string, unknown][] = [];
  for (const entry of entries) {
    if (PRIORITY_FIELDS.includes(entry[0])) priority.push(entry);
    else rest.push(entry);
  }
  const combined = [...priority, ...rest];
  return combined.slice(0, 4);
}

interface Props {
  events: SignalEvent[];
  evaluations: EvaluationRecord[];
  selectedEventId: string | null;
  onSelect: (eventId: string) => void;
}

export default function EventFeed({ events, evaluations, selectedEventId, onSelect }: Props) {
  const evaluatedIds = new Set(evaluations.map((e) => e.event_id));
  const evalByEventId = new Map<string, EvaluationRecord>();
  for (const ev of evaluations) evalByEventId.set(ev.event_id, ev);

  const visible = events
    .filter((e) => evaluatedIds.has(e.event_id))
    .sort((a, b) => b.timestamp_offset_sec - a.timestamp_offset_sec);

  const latestEventId = evaluations.length > 0 ? evaluations[evaluations.length - 1].event_id : null;

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-gray-600 text-sm">No events yet</div>
        <div className="text-gray-700 text-xs">Press Advance to process the first signal</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto h-full">
      {visible.map((event, i) => {
        const evaluation = evalByEventId.get(event.event_id)!;
        const isLatest = event.event_id === latestEventId;
        const isSelected = event.event_id === selectedEventId;
        const notActedOn = !isLatest && event.acted_on === false;
        const age = i;
        const riskColors = getRiskColors(evaluation.evaluation.risk_level);
        const catColors = getEventCategoryColors(event.event_category);

        const opacity =
          isSelected ? "opacity-100" :
          age === 0 ? "opacity-100" :
          age === 1 ? "opacity-60" :
          age === 2 ? "opacity-40" :
          "opacity-25";

        const payloadEntries = getPriorityPayload(event.payload);

        return (
          <div
            key={event.event_id}
            onClick={() => onSelect(event.event_id)}
            className={`border rounded-lg p-3 transition-all duration-300 cursor-pointer ${opacity} ${
              isSelected && !isLatest
                ? "bg-gray-800 border-amber-600 shadow-[0_0_14px_rgba(217,119,6,0.2)]"
                : isLatest
                ? "bg-gray-900 border-blue-600 shadow-[0_0_14px_rgba(37,99,235,0.2)]"
                : "bg-gray-900/60 border-gray-800 hover:border-gray-600"
            }`}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${
                    isLatest ? "bg-blue-400" : isSelected ? "bg-amber-500" : "bg-gray-600"
                  }`}
                />
                <span
                  className={`text-sm font-medium truncate ${
                    isLatest || isSelected ? "text-gray-100" : "text-gray-400"
                  }`}
                >
                  {formatEventType(event.event_type)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                {notActedOn && (
                  <span className="text-xs text-amber-800 italic">not acted on</span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${riskColors.text} ${riskColors.bg}`}
                >
                  {evaluation.evaluation.risk_level}
                </span>
              </div>
            </div>

            {/* Category + source + day row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {catColors && event.event_category && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${catColors.text} ${catColors.bg} ${catColors.border}`}
                >
                  {event.event_category}
                </span>
              )}
              {event.source_system && (
                <span className="text-xs text-gray-600 font-mono">{event.source_system}</span>
              )}
              {event.day_offset != null && (
                <span className="text-xs text-gray-600 ml-auto">Day {event.day_offset}</span>
              )}
            </div>

            {/* Payload grid — priority fields only */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {payloadEntries.map(([key, value]) => (
                <div key={key} className="contents">
                  <span className="text-xs text-gray-600 truncate">{key.replace(/_/g, " ")}</span>
                  <span
                    className={`text-xs truncate ${
                      isLatest || isSelected ? "text-gray-300" : "text-gray-500"
                    }`}
                  >
                    {typeof value === "object" ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>

            {/* Confidence footer */}
            <div className="mt-2 pt-2 border-t border-gray-800 flex items-center gap-2">
              <span className="text-xs text-gray-600">confidence</span>
              <span className={`text-xs font-mono ${isLatest || isSelected ? "text-white" : "text-gray-500"}`}>
                {evaluation.evaluation.confidence.toFixed(2)}
              </span>
              <span className="text-xs text-gray-700 ml-auto font-mono">
                T+{event.timestamp_offset_sec}s
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
