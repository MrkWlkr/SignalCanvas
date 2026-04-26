"use client";

import { useState } from "react";
import type { EvaluatorOutput } from "@/types";
import type { InterventionOption } from "@/lib/domain-config";

// Impact magnitude → colour mapping (no domain logic — purely visual)
const impactColors: Record<string, { text: string; bg: string; border: string }> = {
  low:      { text: "text-green-400",  bg: "bg-green-950",  border: "border-green-800" },
  medium:   { text: "text-amber-400",  bg: "bg-amber-950",  border: "border-amber-800" },
  high:     { text: "text-orange-400", bg: "bg-orange-950", border: "border-orange-800" },
  critical: { text: "text-red-400",    bg: "bg-red-950",    border: "border-red-800" },
};

const reversibilityColors: Record<string, { text: string; bg: string; border: string }> = {
  reversible:           { text: "text-green-400",  bg: "bg-green-950",  border: "border-green-800" },
  partially_reversible: { text: "text-amber-400",  bg: "bg-amber-950",  border: "border-amber-800" },
  irreversible:         { text: "text-red-400",    bg: "bg-red-950",    border: "border-red-800" },
};

const reasoningBorderHex: Record<string, string> = {
  low: "#16a34a", medium: "#d97706", high: "#ea580c", critical: "#dc2626",
};

function Pill({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: { text: string; bg: string; border: string };
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${colors.text} ${colors.bg} ${colors.border}`}
    >
      <span className="text-gray-500 font-normal">{label}:</span>
      <span>{value.replace(/_/g, " ")}</span>
    </span>
  );
}

interface Props {
  evaluation: EvaluatorOutput;
  interventionOptions: InterventionOption[];
  onIntervene: (optionId: string) => Promise<void>;
}

export default function InterventionCard({
  evaluation,
  interventionOptions,
  onIntervene,
}: Props) {
  const [processingOptionId, setProcessingOptionId] = useState<string | null>(null);
  const [causalOpen, setCausalOpen] = useState(false);

  const impact = evaluation.impact_magnitude ?? "medium";
  const impactC = impactColors[impact] ?? impactColors.medium;
  const revC =
    reversibilityColors[evaluation.reversibility] ??
    reversibilityColors.partially_reversible;
  const novelCount = evaluation.novel_factors?.length ?? 0;
  const borderColor = reasoningBorderHex[impact] ?? reasoningBorderHex.medium;

  const handleOptionClick = async (option: InterventionOption) => {
    if (!option.enabled_in_demo || processingOptionId !== null) return;
    setProcessingOptionId(option.id);
    try {
      await onIntervene(option.id);
    } finally {
      setProcessingOptionId(null);
    }
  };

  return (
    <div className="rounded-xl border border-red-800/60 bg-gray-950 overflow-hidden shadow-[0_0_32px_rgba(220,38,38,0.12)]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-red-900/40 bg-red-950/30">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-red-400 text-xs font-bold uppercase tracking-widest">
            Human Review Required
          </span>
        </div>
        <p className="text-sm text-red-200/80 leading-snug mb-1">
          {evaluation.human_review_reason || "This situation requires a human decision before the agent can proceed."}
        </p>
        <p className="text-xs text-gray-500">
          Agent has paused — your decision is needed before the scenario can proceed.
        </p>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">

        {/* ── Reasoning summary ────────────────────────────────────────── */}
        <div
          className="rounded-lg p-4 bg-gray-900 border-l-4"
          style={{ borderLeftColor: borderColor }}
        >
          <p className="text-sm text-gray-200 leading-relaxed font-medium">
            {evaluation.reasoning_summary}
          </p>
        </div>

        {/* ── Signal pills ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <Pill label="Impact" value={impact} colors={impactC} />
          <Pill label="Reversibility" value={evaluation.reversibility ?? "unknown"} colors={revC} />
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
              novelCount > 0
                ? "text-violet-400 bg-violet-950 border-violet-800"
                : "text-gray-500 bg-gray-900 border-gray-800"
            }`}
          >
            <span className="text-gray-500 font-normal">Novel factors:</span>
            <span>{novelCount} new</span>
          </span>
        </div>

        {/* ── Causal chain (collapsible) ───────────────────────────────── */}
        {evaluation.causal_chain?.length > 0 && (
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <button
              onClick={() => setCausalOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-900 transition-colors"
            >
              <span className="font-medium tracking-wide">How we got here</span>
              <span className="text-gray-700">{causalOpen ? "▲" : "▼"}</span>
            </button>
            {causalOpen && (
              <ol className="border-t border-gray-800 px-4 py-3 flex flex-col gap-1.5">
                {evaluation.causal_chain.map((step, i) => (
                  <li key={i} className="flex gap-2 items-start text-xs">
                    <span className="text-gray-700 font-mono flex-shrink-0 mt-0.5">{i + 1}.</span>
                    <span className="text-gray-500 leading-snug">{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* ── Downstream dependencies ──────────────────────────────────── */}
        {evaluation.downstream_dependencies?.length > 0 && (
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              If no action is taken, this affects:
            </div>
            <ul className="flex flex-col gap-1">
              {evaluation.downstream_dependencies.map((dep, i) => (
                <li key={i} className="flex gap-2 items-start text-xs">
                  <span className="text-red-800 flex-shrink-0 mt-0.5">•</span>
                  <span className="text-gray-400 leading-snug">{dep}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Human actions required ───────────────────────────────────── */}
        {(evaluation.human_actions_required?.length ?? 0) > 0 && (
          <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Actions Required
            </div>
            <ol className="flex flex-col gap-2">
              {(evaluation.human_actions_required ?? []).map((req, i) => (
                <li key={req.id} className="flex gap-2 items-start">
                  <span className="text-xs text-blue-500 font-mono w-4 flex-shrink-0 pt-0.5">
                    {i + 1}.
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`text-sm leading-snug ${
                        i === 0 ? "font-semibold text-white" : "text-gray-300"
                      }`}
                    >
                      {req.action}
                    </span>
                    <span className="text-xs text-gray-500">
                      {req.owner} · {req.deadline}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── Response options ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Your Decision
          </div>
          {interventionOptions.map((option) => {
            const isProcessing = processingOptionId === option.id;
            const isDisabled =
              !option.enabled_in_demo || processingOptionId !== null;

            const baseClasses =
              "w-full text-left rounded-lg px-4 py-3 text-sm font-medium transition-all border flex items-start gap-3";

            let stateClasses = "";
            if (!option.enabled_in_demo) {
              stateClasses =
                "bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed opacity-40";
            } else if (isProcessing) {
              stateClasses =
                "bg-blue-700 border-blue-600 text-white cursor-wait";
            } else if (option.style === "primary") {
              stateClasses =
                "bg-blue-600 border-blue-500 text-white hover:bg-blue-500 active:bg-blue-700 cursor-pointer";
            } else if (option.style === "destructive") {
              stateClasses =
                "bg-red-900 border-red-700 text-red-200 hover:bg-red-800 cursor-pointer";
            } else {
              stateClasses = isDisabled
                ? "bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed"
                : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600 cursor-pointer";
            }

            return (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option)}
                disabled={isDisabled}
                className={`${baseClasses} ${stateClasses}`}
              >
                {/* Spinner or icon */}
                <span className="flex-shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center">
                  {isProcessing ? (
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                  ) : option.style === "primary" ? (
                    <span className="text-blue-300 text-xs">→</span>
                  ) : (
                    <span className="text-gray-600 text-xs">·</span>
                  )}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={option.enabled_in_demo ? "" : "text-gray-600"}>
                      {option.label}
                    </span>
                    {!option.enabled_in_demo && (
                      <span className="text-xs bg-gray-800 text-gray-600 border border-gray-700 px-1.5 py-0.5 rounded font-mono">
                        demo
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs mt-0.5 leading-snug ${
                      option.enabled_in_demo && !isProcessing
                        ? option.style === "primary"
                          ? "text-blue-200/70"
                          : "text-gray-500"
                        : "text-gray-700"
                    }`}
                  >
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
