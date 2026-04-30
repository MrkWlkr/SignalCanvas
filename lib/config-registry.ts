// Client-safe — only imports configs with no fs dependencies.
import { mobilityConfig, type DomainConfig } from "@/lib/domain-config";
import { opsConfig } from "@/lib/configs/ops-config";
import { tc001Config, tc002Config } from "@/lib/configs/test-suite-config";

export const configRegistry: Record<string, DomainConfig> = {
  SCENARIO_ESCALATING:     mobilityConfig,
  SCENARIO_HEALTHY:        mobilityConfig,
  SCENARIO_DEALER_PRICING: opsConfig,
  SCENARIO_TC001:          tc001Config,
  SCENARIO_TC002:          tc002Config,
};

export function getConfigForScenario(scenarioId: string): DomainConfig {
  return configRegistry[scenarioId] ?? mobilityConfig;
}
