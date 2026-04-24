"use client";

import { useState } from "react";
import type { EvaluationRecord, ToolCallTrace } from "@/types";
import { getRiskColors, formatEventType, getEventCategoryColors } from "@/components/ui";

interface Props {
  selected: EvaluationRecord | null;
  latest: EvaluationRecord | null;
  selectedActedOn?: boolean;
  unactionedIndices?: number[];
  onClearSelection: () => void;
}

function summarizeToolResult(trace: ToolCallTrace): string {
  const r = trace.tool_result as Record<string, unknown>;
  if (!r) return "No result";
  try {
    switch (trace.tool_name) {
      case "get_employee":
        return `Employee: ${(r as any).employee_name ?? "unknown"}`;
      case "get_assignment":
        return `${(r as any).employee?.employee_name ?? "unknown"} — policy: ${(r as any).policy?.policy_id ?? "—"}`;
      case "get_country_rule":
        return `Tax threshold: ${(r as any).tax_threshold_days}d, visa: ${(r as any).visa_category}`;
      case "get_policy":
        return `Max days: ${(r as any).max_short_term_assignment_days}, pre-approval: ${(r as any).requires_preapproval_for_extension}`;
      case "get_visa_case":
        return `Status: ${(r as any).visa_status}, delay prob: ${(r as any).visa_delay_probability}, docs: ${(r as any).documents_complete}`;
      case "get_payroll_status":
        return `Alignment risk: ${(r as any).alignment_risk}, host: ${(r as any).host_payroll_status}`;
      case "get_recent_signals":
        return `${Array.isArray(r) ? r.length : 0} recent signal events`;
      case "calculate_days_until_start":
        return `${(r as any).days_until_start} days until assignment start`;
      default:
        return JSON.stringify(r).slice(0, 80);
    }
  } catch {
    return "—";
  }
}

export default function DataInspector({
  selected,
  latest,
  selectedActedOn,
  unactionedIndices = [],
  onClearSelection,
}: Props) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);

  if (!selected && !latest) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        No evaluation yet — advance the scenario
      </div>
    );
  }

  const record = selected ?? latest!;
  const isPast = selected !== null && selected.event_id !== latest?.event_id;
  const notActedOn = isPast && selectedActedOn === false;
  const { evaluation, event_type, timestamp } = record;
  const colors = getRiskColors(evaluation.risk_level);

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">

      {/* Past event banner */}
      {isPast && (
        <div className="flex items-center justify-between bg-amber-950 border border-amber-800 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-xs font-semibold uppercase tracking-wide">Past evaluation</span>
            <span className="text-amber-600 text-xs">— recommended actions were not acted on</span>
          </div>
          <button
            onClick={onClearSelection}
            className="text-xs text-amber-600 hover:text-amber-400 transition-colors ml-4 flex-shrink-0"
          >
            ← back to latest
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">
            {isPast ? "Past Evaluation" : "Latest Evaluation"}
          </div>
          <div className="text-sm text-gray-300">{formatEventType(event_type)}</div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs px-3 py-1 rounded-md font-bold uppercase tracking-wide ${colors.text} ${colors.bg} border ${colors.border}`}
          >
            {evaluation.risk_level}
          </span>
          <span className="text-xs text-gray-600">
            {new Date(timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Reasoning summary — most prominent */}
      <div className={`rounded-lg p-4 border-l-4 ${
        notActedOn ? "bg-amber-950/30 border-amber-700" : "bg-gray-900 border-blue-600"
      }`}>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Reasoning Summary</div>
        <p className={`text-sm leading-relaxed font-medium ${
          notActedOn ? "text-gray-400" : "text-gray-200"
        }`}>
          {evaluation.reasoning_summary}
        </p>
      </div>

      {/* Affected domains — colored pills */}
      {evaluation.affected_domains.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Affected Domains</div>
          <div className="flex flex-wrap gap-1.5">
            {evaluation.affected_domains.map((d) => {
              const catC = getEventCategoryColors(d.toLowerCase());
              return catC ? (
                <span
                  key={d}
                  className={`text-xs border px-2.5 py-0.5 rounded-full font-medium ${catC.text} ${catC.bg} ${catC.border}`}
                >
                  {d}
                </span>
              ) : (
                <span
                  key={d}
                  className="text-xs bg-gray-800 text-gray-300 border border-gray-700 px-2.5 py-0.5 rounded-full"
                >
                  {d}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommended actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Recommended Actions</div>
          {notActedOn && <span className="text-xs text-amber-700 italic">not acted on</span>}
        </div>
        {(evaluation.recommended_actions?.length ?? 0) === 0 ? (
          <div className="text-gray-600 text-sm">None</div>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {(evaluation.recommended_actions ?? []).map((action, i) => {
              const wasUnactioned = notActedOn && unactionedIndices.includes(i);
              const isFirst = i === 0;
              return (
                <li key={i} className="flex gap-3 items-start">
                  <span className={`text-xs font-mono w-5 flex-shrink-0 pt-0.5 ${wasUnactioned ? "text-amber-800" : "text-blue-400"}`}>
                    {i + 1}.
                  </span>
                  <span className={`leading-snug ${
                    wasUnactioned
                      ? "text-sm text-gray-500"
                      : isFirst
                      ? "text-sm font-semibold text-white"
                      : "text-sm text-gray-300"
                  }`}>
                    {action}
                    {wasUnactioned && (
                      <span className="ml-2 text-xs text-red-500 font-medium">[Not acted on]</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Next checks — split on " — " */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Next Checks</div>
        {evaluation.next_checks.length === 0 ? (
          <div className="text-gray-600 text-sm">None</div>
        ) : (
          <ul className="flex flex-col gap-3">
            {evaluation.next_checks.map((check, i) => {
              const parts = check.split(" — ");
              const hasDimension = parts.length > 1;
              return (
                <li key={i} className="flex gap-2 items-start">
                  <span className={`mt-1 flex-shrink-0 text-xs ${notActedOn ? "text-gray-700" : "text-blue-500"}`}>
                    ›
                  </span>
                  <span className="text-sm leading-snug">
                    {hasDimension ? (
                      <>
                        <span className={`font-semibold ${notActedOn ? "text-gray-500" : "text-gray-200"}`}>
                          {parts[0]}
                        </span>
                        <span className={`${notActedOn ? "text-gray-600" : "text-gray-500"}`}>
                          {" — "}{parts.slice(1).join(" — ")}
                        </span>
                      </>
                    ) : (
                      <span className={notActedOn ? "text-gray-600" : "text-gray-300"}>{check}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Confidence */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Confidence</div>
        <div className="text-3xl font-mono font-bold text-white">
          {evaluation.confidence.toFixed(2)}
        </div>
      </div>

      {/* Tool call timeline — collapsible */}
      {record.tool_trace.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <button
            onClick={() => setTraceOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          >
            <span className="font-mono">Tool call timeline ({record.tool_trace.length} calls)</span>
            <span className="text-gray-600">{traceOpen ? "▲" : "▼"}</span>
          </button>
          {traceOpen && (
            <ol className="border-t border-gray-800 flex flex-col divide-y divide-gray-800/60">
              {record.tool_trace.map((trace, i) => (
                <li key={i} className="flex gap-3 items-start px-4 py-2.5">
                  <span className="text-xs text-gray-600 font-mono w-5 flex-shrink-0 pt-0.5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono text-blue-400">{trace.tool_name}</span>
                      <span className="text-xs text-gray-600 font-mono truncate">
                        ({Object.entries(trace.tool_input).map(([k, v]) => `${k}: ${v}`).join(", ")})
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">{summarizeToolResult(trace)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Raw JSON collapsible */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <button
          onClick={() => setJsonOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        >
          <span className="font-mono">Raw evaluation JSON</span>
          <span className="text-gray-600">{jsonOpen ? "▲" : "▼"}</span>
        </button>
        {jsonOpen && (
          <pre className="bg-gray-900 text-green-300 font-mono text-xs p-4 overflow-x-auto border-t border-gray-800 leading-relaxed">
            {JSON.stringify(evaluation, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
