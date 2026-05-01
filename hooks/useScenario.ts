"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { ScenarioApiResponse, StateApiResponse, EvaluatorOutput, ActionRegisterEntry, AssertionResult } from "@/types";
import type { InterventionOption, DomainConfig } from "@/lib/domain-config";
import { getConfigForScenario } from "@/lib/config-registry";
import {
  deriveScenarioAnalytics,
  deriveAllAnalytics,
  type ScenarioAnalytics,
  type AllAnalytics,
} from "@/lib/analytics";

export interface PendingInterventionState {
  evaluation: EvaluatorOutput;
  interventionOptions: InterventionOption[];
}

export function useScenario(scenarioId = "SCENARIO_ESCALATING") {
  const [scenarioData, setScenarioData] = useState<ScenarioApiResponse | null>(null);
  const [stateData, setStateData] = useState<StateApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingIntervention, setPendingIntervention] =
    useState<PendingInterventionState | null>(null);
  const [currentPath, setCurrentPath] = useState("default");
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [scenarioStateCache, setScenarioStateCache] = useState<Record<string, StateApiResponse>>({});
  const activeDomainConfig: DomainConfig = useMemo(
    () => getConfigForScenario(scenarioId),
    [scenarioId]
  );

  const playingRef = useRef(false);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actionRegister = useMemo((): ActionRegisterEntry[] => {
    if (!stateData) return [];
    if (selectedEventIndex === null) return stateData.action_register ?? [];
    const record = stateData.evaluations.find((e) => e.event_index === selectedEventIndex);
    return record?.registerSnapshot ?? stateData.action_register ?? [];
  }, [stateData, selectedEventIndex]);

  const selectEvent = useCallback((index: number | null) => {
    setSelectedEventIndex(index);
  }, []);

  const highlightCanvasNode = useCallback((index: number | null) => {
    setSelectedEventIndex(index);
  }, []);

  // ── Fetchers ──────────────────────────────────────────────────────────────

  const fetchScenario = useCallback(
    async (path = "default") => {
      try {
        const res = await fetch(
          `/api/scenario?scenarioId=${scenarioId}&path=${path}`
        );
        const data = await res.json();
        setScenarioData(data);
      } catch (e) {
        setError("Failed to load scenario");
        console.error(e);
      }
    },
    [scenarioId]
  );

  const fetchState = useCallback(async (): Promise<StateApiResponse | null> => {
    try {
      const res = await fetch(`/api/state?scenarioId=${scenarioId}`);
      const data: StateApiResponse = await res.json();
      setStateData(data);
      setScenarioStateCache((prev) => ({ ...prev, [scenarioId]: data }));
      return data;
    } catch (e) {
      setError("Failed to load state");
      console.error(e);
      return null;
    }
  }, [scenarioId]);

  // ── Bootstrap — fetch state first (for current_path), then scenario ───────

  useEffect(() => {
    // Stop any running play loop when scenario changes
    playingRef.current = false;
    setPlaying(false);
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    setPendingIntervention(null);
    setCurrentPath("default");
    setLoading(true);

    const load = async () => {
      const stateResult = await fetchState();
      const path = stateResult?.current_path ?? "default";
      setCurrentPath(path);

      // Restore pending intervention if one exists in state
      if (stateResult?.pending_intervention) {
        // We don't have intervention_options from state — re-fetch from config via advance response
        // For now, clear it; will be re-set when user re-advances if state survives hot-reload
      }

      await fetchScenario(path);
    };

    load().finally(() => setLoading(false));
  }, [fetchScenario, fetchState]);

  // ── Advance ───────────────────────────────────────────────────────────────

  const doAdvance = useCallback(async (): Promise<boolean> => {
    setAdvancing(true);
    setError(null);
    try {
      const res = await fetch("/api/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Advance failed");
        return false;
      }

      if (data.requires_intervention) {
        // Agent paused — surface the intervention card
        setPendingIntervention({
          evaluation: data.evaluation as EvaluatorOutput,
          interventionOptions: data.intervention_options as InterventionOption[],
        });
        await fetchState();
        return false; // Stop play loop
      }

      const state = await fetchState();
      return state != null && !state.complete;
    } catch (e) {
      setError("Advance request failed");
      console.error(e);
      return false;
    } finally {
      setAdvancing(false);
    }
  }, [scenarioId, fetchState]);

  // Keep ref in sync so the play loop always calls the latest closure
  const doAdvanceRef = useRef(doAdvance);
  useEffect(() => {
    doAdvanceRef.current = doAdvance;
  }, [doAdvance]);

  // ── Play loop ─────────────────────────────────────────────────────────────

  const scheduleNext = useCallback(() => {
    playTimerRef.current = setTimeout(async () => {
      if (!playingRef.current) return;
      const shouldContinue = await doAdvanceRef.current();
      if (shouldContinue && playingRef.current) {
        scheduleNext();
      } else {
        playingRef.current = false;
        setPlaying(false);
      }
    }, 2500);
  }, []);

  const advance = useCallback(async () => {
    await doAdvance();
  }, [doAdvance]);

  const playSimulation = useCallback(() => {
    if (playingRef.current) return;
    playingRef.current = true;
    setPlaying(true);
    doAdvanceRef.current().then((shouldContinue) => {
      if (shouldContinue && playingRef.current) {
        scheduleNext();
      } else {
        playingRef.current = false;
        setPlaying(false);
      }
    });
  }, [scheduleNext]);

  const pauseSimulation = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
  }, []);

  // ── Intervene ─────────────────────────────────────────────────────────────

  const intervene = useCallback(
    async (optionId: string) => {
      setAdvancing(true);
      setError(null);
      try {
        const res = await fetch("/api/intervene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioId,
            decision_id: `decision_${Date.now()}`,
            option_id: optionId,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Intervention failed");
          return;
        }

        const newPath = (data.current_path as string) ?? "default";
        setPendingIntervention(null);
        setCurrentPath(newPath);
        // Reload scenario events from the new path before refreshing state
        await fetchScenario(newPath);
        await fetchState();
      } catch (e) {
        setError("Intervention request failed");
        console.error(e);
      } finally {
        setAdvancing(false);
      }
    },
    [scenarioId, fetchScenario, fetchState]
  );

  // ── Reset ─────────────────────────────────────────────────────────────────

  const reset = useCallback(async () => {
    playingRef.current = false;
    setPlaying(false);
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    setLoading(true);
    setError(null);
    setPendingIntervention(null);
    setCurrentPath("default");
    setSelectedEventIndex(null);
    try {
      await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      await fetchScenario("default");
      await fetchState();
    } catch (e) {
      setError("Reset failed");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [scenarioId, fetchScenario, fetchState]);

  const assertionResults: AssertionResult[] = stateData?.assertion_results ?? [];
  const isTestCase = activeDomainConfig.isTestCase ?? false;
  const testCaseId = activeDomainConfig.testCaseId ?? null;

  const toggleAnalytics = useCallback(() => setShowAnalytics((prev) => !prev), []);

  const scenarioAnalytics: ScenarioAnalytics | null = useMemo(
    () => (stateData ? deriveScenarioAnalytics(stateData, activeDomainConfig) : null),
    [stateData, activeDomainConfig]
  );

  const allAnalytics: AllAnalytics | null = useMemo(
    () =>
      Object.keys(scenarioStateCache).length > 0
        ? deriveAllAnalytics(scenarioStateCache)
        : null,
    [scenarioStateCache]
  );

  return {
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
    setSelectedEventIndex,
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
  };
}
