"use client";

import { useCallback, useState, useMemo } from "react";
import { useScenario } from "@/hooks/useScenario";
import ScenarioPanel from "@/components/ScenarioPanel";
import { AgentCanvas } from "@/components/canvas/AgentCanvas";
import AssertionPanel from "@/components/AssertionPanel";
import { testSuiteConfig } from "@/lib/configs/test-suite-config";

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
    activeDomainConfig,
    assertionResults,
    isTestCase,
    testCaseId,
    showAnalytics,
    toggleAnalytics,
    scenarioAnalytics,
    allAnalytics,
  } = useScenario(activeScenario);

  const events = scenarioData?.events ?? [];
  const evaluations = stateData?.evaluations ?? [];
  const completedEvents = stateData?.current_event_index ?? 0;
  const totalEvents = stateData?.total_events ?? 0;

  const hasPendingIntervention = pendingIntervention !== null;

  // Resolve test case metadata for AssertionPanel
  const testCaseMeta = useMemo(() => {
    if (!isTestCase || !testCaseId) return null;
    const key = testCaseId === "TC-001" ? "TC001" : "TC002";
    return testSuiteConfig[key as keyof typeof testSuiteConfig] ?? null;
  }, [isTestCase, testCaseId]);

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
    <div
      className="flex flex-col"
      style={{
        height: "calc(100vh - 57px)",
        background: isTestCase ? "#080c14" : undefined,
      }}
    >
      {/* TEST MODE banner */}
      {isTestCase && (
        <div className="flex items-center gap-3 px-4 py-1.5 bg-violet-950/70 border-b border-violet-800/50">
          <span className="text-xs px-2 py-0.5 rounded bg-violet-800 text-violet-100 font-mono font-semibold tracking-wider">
            TEST MODE
          </span>
          <span className="text-xs text-violet-300 font-mono">
            Behavioral evaluation active — assertions evaluated after each event
          </span>
        </div>
      )}

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
              showAnalytics={showAnalytics}
              toggleAnalytics={toggleAnalytics}
              scenarioAnalytics={scenarioAnalytics}
              allAnalytics={allAnalytics}
              activeDomainConfig={activeDomainConfig}
            />
          )}
        </div>

        {/* ── Agent canvas — takes remaining space ──────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <AgentCanvas
            evaluations={evaluations}
            events={events}
            config={activeDomainConfig}
            advancing={advancing}
            pendingIntervention={pendingIntervention}
            onIntervene={intervene}
            scenarioId={activeScenario}
            selectedEventIndex={selectedEventIndex}
            onSelectEvent={selectEvent}
          />
        </div>

        {/* ── Assertion panel — only in test mode ───────────────────────── */}
        {isTestCase && testCaseMeta && (
          <AssertionPanel
            testCaseId={testCaseMeta.testCaseId}
            testCaseTitle={testCaseMeta.title}
            testCaseDescription={testCaseMeta.description}
            propertyUnderTest={testCaseMeta.property_under_test}
            assertions={assertionResults}
            totalEvents={totalEvents}
            completedEvents={completedEvents}
          />
        )}
      </div>
    </div>
  );
}
