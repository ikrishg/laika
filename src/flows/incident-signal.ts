import type { HealthSnapshot, IncidentSignal } from "../adapters/observability.js";

export function deriveIncidentSignalFromHealth(
  health: HealthSnapshot,
): IncidentSignal | null {
  if (health.ok) {
    return null;
  }
  return {
    kind: "health_check_failed",
    source: "laika-observability-http",
    message: `Health check failed: ${health.statusCode} ${health.bodySnippet}`,
    observedAt: new Date().toISOString(),
    metadata: { url: health.url, latencyMs: health.latencyMs },
  };
}

export function buildDrillIncidentSignal(health: HealthSnapshot): IncidentSignal {
  return {
    kind: "error_rate",
    source: "laika-incident-drill",
    message: `Incident drill (target healthy at ${health.url})`,
    observedAt: new Date().toISOString(),
    metadata: { url: health.url, latencyMs: health.latencyMs, drill: true },
  };
}

/**
 * Drill only synthesizes an incident when health is OK. Failed health always wins.
 */
export function resolveIncidentSignalFromHealth(
  health: HealthSnapshot,
  options: { drill?: boolean },
): IncidentSignal | null {
  if (!health.ok) {
    return deriveIncidentSignalFromHealth(health);
  }
  if (options.drill) {
    return buildDrillIncidentSignal(health);
  }
  return null;
}
