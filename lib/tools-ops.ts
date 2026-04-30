// Server-only — ops domain tool implementations.
// Never import this from client components.
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data", "ops");

function loadJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(dataDir, filename), "utf-8")) as T;
}

type Service = Record<string, unknown> & { service_id: string; service_name: string };
type DeployEvent = Record<string, unknown> & {
  service_name: string;
  minutes_before_issue: number;
  deployed_at: string;
};
type ServiceDependency = Record<string, unknown> & {
  upstream_service: string;
  downstream_service: string;
};
type SlaConfig = Record<string, unknown> & { service_id: string; metric: string };
type Infrastructure = Record<string, unknown> & { resource_name: string };
type OpsEvent = Record<string, unknown> & {
  event_type: string;
  payload: Record<string, unknown>;
};

export function getService(serviceId: string) {
  const services = loadJson<Service[]>("services.json");
  const service = services.find((s) => s.service_id === serviceId);
  return service ?? { error: `No service found with id: ${serviceId}` };
}

export function getDeployHistory(serviceName: string, hoursBack: number = 24) {
  const deploys = loadJson<DeployEvent[]>("deploy_events.json");
  const maxMinutes = hoursBack * 60;
  return deploys
    .filter((d) => d.service_name === serviceName && d.minutes_before_issue <= maxMinutes)
    .sort((a, b) => new Date(b.deployed_at).getTime() - new Date(a.deployed_at).getTime());
}

export function getServiceDependencies(serviceId: string) {
  const services = loadJson<Service[]>("services.json");
  const service = services.find((s) => s.service_id === serviceId);
  if (!service) return { error: `No service found with id: ${serviceId}` };
  const name = service.service_name;
  const deps = loadJson<ServiceDependency[]>("service_dependencies.json");
  return deps.filter((d) => d.upstream_service === name || d.downstream_service === name);
}

export function getSlaStatus(serviceId: string) {
  const slas = loadJson<SlaConfig[]>("sla_configs.json");
  return slas.filter((s) => s.service_id === serviceId);
}

export function getInfrastructure(resourceName: string) {
  const infra = loadJson<Infrastructure[]>("infrastructure.json");
  const resource = infra.find((r) => r.resource_name === resourceName);
  return resource ?? { error: `No infrastructure resource found: ${resourceName}` };
}

export function searchPriorIncidents(queryTerms: string) {
  const events = loadJson<OpsEvent[]>("signal_events_ops.json");
  const terms = queryTerms.toLowerCase().split(/[\s,]+/).filter(Boolean);
  const matches = events.filter((e) => {
    const payloadStr = JSON.stringify(e.payload).toLowerCase();
    return (
      e.event_type.toLowerCase().includes("incident") ||
      terms.some((t) => payloadStr.includes(t))
    );
  });
  return {
    match_count: matches.length,
    events: matches,
    summary:
      matches.length > 0
        ? `Found ${matches.length} matching signal(s): ${matches.map((e) => e.event_type).join(", ")}`
        : "No matching prior incidents found",
  };
}

export function getAffectedAccounts(serviceId: string) {
  const slas = loadJson<SlaConfig[]>("sla_configs.json");
  const relevant = slas.filter(
    (s) =>
      s.service_id === serviceId &&
      (s.metric === "dealer_complaint_rate" || s.metric === "price_field_accuracy")
  );
  return relevant.length > 0
    ? relevant
    : { error: `No blast radius data found for service: ${serviceId}` };
}

export function calculateMinutesElapsed(startTime: string) {
  const start = new Date(startTime);
  const now = new Date();
  const minutes = Math.round((now.getTime() - start.getTime()) / 60000);
  return { minutes_elapsed: minutes, start_time: startTime, measured_at: now.toISOString() };
}

export function executeToolOps(
  toolName: string,
  toolInput: Record<string, unknown>
): unknown {
  switch (toolName) {
    case "get_service":
      return getService(toolInput.service_id as string);
    case "get_deploy_history":
      return getDeployHistory(
        toolInput.service_name as string,
        (toolInput.hours_back as number) ?? 24
      );
    case "get_service_dependencies":
      return getServiceDependencies(toolInput.service_id as string);
    case "get_sla_status":
      return getSlaStatus(toolInput.service_id as string);
    case "get_infrastructure":
      return getInfrastructure(toolInput.resource_name as string);
    case "search_prior_incidents":
      return searchPriorIncidents(toolInput.query_terms as string);
    case "get_affected_accounts":
      return getAffectedAccounts(toolInput.service_id as string);
    case "calculate_minutes_elapsed":
      return calculateMinutesElapsed(toolInput.start_time as string);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

export const TOOL_DEFINITIONS_OPS = [
  {
    name: "get_service",
    description:
      "Retrieve a service record by service ID. Returns name, tier, owner team, dependencies, current status, and SLA targets.",
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "Service ID, e.g. SVC001" },
      },
      required: ["service_id"],
    },
  },
  {
    name: "get_deploy_history",
    description:
      "Retrieve recent deployments for a service within the specified look-back window. Sorted by deploy time descending. Use to correlate issues with recent changes.",
    input_schema: {
      type: "object",
      properties: {
        service_name: { type: "string", description: "Service name, e.g. price-stack-service" },
        hours_back: {
          type: "number",
          description: "How many hours back to search for deploys. Default: 24.",
        },
      },
      required: ["service_name"],
    },
  },
  {
    name: "get_service_dependencies",
    description:
      "Retrieve upstream and downstream service dependencies for a service ID. Includes failure modes, blast radius, and detection difficulty.",
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "Service ID, e.g. SVC001" },
      },
      required: ["service_id"],
    },
  },
  {
    name: "get_sla_status",
    description:
      "Retrieve current SLA metrics and breach status for a service. Returns all tracked metrics including accuracy, response time, and complaint rate.",
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "Service ID, e.g. SVC001" },
      },
      required: ["service_id"],
    },
  },
  {
    name: "get_infrastructure",
    description:
      "Retrieve current infrastructure resource status by resource name. Covers RDS, SQS, ECS, Lambda, and CloudWatch alarms.",
    input_schema: {
      type: "object",
      properties: {
        resource_name: {
          type: "string",
          description: "Resource name, e.g. inventory-db-prod or price-stack-update-queue",
        },
      },
      required: ["resource_name"],
    },
  },
  {
    name: "search_prior_incidents",
    description:
      "Search signal history and incident records for prior events matching the query terms. Useful for pattern matching against known failure modes.",
    input_schema: {
      type: "object",
      properties: {
        query_terms: {
          type: "string",
          description: "Space or comma-separated search terms, e.g. 'price stack field mapping'",
        },
      },
      required: ["query_terms"],
    },
  },
  {
    name: "get_affected_accounts",
    description:
      "Retrieve blast radius data for a service — specifically dealer complaint rate and price field accuracy SLA metrics.",
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "Service ID, e.g. SVC001" },
      },
      required: ["service_id"],
    },
  },
  {
    name: "calculate_minutes_elapsed",
    description:
      "Calculate how many minutes have elapsed since a given start time. Use to track incident duration or SLA breach duration.",
    input_schema: {
      type: "object",
      properties: {
        start_time: {
          type: "string",
          description: "ISO timestamp string, e.g. 2026-07-15T13:00:00Z",
        },
      },
      required: ["start_time"],
    },
  },
] as const;
