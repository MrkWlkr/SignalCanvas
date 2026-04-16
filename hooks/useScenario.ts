"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ScenarioApiResponse, StateApiResponse } from "@/types";

export function useScenario(scenarioId = "SCENARIO_ESCALATING") {
  const [scenarioData, setScenarioData] = useState<ScenarioApiResponse | null>(null);
  const [stateData, setStateData] = useState<StateApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playingRef = useRef(false);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchScenario = useCallback(async () => {
    try {
      const res = await fetch(`/api/scenario?scenarioId=${scenarioId}`);
      const data = await res.json();
      setScenarioData(data);
    } catch (e) {
      setError("Failed to load scenario");
      console.error(e);
    }
  }, [scenarioId]);

  const fetchState = useCallback(async (): Promise<StateApiResponse | null> => {
    try {
      const res = await fetch(`/api/state?scenarioId=${scenarioId}`);
      const data: StateApiResponse = await res.json();
      setStateData(data);
      return data;
    } catch (e) {
      setError("Failed to load state");
      console.error(e);
      return null;
    }
  }, [scenarioId]);

  useEffect(() => {
    // Stop play loop when scenario changes
    playingRef.current = false;
    setPlaying(false);
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    setLoading(true);
    Promise.all([fetchScenario(), fetchState()]).finally(() => setLoading(false));
  }, [fetchScenario, fetchState]);

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

  // Play loop ref — always points to latest doAdvance closure
  const doAdvanceRef = useRef(doAdvance);
  useEffect(() => { doAdvanceRef.current = doAdvance; }, [doAdvance]);

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
    // Immediately advance once, then schedule subsequent advances
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

  const reset = useCallback(async () => {
    // Stop play if running
    playingRef.current = false;
    setPlaying(false);
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      await fetchState();
    } catch (e) {
      setError("Reset failed");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [scenarioId, fetchState]);

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
  };
}
