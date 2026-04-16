// Shared UI helpers — no JSX, safe to import anywhere
import type { RiskLevel } from "@/types";

export function formatEventType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const riskColors: Record<
  RiskLevel,
  { text: string; bg: string; border: string; hex: string }
> = {
  low: {
    text: "text-green-400",
    bg: "bg-green-950",
    border: "border-green-800",
    hex: "#166534",
  },
  medium: {
    text: "text-amber-400",
    bg: "bg-amber-950",
    border: "border-amber-800",
    hex: "#78350f",
  },
  high: {
    text: "text-orange-400",
    bg: "bg-orange-950",
    border: "border-orange-800",
    hex: "#7c2d12",
  },
  critical: {
    text: "text-red-400",
    bg: "bg-red-950",
    border: "border-red-800",
    hex: "#450a0a",
  },
};

export const riskBorderHex: Record<RiskLevel, string> = {
  low: "#16a34a",
  medium: "#d97706",
  high: "#ea580c",
  critical: "#dc2626",
};

export const riskStroke: Record<RiskLevel, string> = {
  low: "#4ade80",
  medium: "#fbbf24",
  high: "#fb923c",
  critical: "#f87171",
};

export function getRiskColors(level: RiskLevel | undefined) {
  return riskColors[level ?? "medium"];
}

export const eventCategoryColors: Record<
  string,
  { text: string; bg: string; border: string }
> = {
  visa: {
    text: "text-violet-300",
    bg: "bg-violet-950",
    border: "border-violet-800",
  },
  payroll: {
    text: "text-teal-300",
    bg: "bg-teal-950",
    border: "border-teal-800",
  },
  compliance: {
    text: "text-amber-300",
    bg: "bg-amber-950",
    border: "border-amber-800",
  },
  tax: {
    text: "text-yellow-300",
    bg: "bg-yellow-950",
    border: "border-yellow-800",
  },
  travel: {
    text: "text-cyan-300",
    bg: "bg-cyan-950",
    border: "border-cyan-800",
  },
  hr: {
    text: "text-indigo-300",
    bg: "bg-indigo-950",
    border: "border-indigo-800",
  },
  extension: {
    text: "text-orange-300",
    bg: "bg-orange-950",
    border: "border-orange-800",
  },
  policy: {
    text: "text-rose-300",
    bg: "bg-rose-950",
    border: "border-rose-800",
  },
};

export function getEventCategoryColors(category: string | undefined) {
  if (!category) return null;
  const key = category.toLowerCase();
  return eventCategoryColors[key] ?? {
    text: "text-gray-300",
    bg: "bg-gray-800",
    border: "border-gray-700",
  };
}

// Stroke color per event category (for charts)
export const eventCategoryStroke: Record<string, string> = {
  visa: "#a78bfa",
  payroll: "#5eead4",
  compliance: "#fcd34d",
  tax: "#fde68a",
  travel: "#67e8f9",
  hr: "#a5b4fc",
  extension: "#fb923c",
  policy: "#fda4af",
};
