"use client";

import { useCallback, useState } from "react";
import { useScenario } from "@/hooks/useScenario";
import ScenarioPanel from "@/components/ScenarioPanel";
import { AgentCanvas } from "@/components/canvas/AgentCanvas";
import { domainConfig } from "@/lib/domain-config";

// ── Retired tabs (commented out — not deleted) ────────────────────────────────
// import EventFeed from "@/components/EventFeed";
// import PathwayView from "@/components/PathwayView"; // DEPRECATED: replaced by AgentCanvas
// import ConfidenceTimeline from "@/components/ConfidenceTimeline";
// import DataInspector from "@/components/DataInspector";
// import InterventionCard from "@/components/InterventionCard"; // now rendered inside AgentCanvas

export default function Dashboard() {
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
    selectedEventIndex,
    actionRegister,
    selectEvent,
    highlightCanvasNode,
  } = useScenario(activeScenario);

  const events = scenarioData?.events ?? [];
  const evaluations = stateData?.evaluations ?? [];

  const hasPendingIntervention = pendingIntervention !== null;

  const handleAdvance = useCallback(async () => {
    await advance();
  }, [advance]);

  const handleReset = useCallback(async () => {
    await reset();
  }, [reset]);

  const handleScenarioChange = useCallback((id: string) => {
    setActiveScenario(id);
  }, []);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 57px)" }}>
      {error && (
        <div className="bg-red-950 border-b border-red-800 text-red-300 text-xs px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden flex">
        {/* ── Left sidebar — fixed 375px ────────────────────────────────── */}
        <div className="border-r border-gray-800 overflow-hidden flex flex-col flex-shrink-0" style={{ width: 375 }}>
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
              actionRegister={actionRegister}
              selectedEventIndex={selectedEventIndex}
              onRegisterEntryClick={highlightCanvasNode}
              onScenarioChange={handleScenarioChange}
              onAdvance={handleAdvance}
              onReset={handleReset}
              onPlay={playSimulation}
              onPause={pauseSimulation}
            />
          )}
        </div>

        {/* ── Agent canvas — takes all remaining space ──────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AgentCanvas
            evaluations={evaluations}
            events={events}
            config={domainConfig}
            advancing={advancing}
            pendingIntervention={pendingIntervention}
            onIntervene={intervene}
            scenarioId={activeScenario}
            selectedEventIndex={selectedEventIndex}
            onSelectEvent={selectEvent}
          />
        </div>
      </div>
    </div>
  );
}
