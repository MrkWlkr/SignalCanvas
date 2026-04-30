"use client";

import type { ScenarioApiResponse, StateApiResponse, ActionRegisterEntry } from "@/types";
import { formatEventType, getRiskColors, riskBorderHex } from "@/components/ui";
import ActionRegister from "@/components/ActionRegister";

const MOBILITY_SCENARIOS = [
  { id: "SCENARIO_ESCALATING", label: "Escalating", descriptor: "Steady risk build-up across domains" },
  { id: "SCENARIO_CRITICAL",   label: "Critical",   descriptor: "Rapid escalation to assignment blocker" },
];

const OPS_SCENARIOS = [
  { id: "SCENARIO_DEALER_PRICING", label: "Dealer Pricing", descriptor: "Silent pricing field corruption" },
];

interface Props {
  scenarioData: ScenarioApiResponse | null;
  stateData: StateApiResponse | null;
  loading: boolean;
  advancing: boolean;
  playing: boolean;
  activeScenario: string;
  currentPath: string;
  hasPendingIntervention: boolean;
  actionRegister: ActionRegisterEntry[];
  selectedEventIndex: number | null;
  onRegisterEntryClick: (eventIndex: number | null) => void;
  onScenarioChange: (id: string) => void;
  onAdvance: () => void;
  onReset: () => void;
  onPlay: () => void;
  onPause: () => void;
}

// Human-readable path labels — purely display, no domain logic
const PATH_LABELS: Record<string, string> = {
  default: "Default path",
  intervention_resolved: "Intervention resolved",
};

export default function ScenarioPanel({
  scenarioData,
  stateData,
  loading,
  advancing,
  playing,
  activeScenario,
  currentPath,
  hasPendingIntervention,
  actionRegister,
  selectedEventIndex,
  onRegisterEntryClick,
  onScenarioChange,
  onAdvance,
  onReset,
  onPlay,
  onPause,
}: Props) {
  const employee = scenarioData?.employee;
  const scenario = scenarioData?.scenario;
  const latest = stateData?.latest_evaluation;
  const evaluation = latest?.evaluation;
  const current = stateData?.current_event_index ?? 0;
  const total = stateData?.total_events ?? 0;
  const complete = stateData?.complete ?? false;
  const progress = total > 0 ? (current / total) * 100 : 0;
  const colors = getRiskColors(evaluation?.risk_level);
  const confidence = evaluation?.confidence ?? 0;
  const showUncertainty = confidence < 0.6 && evaluation != null;
  const showConfirmation = confidence > 0.85 && evaluation != null;

  return (
    <aside className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Scenario selector */}
      <div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Scenario</div>
        {/* Mobility group */}
        <div className="flex gap-2 mb-1.5">
          {MOBILITY_SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => onScenarioChange(s.id)}
              className={`flex-1 text-xs px-3 py-2 rounded-md border transition-colors text-left ${
                activeScenario === s.id
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              <div className="font-semibold">{s.label}</div>
              <div className={`text-xs mt-0.5 ${activeScenario === s.id ? "text-blue-200" : "text-gray-600"}`}>
                {s.descriptor}
              </div>
            </button>
          ))}
        </div>
        {/* Ops group */}
        <div className="flex gap-2">
          {OPS_SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => onScenarioChange(s.id)}
              className={`flex-1 text-xs px-3 py-2 rounded-md border transition-colors text-left ${
                activeScenario === s.id
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-semibold">{s.label}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-medium leading-none">Ops</span>
              </div>
              <div className={`text-xs mt-0.5 ${activeScenario === s.id ? "text-blue-200" : "text-gray-600"}`}>
                {s.descriptor}
              </div>
            </button>
          ))}
        </div>
        {/* Active path indicator */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              currentPath === "intervention_resolved" ? "bg-green-500" : "bg-gray-600"
            }`}
          />
          <span
            className={`text-xs ${
              currentPath === "intervention_resolved" ? "text-green-500" : "text-gray-600"
            }`}
          >
            {PATH_LABELS[currentPath] ?? currentPath}
          </span>
        </div>
      </div>

      {/* Entity card */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
          {scenarioData?.primary_entity ? "Entity" : "Assignment"}
        </div>
        {scenarioData?.primary_entity ? (
          <>
            <div className="text-white text-lg font-semibold">{scenarioData.primary_entity.name}</div>
            <div className="text-gray-400 text-sm mt-0.5">{scenarioData.primary_entity.subtitle}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {scenarioData.primary_entity.tags.map((tag) => (
                <span key={tag} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
              {scenarioData.primary_entity.meta.map((m) => (
                <div key={m.label}>
                  <div className="text-gray-600 mb-0.5">{m.label}</div>
                  <div className="text-gray-300">{m.value}</div>
                </div>
              ))}
            </div>
          </>
        ) : employee ? (
          <>
            <div className="text-white text-lg font-semibold">{employee.employee_name}</div>
            <div className="text-gray-400 text-sm mt-0.5">{scenario?.route}</div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                {employee.assignment_type.replace("_", " ")}
              </span>
              <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                {employee.department}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div>
                <div className="text-gray-600 mb-0.5">Start date</div>
                <div className="text-gray-300">{employee.start_date}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-0.5">Duration</div>
                <div className="text-gray-300">{employee.planned_duration_days} days</div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-gray-600 text-sm">Loading…</div>
        )}
      </div>

      {/* Risk level + confidence bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Risk Assessment</div>
        {evaluation ? (
          <>
            <div
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-bold uppercase tracking-wide ${colors.text} ${colors.bg} border ${colors.border}`}
            >
              {evaluation.risk_level}
            </div>

            {/* Confidence bar */}
            <div className="mt-3">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs text-gray-500">Agent confidence</span>
                <span className="text-sm font-mono font-bold text-white">
                  {Math.round(confidence * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${confidence * 100}%`,
                    backgroundColor: riskBorderHex[evaluation.risk_level],
                  }}
                />
              </div>
            </div>

            {evaluation.affected_domains.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {evaluation.affected_domains.map((d) => (
                  <span
                    key={d}
                    className="text-xs bg-gray-800 text-gray-300 border border-gray-700 px-2 py-0.5 rounded-full"
                  >
                    {d}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-gray-600 text-sm">No evaluation yet</div>
        )}
      </div>

      {/* Uncertainty / confirmation panel */}
      {showUncertainty && (
        <div className="bg-amber-950/50 border border-amber-800/60 rounded-lg p-4 transition-all duration-500">
          <div className="text-xs text-amber-500 uppercase tracking-wider font-semibold mb-2">
            Monitoring — Next Checks
          </div>
          <ul className="flex flex-col gap-1.5">
            {evaluation!.next_checks.map((check, i) => {
              const parts = check.split(" — ");
              return (
                <li key={i} className="flex gap-2 items-start text-xs">
                  <span className="text-amber-700 mt-0.5 flex-shrink-0">•</span>
                  <span className="text-amber-200/70 leading-snug">
                    {parts.length > 1 ? (
                      <>
                        <span className="font-semibold text-amber-300">{parts[0]}</span>
                        {" — "}
                        <span className="text-amber-200/60">{parts.slice(1).join(" — ")}</span>
                      </>
                    ) : check}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {showConfirmation && !showUncertainty && (
        <div className="bg-green-950/50 border border-green-800/60 rounded-lg p-4 transition-all duration-500">
          <div className="text-xs text-green-400 uppercase tracking-wider font-semibold mb-1">
            High confidence
          </div>
          <div className="text-xs text-green-200/70 leading-relaxed">
            {evaluation!.reasoning_summary.split(".")[0]}.
          </div>
        </div>
      )}

      {/* Action Register */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <ActionRegister
          register={actionRegister}
          selectedEventIndex={selectedEventIndex}
          onEntryClick={onRegisterEntryClick}
        />
      </div>

      {/* Progress */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Scenario Progress</div>
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>{current > 0 ? `Event ${current} of ${total}` : `0 of ${total} events`}</span>
          {complete && <span className="text-green-400 font-medium">Complete</span>}
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {latest && (
          <div className="mt-2 text-xs text-gray-500">Last: {formatEventType(latest.event_type)}</div>
        )}
      </div>

      {/* Scenario complete card */}
      {complete && (
        <div className="bg-gray-900 border border-green-800/40 rounded-lg p-4 text-center">
          <div className="text-green-400 text-sm font-semibold mb-1">Scenario Complete</div>
          <div className="text-xs text-gray-500">
            All {total} events processed. Final risk: {" "}
            <span className={`font-bold ${colors.text}`}>{evaluation?.risk_level ?? "—"}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-2 mt-auto">
        <div className="flex gap-2">
          <button
            onClick={onAdvance}
            disabled={advancing || playing || complete || loading || hasPendingIntervention}
            className="flex-1 py-2.5 px-4 rounded-md text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white transition-colors flex items-center justify-center gap-2"
          >
            {advancing && !playing ? (
              <>
                <Spinner />
                Analyzing…
              </>
            ) : hasPendingIntervention ? (
              "Paused"
            ) : complete ? (
              "Complete"
            ) : (
              "Advance →"
            )}
          </button>

          <button
            onClick={playing ? onPause : onPlay}
            disabled={complete || loading || hasPendingIntervention}
            title={playing ? "Pause simulation" : "Play simulation"}
            className={`py-2.5 px-3 rounded-md text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              playing
                ? "bg-amber-700 hover:bg-amber-600 text-white"
                : "bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300"
            }`}
          >
            {playing ? (
              advancing ? <Spinner /> : <PauseIcon />
            ) : (
              <PlayIcon />
            )}
          </button>
        </div>

        <button
          onClick={onReset}
          disabled={advancing || loading}
          className="w-full py-2 px-4 rounded-md text-sm font-medium bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 transition-colors"
        >
          Reset
        </button>
      </div>
    </aside>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}
