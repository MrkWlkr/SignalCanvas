// Server-only — ops domain baseline context.
// Never import this from client components.
import { getService, getServiceDependencies, getSlaStatus } from "@/lib/tools-ops";

export async function getOpsBaselineContext(): Promise<Record<string, unknown>> {
  const primaryService = getService("SVC001");
  const priceStackService = getService("SVC002");
  const deps = getServiceDependencies("SVC001");
  const sla = getSlaStatus("SVC001");
  return {
    primary_service: primaryService,
    price_stack_service: priceStackService,
    dependencies: deps,
    sla_status: sla,
  };
}
