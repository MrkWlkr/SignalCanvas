// Client-safe — only imports configs with no fs dependencies.
import { mobilityConfig, type DomainConfig } from "@/lib/domain-config";
import { opsConfig } from "@/lib/configs/ops-config";

export const configRegistry: Record<string, DomainConfig> = {
  SCENARIO_ESCALATING:     mobilityConfig,
  SCENARIO_CRITICAL:       mobilityConfig,
  SCENARIO_HEALTHY:        mobilityConfig,
  SCENARIO_DEALER_PRICING: opsConfig,
};

export function getConfigForScenario(scenarioId: string): DomainConfig {
  return configRegistry[scenarioId] ?? mobilityConfig;
}
