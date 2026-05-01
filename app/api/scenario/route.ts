import { NextRequest, NextResponse } from "next/server";
import {
  loadEmployees,
  loadVisaCases,
  loadPayrollStatuses,
  loadSignalEventsFromPath,
} from "@/lib/data";
import { getConfigForScenario } from "@/lib/config-registry";
import type { PrimaryEntity } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get("scenarioId") ?? "SCENARIO_ESCALATING";
  const path = searchParams.get("path") ?? "default";

  const domainConfig = getConfigForScenario(scenarioId);

  const eventsFilePath =
    domainConfig.scenarioPaths[scenarioId]?.[path] ??
    domainConfig.scenarioPaths[scenarioId]?.["default"];

  if (!eventsFilePath) {
    return NextResponse.json(
      { error: `No scenario configured: ${scenarioId}` },
      { status: 404 }
    );
  }

  const signalEvents = loadSignalEventsFromPath(eventsFilePath);
  const events = signalEvents.filter((e) => e.scenario_id === scenarioId);

  // ── Test domain ───────────────────────────────────────────────────────────
  if (domainConfig.id === "test") {
    const primaryEntity: PrimaryEntity = {
      name: "Behavioral Test Suite",
      subtitle: domainConfig.scenarioLabel,
      tags: [domainConfig.testCaseId ?? "Test", "Behavioral Eval"],
      meta: [
        { label: "Test case", value: domainConfig.testCaseId ?? "—" },
        { label: "Signals", value: `${events.length}` },
      ],
    };

    return NextResponse.json({
      scenario: {
        id: scenarioId,
        label: domainConfig.scenarioLabel,
        employee_name: "Behavioral Test Suite",
        route: "",
        start_date: "",
        duration_days: 0,
      },
      events,
      primary_entity: primaryEntity,
    });
  }

  // ── Ops domain ────────────────────────────────────────────────────────────
  if (domainConfig.id === "ops") {
    const primaryEntity: PrimaryEntity = {
      name: "price-stack-service",
      subtitle: "Silent pricing field corruption",
      tags: ["P1", "Platform Engineering"],
      meta: [
        { label: "Ticket", value: "PLAT-8841" },
        { label: "Signals", value: `${events.length}` },
      ],
    };

    return NextResponse.json({
      scenario: {
        id: scenarioId,
        label: `price-stack-service — Silent pricing field corruption — ${events.length} signals`,
        employee_name: "price-stack-service",
        route: "vehicle-inventory-api → dealer-portal-api",
        start_date: domainConfig.timeline.monitoringStartDates[scenarioId] ?? "",
        duration_days: 0,
      },
      events,
      primary_entity: primaryEntity,
    });
  }

  // ── Mobility domain ───────────────────────────────────────────────────────
  const employees = loadEmployees();
  const visaCases = loadVisaCases();
  const payrollStatuses = loadPayrollStatuses();

  const employee = employees.find((e) => e.scenario_id === scenarioId);
  if (!employee) {
    return NextResponse.json(
      { error: `No employee found for scenario: ${scenarioId}` },
      { status: 404 }
    );
  }

  const visaCase = visaCases.find((v) => v.case_id === employee.case_id);
  const payrollStatus = payrollStatuses.find((p) => p.employee_id === employee.employee_id);

  const primaryEntity: PrimaryEntity = {
    name: employee.employee_name,
    subtitle: `${employee.home_country} → ${employee.host_country}`,
    tags: [employee.assignment_type.replace("_", " "), employee.department],
    meta: [
      { label: "Start date", value: employee.start_date },
      { label: "Duration", value: `${employee.planned_duration_days} days` },
    ],
  };

  return NextResponse.json({
    scenario: {
      id: scenarioId,
      label: `${employee.employee_name} — ${employee.home_country} → ${employee.host_country}`,
      employee_name: employee.employee_name,
      route: `${employee.home_country} → ${employee.host_country}`,
      start_date: employee.start_date,
      duration_days: employee.planned_duration_days,
    },
    events,
    employee,
    visa_case: visaCase ?? null,
    payroll_status: payrollStatus ?? null,
    primary_entity: primaryEntity,
  });
}
