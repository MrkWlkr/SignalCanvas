"use client";

import { useState } from "react";
import type { AssertionResult } from "@/types";

interface Props {
  testCaseId: string;
  testCaseTitle: string;
  testCaseDescription: string;
  propertyUnderTest: string;
  assertions: AssertionResult[];
  totalEvents: number;
  completedEvents: number;
}

export default function AssertionPanel({
  testCaseId,
  testCaseTitle,
  testCaseDescription,
  propertyUnderTest,
  assertions,
  totalEvents,
  completedEvents,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const passed = assertions.filter((a) => a.status === "pass").length;
  const failed = assertions.filter((a) => a.status === "fail").length;
  const pending = assertions.filter((a) => a.status === "pending").length;
  const total = assertions.length;

  const hasRegression = failed > 0;
  const allPass = total > 0 && failed === 0 && pending === 0;
  const isRunning = completedEvents > 0 && completedEvents < totalEvents;
  const notStarted = completedEvents === 0;

  const progressPct = totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0;

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function isExpanded(a: AssertionResult) {
    return expandedIds.has(a.id) || a.status === "fail";
  }

  const statusBadge = () => {
    if (notStarted) return <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500 font-mono">Awaiting run</span>;
    if (hasRegression) return <span className="text-xs px-2 py-0.5 rounded bg-red-900/60 text-red-300 font-mono font-semibold">REGRESSION DETECTED</span>;
    if (allPass) return <span className="text-xs px-2 py-0.5 rounded bg-green-900/60 text-green-300 font-mono font-semibold">ALL ASSERTIONS PASS</span>;
    if (isRunning) return <span className="text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 font-mono">Running…</span>;
    return <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">In progress</span>;
  };

  return (
    <div
      className="flex flex-col h-full border-l border-gray-800 bg-gray-950 overflow-hidden"
      style={{ width: 280, flexShrink: 0 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs px-2 py-0.5 rounded bg-violet-900/60 text-violet-300 font-mono font-semibold tracking-wide">
            TEST CASE
          </span>
          <span className="text-xs text-gray-500 font-mono">{testCaseId}</span>
        </div>
        <div className="text-sm font-semibold text-white mt-1">{testCaseTitle}</div>
        <div className="text-xs text-gray-500 mt-0.5 leading-snug">{propertyUnderTest}</div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Events</span>
            <span>{completedEvents} / {totalEvents}</span>
          </div>
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-green-400">✓{passed}</span>
          <span className="text-red-400">✗{failed}</span>
          <span className="text-gray-500">●{pending}</span>
        </div>
        {statusBadge()}
      </div>

      {/* Regression callout */}
      {hasRegression && (
        <div className="mx-3 mt-3 p-3 rounded bg-red-950/60 border border-red-800/60 text-xs text-red-300 leading-snug">
          <span className="font-semibold text-red-200">{failed} assertion{failed > 1 ? "s" : ""} failed.</span>{" "}
          Agent behavior diverged from expected. Review failed assertions below.
        </div>
      )}

      {/* Description */}
      <div className="px-4 pt-3 pb-1">
        <div className="text-xs text-gray-500 leading-snug">{testCaseDescription}</div>
      </div>

      {/* Assertion list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5">
        {assertions.map((a) => {
          const expanded = isExpanded(a);
          return (
            <div
              key={a.id}
              onClick={() => toggleExpand(a.id)}
              className={`rounded-md border cursor-pointer transition-colors ${
                a.status === "pass"
                  ? "border-green-900/50 bg-green-950/20 hover:bg-green-950/40"
                  : a.status === "fail"
                  ? "border-red-800/60 bg-red-950/30 hover:bg-red-950/50"
                  : "border-gray-800 bg-gray-900/40 hover:bg-gray-900/60"
              }`}
            >
              {/* Row */}
              <div className="flex items-start gap-2 p-2.5">
                <span className="mt-0.5 flex-shrink-0 text-sm leading-none">
                  {a.status === "pass" ? "✓" : a.status === "fail" ? "✗" : "●"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs leading-snug font-medium ${
                    a.status === "pass" ? "text-green-300" :
                    a.status === "fail" ? "text-red-300" :
                    "text-gray-400"
                  }`}>
                    {a.label}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono leading-none ${
                      a.type === "positive" ? "bg-blue-900/40 text-blue-400" :
                      a.type === "negative" ? "bg-amber-900/40 text-amber-400" :
                      "bg-purple-900/40 text-purple-400"
                    }`}>
                      {a.type}
                    </span>
                    <span className="text-xs text-gray-600 font-mono">{a.id}</span>
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-800/50">
                  <div className="text-xs text-gray-500 leading-snug mt-2">{a.explanation}</div>
                  {a.status !== "pending" && (
                    <div className="mt-2 grid grid-cols-2 gap-1 text-xs font-mono">
                      <div>
                        <div className="text-gray-600 mb-0.5">Expected</div>
                        <div className="text-gray-300">{JSON.stringify(a.expected)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600 mb-0.5">Actual</div>
                        <div className={a.status === "fail" ? "text-red-300" : "text-green-300"}>
                          {JSON.stringify(a.actual)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
