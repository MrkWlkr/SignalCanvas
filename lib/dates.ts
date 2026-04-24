// ─────────────────────────────────────────────────────────────────────────────
// dates.ts — pure timeline utility functions
// Domain-agnostic: reads granularity from DomainConfig, no mobility-specific logic.
// Uses native Date — no external date libraries.
// ─────────────────────────────────────────────────────────────────────────────

import type { DomainConfig } from "./domain-config";

type Granularity = DomainConfig["timeline"]["granularity"];

// Convert a day_offset (or minute/second offset) to an absolute Date
function applyOffset(monitoringStartDate: string, offset: number, granularity: Granularity): Date {
  const d = new Date(monitoringStartDate);
  if (granularity === "day") {
    d.setUTCDate(d.getUTCDate() + offset);
  } else if (granularity === "minute") {
    d.setUTCMinutes(d.getUTCMinutes() + offset);
  } else {
    d.setUTCSeconds(d.getUTCSeconds() + offset);
  }
  return d;
}

// Convert offset to real calendar date — returns ISO string
export function offsetToDate(
  monitoringStartDate: string,
  offset: number,
  granularity: Granularity
): string {
  return applyOffset(monitoringStartDate, offset, granularity).toISOString();
}

// Format for display — primary and secondary labels
export function formatEventDate(
  monitoringStartDate: string,
  offset: number,
  granularity: Granularity
): { primary: string; secondary: string } {
  const d = applyOffset(monitoringStartDate, offset, granularity);

  if (granularity === "day") {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const primary = `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
    const secondary = `Day ${offset}`;
    return { primary, secondary };
  }

  // minute and second: HH:MM:SS primary
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  const primary = `${hh}:${mm}:${ss}`;
  const secondary = granularity === "minute" ? `T+${offset}min` : `T+${offset}s`;
  return { primary, secondary };
}

// Calculate deadline display string
export function formatDeadline(
  deadlineCount: number,
  deadlineLabel: string,
  granularity: Granularity
): string {
  const label = deadlineLabel.toLowerCase();
  if (granularity === "day") {
    return `${deadlineCount} ${label}`;
  } else if (granularity === "minute") {
    return `${deadlineCount} min ${label}`;
  } else {
    return `${deadlineCount}s ${label}`;
  }
}

// Returns true when the deadline count indicates the window has elapsed
export function isDeadlinePast(deadlineCount: number): boolean {
  return deadlineCount <= 0;
}
