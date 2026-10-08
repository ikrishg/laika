import type { HarnessConfig } from "../config/env.js";
import { log } from "./logger.js";

export interface HealthSnapshot {
  url: string;
  ok: boolean;
  statusCode: number;
  bodySnippet: string;
  latencyMs: number;
  checkedAt: string;
}

export interface IncidentSignal {
  kind: "downtime" | "error_rate" | "health_check_failed";
  source: string;
  message: string;
  observedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ObservabilityEvent {
  type: string;
  flow: "prod-incident" | "pr-exercise";
  payload: Record<string, unknown>;
  recordedAt: string;
}

export interface ObservabilityAdapter {
  checkHealth(): Promise<HealthSnapshot>;
  ingestSignal(signal: IncidentSignal): Promise<void>;
  recordEvent(event: ObservabilityEvent): Promise<void>;
  getRecentEvents(): Promise<ObservabilityEvent[]>;
}

export function createObservabilityAdapter(
  config: HarnessConfig,
): ObservabilityAdapter {
  const events: ObservabilityEvent[] = [];

  return {
    async checkHealth() {
      const start = Date.now();
      const url = `${config.targetAppUrl.replace(/\/$/, "")}/health`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const text = await res.text();
        const snapshot: HealthSnapshot = {
          url,
          ok: res.ok,
          statusCode: res.status,
          bodySnippet: text.slice(0, 200),
          latencyMs: Date.now() - start,
          checkedAt: new Date().toISOString(),
        };
        log("info", "observability", "Health check", { ...snapshot });
        return snapshot;
      } catch (err) {
        const snapshot: HealthSnapshot = {
          url,
          ok: false,
          statusCode: 0,
          bodySnippet: err instanceof Error ? err.message : String(err),
          latencyMs: Date.now() - start,
          checkedAt: new Date().toISOString(),
        };
        log("warn", "observability", "Health check failed", { ...snapshot });
        return snapshot;
      }
    },

    async ingestSignal(signal: IncidentSignal) {
      log("info", "observability", "Incident signal ingested", {
        ...signal,
      });
    },

    async recordEvent(event: ObservabilityEvent) {
      events.push(event);
      if (config.dryRun) {
        log("info", "observability", "[DRY-RUN] Recorded observability event", {
          type: event.type,
          flow: event.flow,
        });
      } else {
        log("info", "observability", "Recorded observability event", {
          type: event.type,
          flow: event.flow,
        });
      }
    },

    async getRecentEvents() {
      return [...events];
    },
  };
}

/** In-memory observability for tests */
export function createInMemoryObservability(
  config: HarnessConfig,
): ObservabilityAdapter & { _events: ObservabilityEvent[] } {
  const inner = createObservabilityAdapter(config);
  const _events: ObservabilityEvent[] = [];
  return {
    _events,
    checkHealth: () => inner.checkHealth(),
    ingestSignal: (s) => inner.ingestSignal(s),
    async recordEvent(event) {
      _events.push(event);
      await inner.recordEvent(event);
    },
    async getRecentEvents() {
      return _events;
    },
  };
}
