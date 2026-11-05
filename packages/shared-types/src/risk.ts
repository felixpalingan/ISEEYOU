import { SeverityLevel } from './entities.js';

/**
 * Standard deterministic risk weight calculation matrix (0-100)
 */
export const RISK_WEIGHTS: Record<SeverityLevel, number> = {
  critical: 35,
  high: 20,
  medium: 10,
  low: 5,
  info: 0,
};

export function calculateNormalizedRiskScore(severities: SeverityLevel[]): number {
  if (severities.length === 0) return 0;
  const rawScore = severities.reduce((acc, curr) => acc + RISK_WEIGHTS[curr], 0);
  return Math.min(100, rawScore);
}
