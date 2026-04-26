// Server-only — never import this from client components.
// Fetches domain-specific baseline context for a scenario.
// Swap this file (and domain-config.ts) when changing domains.

import { loadEmployees } from "@/lib/data";
import {
  getEmployee,
  getAssignment,
  getVisaCase,
  getPayrollStatus,
} from "@/lib/tools";

export async function getBaselineContext(
  scenarioId: string
): Promise<Record<string, unknown>> {
  const allEmployees = loadEmployees();
  const employee = allEmployees.find((e) => e.scenario_id === scenarioId);
  if (!employee) return {};
  return {
    employee: getEmployee(employee.employee_id),
    assignment: getAssignment(employee.employee_id),
    visaCase: getVisaCase(employee.case_id),
    payroll: getPayrollStatus(employee.employee_id),
  };
}
