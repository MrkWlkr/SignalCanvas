// Approximate cost calculation based on claude-sonnet-4-6 pricing
// Input: $3 per million tokens
// Output: $15 per million tokens
export function estimateCost(tokens_input: number, tokens_output: number): number {
  const inputCost = (tokens_input / 1_000_000) * 3;
  const outputCost = (tokens_output / 1_000_000) * 15;
  return Math.round((inputCost + outputCost) * 10000) / 10000;
}
