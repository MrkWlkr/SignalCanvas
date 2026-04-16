import {
  loadEmployees,
  loadCountryRules,
  loadPolicyRules,
  loadVisaCases,
  loadPayrollStatuses,
  loadSignalEvents,
} from "./data";

// Tool implementations

export function getEmployee(employeeId: string) {
  const employees = loadEmployees();
  const employee = employees.find((e) => e.employee_id === employeeId);
  if (!employee) return { error: `No employee found with id: ${employeeId}` };
  return employee;
}

export function getAssignment(employeeId: string) {
  const employees = loadEmployees();
  const employee = employees.find((e) => e.employee_id === employeeId);
  if (!employee) return { error: `No employee found with id: ${employeeId}` };

  const countryRules = loadCountryRules();
  const countryRule = countryRules.find(
    (r) =>
      r.home_country === employee.home_country &&
      r.host_country === employee.host_country
  );

  const policyRules = loadPolicyRules();
  const policy = policyRules.find((p) => p.policy_id === employee.policy_id);

  return {
    employee,
    country_rule: countryRule ?? null,
    policy: policy ?? null,
  };
}

export function getCountryRule(homeCountry: string, hostCountry: string) {
  const countryRules = loadCountryRules();
  const rule = countryRules.find(
    (r) => r.home_country === homeCountry && r.host_country === hostCountry
  );
  if (!rule)
    return {
      error: `No country rule found for route: ${homeCountry} → ${hostCountry}`,
    };
  return rule;
}

export function getPolicy(policyId: string) {
  const policyRules = loadPolicyRules();
  const policy = policyRules.find((p) => p.policy_id === policyId);
  if (!policy) return { error: `No policy found with id: ${policyId}` };
  return policy;
}

export function getVisaCase(caseId: string) {
  const visaCases = loadVisaCases();
  const visaCase = visaCases.find((v) => v.case_id === caseId);
  if (!visaCase) return { error: `No visa case found with id: ${caseId}` };
  return visaCase;
}

export function getPayrollStatus(employeeId: string) {
  const payrollStatuses = loadPayrollStatuses();
  const status = payrollStatuses.find((p) => p.employee_id === employeeId);
  if (!status)
    return { error: `No payroll status found for employee: ${employeeId}` };
  return status;
}

export function getRecentSignals(scenarioId: string, maxIndex?: number) {
  const events = loadSignalEvents();
  const scenarioEvents = events.filter((e) => e.scenario_id === scenarioId);
  // Only return events up to and including maxIndex so Claude can't see future signals
  const scoped =
    maxIndex !== undefined
      ? scenarioEvents.slice(0, maxIndex + 1)
      : scenarioEvents;
  return scoped.slice(-5);
}

export function calculateDaysUntilStart(startDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const diffMs = start.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return { days_until_start: diffDays, start_date: startDate };
}

// Tool dispatch — maps tool names to functions
export function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>
): unknown {
  switch (toolName) {
    case "get_employee":
      return getEmployee(toolInput.employee_id as string);
    case "get_assignment":
      return getAssignment(toolInput.employee_id as string);
    case "get_country_rule":
      return getCountryRule(
        toolInput.home_country as string,
        toolInput.host_country as string
      );
    case "get_policy":
      return getPolicy(toolInput.policy_id as string);
    case "get_visa_case":
      return getVisaCase(toolInput.case_id as string);
    case "get_payroll_status":
      return getPayrollStatus(toolInput.employee_id as string);
    case "get_recent_signals":
      return getRecentSignals(toolInput.scenario_id as string);
    case "calculate_days_until_start":
      return calculateDaysUntilStart(toolInput.start_date as string);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Anthropic tool definitions
export const TOOL_DEFINITIONS = [
  {
    name: "get_employee",
    description:
      "Retrieve an employee record by employee ID. Returns name, home/host country, assignment type, start date, department, and associated policy and case IDs.",
    input_schema: {
      type: "object",
      properties: {
        employee_id: {
          type: "string",
          description: "The employee ID, e.g. E001",
        },
      },
      required: ["employee_id"],
    },
  },
  {
    name: "get_assignment",
    description:
      "Retrieve full assignment context for an employee: employee record, matched country rule, and associated policy. Use this as the primary first call when assessing an assignment.",
    input_schema: {
      type: "object",
      properties: {
        employee_id: {
          type: "string",
          description: "The employee ID, e.g. E001",
        },
      },
      required: ["employee_id"],
    },
  },
  {
    name: "get_country_rule",
    description:
      "Look up country-level rules for a specific home → host country route, including tax threshold days, payroll review thresholds, visa category, processing times, and treaty status.",
    input_schema: {
      type: "object",
      properties: {
        home_country: {
          type: "string",
          description: "ISO country code or name of the home country, e.g. UK",
        },
        host_country: {
          type: "string",
          description: "ISO country code or name of the host country, e.g. US",
        },
      },
      required: ["home_country", "host_country"],
    },
  },
  {
    name: "get_policy",
    description:
      "Retrieve a mobility policy by policy ID. Returns max assignment days, payroll review triggers, extension pre-approval requirements, and benefit entitlements.",
    input_schema: {
      type: "object",
      properties: {
        policy_id: {
          type: "string",
          description: "The policy ID, e.g. P_US_UK_01",
        },
      },
      required: ["policy_id"],
    },
  },
  {
    name: "get_visa_case",
    description:
      "Retrieve visa case details by case ID. Returns visa status, delay probability, days until assignment start, document completeness, and missing documents.",
    input_schema: {
      type: "object",
      properties: {
        case_id: {
          type: "string",
          description: "The visa case ID, e.g. CASE001",
        },
      },
      required: ["case_id"],
    },
  },
  {
    name: "get_payroll_status",
    description:
      "Retrieve payroll alignment status for an employee. Returns home and host payroll status, alignment risk level, shadow payroll requirement, and last review date.",
    input_schema: {
      type: "object",
      properties: {
        employee_id: {
          type: "string",
          description: "The employee ID, e.g. E001",
        },
      },
      required: ["employee_id"],
    },
  },
  {
    name: "get_recent_signals",
    description:
      "Retrieve the last 5 signal events for a given scenario ID. Useful for understanding the recent event history and escalation trajectory.",
    input_schema: {
      type: "object",
      properties: {
        scenario_id: {
          type: "string",
          description: "The scenario ID, e.g. SCENARIO_ESCALATING",
        },
      },
      required: ["scenario_id"],
    },
  },
  {
    name: "calculate_days_until_start",
    description:
      "Calculate the number of days from today until a given assignment start date. Returns the day count and confirms the start date.",
    input_schema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "ISO date string for the assignment start, e.g. 2026-07-01",
        },
      },
      required: ["start_date"],
    },
  },
] as const;
