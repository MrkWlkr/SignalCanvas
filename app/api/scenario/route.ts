import { NextRequest, NextResponse } from "next/server";
import {
  loadEmployees,
  loadVisaCases,
  loadPayrollStatuses,
  loadSignalEventsFromPath,
} from "@/lib/data";
import { domainConfig } from "@/lib/domain-config";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get("scenarioId") ?? "SCENARIO_ESCALATING";
  const path = searchParams.get("path") ?? "default";

  // Resolve the events file for this scenario + path
  const eventsFilePath =
    domainConfig.scenarioPaths[scenarioId]?.[path] ??
    domainConfig.scenarioPaths[scenarioId]?.["default"];

  if (!eventsFilePath) {
    return NextResponse.json(
      { error: `No scenario configured: ${scenarioId}` },
      { status: 404 }
    );
  }

  const employees = loadEmployees();
  const visaCases = loadVisaCases();
  const payrollStatuses = loadPayrollStatuses();
  const signalEvents = loadSignalEventsFromPath(eventsFilePath);

  const employee = employees.find((e) => e.scenario_id === scenarioId);
  if (!employee) {
    return NextResponse.json(
      { error: `No employee found for scenario: ${scenarioId}` },
      { status: 404 }
    );
  }

  const events = signalEvents.filter((e) => e.scenario_id === scenarioId);
  const visaCase = visaCases.find((v) => v.case_id === employee.case_id);
  const payrollStatus = payrollStatuses.find(
    (p) => p.employee_id === employee.employee_id
  );

  const scenario = {
    id: scenarioId,
    label: `${employee.employee_name} — ${employee.home_country} → ${employee.host_country}`,
    employee_name: employee.employee_name,
    route: `${employee.home_country} → ${employee.host_country}`,
    start_date: employee.start_date,
    duration_days: employee.planned_duration_days,
  };

  return NextResponse.json({
    scenario,
    events,
    employee,
    visa_case: visaCase ?? null,
    payroll_status: payrollStatus ?? null,
  });
}
