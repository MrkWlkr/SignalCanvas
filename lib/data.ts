import fs from "fs";
import path from "path";

export interface Employee {
  employee_id: string;
  employee_name: string;
  home_country: string;
  host_country: string;
  assignment_type: string;
  start_date: string;
  planned_duration_days: number;
  department: string;
  policy_id: string;
  case_id: string;
  scenario_id: string;
}

export interface CountryRule {
  route_id: string;
  home_country: string;
  host_country: string;
  tax_threshold_days: number;
  payroll_review_threshold_days: number;
  visa_category: string;
  typical_visa_processing_days: number;
  hard_deadline_buffer_days: number;
  social_security_agreement: boolean;
  double_tax_treaty: boolean;
  notes: string;
}

export interface PolicyRule {
  policy_id: string;
  label: string;
  max_short_term_assignment_days: number;
  requires_payroll_review_above_days: number;
  requires_preapproval_for_extension: boolean;
  allowed_family_travel: boolean;
  cost_of_living_allowance: boolean;
  housing_allowance: boolean;
  notes: string;
}

export interface VisaCase {
  case_id: string;
  employee_id: string;
  visa_status: string;
  visa_delay_probability: number;
  days_until_assignment_start: number;
  documents_complete: boolean;
  missing_documents: string[];
  last_update: string;
  notes: string;
}

export interface PayrollStatus {
  employee_id: string;
  home_payroll_status: string;
  host_payroll_status: string;
  alignment_risk: string;
  shadow_payroll_required: boolean;
  last_reviewed: string;
  days_on_assignment: number;
  notes: string;
}

export interface SignalEvent {
  event_id: string;
  scenario_id: string;
  timestamp_offset_sec: number;
  event_type: string;
  event_category?: string;
  source_system?: string;
  day_offset?: number;
  minute_offset?: number;
  entity_id: string;
  acted_on?: boolean;
  unactioned_recommendation_indices?: number[];
  payload: Record<string, unknown>;
}

function loadJson<T>(relativePath: string): T {
  const fullPath = path.join(process.cwd(), relativePath);
  const raw = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(raw) as T;
}

// Load signal events from an arbitrary relative path — used for path-aware loading
export function loadSignalEventsFromPath(relativePath: string): SignalEvent[] {
  return loadJson<SignalEvent[]>(relativePath);
}

export function loadEmployees(): Employee[] {
  return loadJson<Employee[]>("data/mobility/employees.json");
}

export function loadCountryRules(): CountryRule[] {
  return loadJson<CountryRule[]>("data/mobility/country_rules.json");
}

export function loadPolicyRules(): PolicyRule[] {
  return loadJson<PolicyRule[]>("data/mobility/policy_rules.json");
}

export function loadVisaCases(): VisaCase[] {
  return loadJson<VisaCase[]>("data/mobility/visa_cases.json");
}

export function loadPayrollStatuses(): PayrollStatus[] {
  return loadJson<PayrollStatus[]>("data/mobility/payroll_status.json");
}

export function loadSignalEvents(): SignalEvent[] {
  return loadJson<SignalEvent[]>("data/mobility/signal_events.json");
}
