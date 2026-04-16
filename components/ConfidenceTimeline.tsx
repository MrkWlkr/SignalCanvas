"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Dot,
} from "recharts";
import type { EvaluationRecord, RiskLevel, SignalEvent } from "@/types";
import { formatEventType, riskStroke, eventCategoryStroke } from "@/components/ui";

interface Props {
  evaluations: EvaluationRecord[];
  events: SignalEvent[];
}

interface ChartPoint {
  index: number;
  label: string;
  confidence: number;
  risk_level: RiskLevel;
  event_category?: string;
  affected_domains: string[];
  first_action: string;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const dotColor = d.event_category && eventCategoryStroke[d.event_category.toLowerCase()]
    ? eventCategoryStroke[d.event_category.toLowerCase()]
    : riskStroke[d.risk_level];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 max-w-xs shadow-xl">
      <div className="text-xs text-gray-400 mb-1">{d.label}</div>
      {d.event_category && (
        <div className="text-xs text-gray-600 mb-1.5 capitalize">{d.event_category}</div>
      )}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-mono font-bold" style={{ color: dotColor }}>
          {d.confidence.toFixed(2)}
        </span>
        <span className="text-xs font-bold uppercase" style={{ color: dotColor }}>
          {d.risk_level}
        </span>
      </div>
      {d.first_action && (
        <div className="text-xs text-gray-400 leading-snug border-t border-gray-800 pt-2">
          {d.first_action}
        </div>
      )}
    </div>
  );
}

export default function ConfidenceTimeline({ evaluations, events }: Props) {
  const eventMap = new Map(events.map((e) => [e.event_id, e]));

  const data: ChartPoint[] = evaluations.map((ev, i) => {
    const event = eventMap.get(ev.event_id);
    return {
      index: i,
      label: formatEventType(ev.event_type),
      confidence: ev.evaluation.confidence,
      risk_level: ev.evaluation.risk_level,
      event_category: event?.event_category,
      affected_domains: ev.evaluation.affected_domains,
      first_action: ev.evaluation.recommended_actions[0] ?? "",
    };
  });

  const latestRisk: RiskLevel =
    evaluations.length > 0 ? evaluations[evaluations.length - 1].evaluation.risk_level : "low";
  const strokeColor = riskStroke[latestRisk];

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Confidence over time</div>

        {data.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
            No evaluations yet — advance the scenario
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#6b7280", fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
                tickLine={false}
                axisLine={{ stroke: "#374151" }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={0.7}
                stroke="#6b7280"
                strokeDasharray="4 4"
                label={{
                  value: "Escalation threshold",
                  position: "insideTopRight",
                  fill: "#6b7280",
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="confidence"
                stroke={strokeColor}
                strokeWidth={2}
                dot={(props) => {
                  const point = data[props.index];
                  if (!point) return <></>;
                  const catKey = point.event_category?.toLowerCase() ?? "";
                  const dotColor = eventCategoryStroke[catKey] ?? riskStroke[point.risk_level];
                  return (
                    <Dot
                      {...props}
                      r={5}
                      fill={dotColor}
                      stroke="#030712"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 7, stroke: strokeColor, fill: "#030712", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      {data.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Evaluation log</div>
          <div className="flex flex-col gap-1.5">
            {data.map((d, i) => {
              const catKey = d.event_category?.toLowerCase() ?? "";
              const dotColor = eventCategoryStroke[catKey] ?? riskStroke[d.risk_level];
              return (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="text-gray-600 font-mono w-4">{i + 1}</span>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                  <span className="text-gray-400 flex-1 truncate">{d.label}</span>
                  {d.event_category && (
                    <span className="text-gray-600 capitalize text-xs">{d.event_category}</span>
                  )}
                  <span className="font-mono text-gray-300">{d.confidence.toFixed(2)}</span>
                  <span className="text-xs uppercase font-medium" style={{ color: riskStroke[d.risk_level] }}>
                    {d.risk_level}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
