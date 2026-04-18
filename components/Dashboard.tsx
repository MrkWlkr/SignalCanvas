"use client";

import { useState, useCallback } from "react";
import { useScenario } from "@/hooks/useScenario";
import ScenarioPanel from "@/components/ScenarioPanel";
import EventFeed from "@/components/EventFeed";
import PathwayView from "@/components/PathwayView";
import ConfidenceTimeline from "@/components/ConfidenceTimeline";
import DataInspector from "@/components/DataInspector";
import InterventionCard from "@/components/InterventionCard";

const TABS = ["Live Feed", "Decision Pathway", "Confidence Timeline", "Data Inspector"] as const;
type Tab = (typeof TABS)[number];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("Live Feed");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState("SCENARIO_ESCALATING");

  const {
    scenarioData,
    stateData,
    loading,
    advancing,
    playing,
    error,
    advance,
    playSimulation,
    pauseSimulation,
    reset,
    pendingIntervention,
    intervene,
    currentPath,
  } = useScenario(activeScenario);

  const events = scenarioData?.events ?? [];
  const evaluations = stateData?.evaluations ?? [];

  const eventByEventId = new Map(events.map((e) => [e.event_id, e]));
  const evalByEventId = new Map(evaluations.map((e) => [e.event_id, e]));
  const selectedEvaluation = selectedEventId ? (evalByEventId.get(selectedEventId) ?? null) : null;
  const selectedActedOn = selectedEventId
    ? eventByEventId.get(selectedEventId)?.acted_on
    : undefined;
  const selectedUnactionedIndices = selectedEventId
    ? (eventByEventId.get(selectedEventId)?.unactioned_recommendation_indices ?? [])
    : [];

  const handleSelectEvent = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
    setActiveTab("Data Inspector");
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedEventId(null);
  }, []);

  const handleAdvance = useCallback(async () => {
    setSelectedEventId(null);
    await advance();
  }, [advance]);

  const handleReset = useCallback(async () => {
    setSelectedEventId(null);
    await reset();
  }, [reset]);

  const handleScenarioChange = useCallback((id: string) => {
    setActiveScenario(id);
    setSelectedEventId(null);
    setActiveTab("Live Feed");
  }, []);

  const hasPendingIntervention = pendingIntervention !== null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 57px)" }}>
      {error && (
        <div className="bg-red-950 border-b border-red-800 text-red-300 text-xs px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden lg:grid lg:grid-cols-3">
        {/* ── Left sidebar ──────────────────────────────────────────────── */}
        <div className="lg:col-span-1 border-r border-gray-800 overflow-hidden flex flex-col">
          {loading && !scenarioData ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              Loading scenario…
            </div>
          ) : (
            <ScenarioPanel
              scenarioData={scenarioData}
              stateData={stateData}
              loading={loading}
              advancing={advancing}
              playing={playing}
              activeScenario={activeScenario}
              currentPath={currentPath}
              hasPendingIntervention={hasPendingIntervention}
              onScenarioChange={handleScenarioChange}
              onAdvance={handleAdvance}
              onReset={handleReset}
              onPlay={playSimulation}
              onPause={pauseSimulation}
            />
          )}
        </div>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col overflow-hidden">

          {/* Intervention banner — shown when agent is paused */}
          {hasPendingIntervention && (
            <div className="flex items-center gap-2 bg-red-950/60 border-b border-red-800/60 px-4 py-2 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
              <span className="text-xs text-red-300 font-medium">
                Agent paused — review required before proceeding
              </span>
            </div>
          )}

          {/* Tab bar — dimmed when intervention is pending */}
          <div
            className={`flex border-b border-gray-800 bg-gray-950 flex-shrink-0 transition-opacity duration-300 ${
              hasPendingIntervention ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-xs font-medium tracking-wide transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "text-white border-blue-500"
                    : "text-gray-500 border-transparent hover:text-gray-300"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-hidden relative">
            {hasPendingIntervention ? (
              /* Intervention card fills the content area */
              <div className="absolute inset-0 overflow-y-auto p-4">
                <InterventionCard
                  evaluation={pendingIntervention.evaluation}
                  interventionOptions={pendingIntervention.interventionOptions}
                  onIntervene={intervene}
                />
              </div>
            ) : (
              /* Normal tab content */
              <>
                {activeTab === "Live Feed" && (
                  <EventFeed
                    events={events}
                    evaluations={evaluations}
                    selectedEventId={selectedEventId}
                    onSelect={handleSelectEvent}
                  />
                )}
                {activeTab === "Decision Pathway" && (
                  <PathwayView evaluations={evaluations} events={events} />
                )}
                {activeTab === "Confidence Timeline" && (
                  <ConfidenceTimeline evaluations={evaluations} events={events} />
                )}
                {activeTab === "Data Inspector" && (
                  <DataInspector
                    selected={selectedEvaluation}
                    selectedActedOn={selectedActedOn}
                    unactionedIndices={selectedUnactionedIndices}
                    latest={stateData?.latest_evaluation ?? null}
                    onClearSelection={handleClearSelection}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
