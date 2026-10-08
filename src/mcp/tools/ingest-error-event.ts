import { z } from "zod";
import type { IncidentSignal } from "../../adapters/observability.js";
import { log } from "../../adapters/logger.js";
import {
  DEFAULT_ERROR_EVENT_FIXTURE,
  ERROR_EVENT_FIXTURES,
  type SentryStyleErrorEvent,
} from "../fixtures.js";
import { resolveToolMode, type McpModeResolution } from "../mode.js";
import type { McpToolContext } from "./context.js";

export const sentryStyleErrorEventSchema = z.object({
  event_id: z.string().min(1),
  timestamp: z.string().min(1),
  level: z.enum(["fatal", "error", "warning"]),
  platform: z.string(),
  environment: z.string(),
  release: z.string().optional(),
  message: z.string().optional(),
  exception: z
    .object({
      values: z.array(
        z.object({
          type: z.string(),
          value: z.string(),
          stacktrace: z
            .object({
              frames: z.array(
                z.object({
                  filename: z.string(),
                  function: z.string().optional(),
                  lineno: z.number().optional(),
                }),
              ),
            })
            .optional(),
        }),
      ),
    })
    .optional(),
  request: z
    .object({
      method: z.string(),
      url: z.string(),
      status_code: z.number().optional(),
    })
    .optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

export const ingestErrorEventInput = {
  fixtureId: z
    .string()
    .optional()
    .describe(`Fixture event id (default ${DEFAULT_ERROR_EVENT_FIXTURE})`),
  event: sentryStyleErrorEventSchema
    .optional()
    .describe("Inline Sentry-style error event; overrides fixtureId"),
};

export interface IngestErrorEventArgs {
  fixtureId?: string;
  event?: SentryStyleErrorEvent;
}

export interface IngestErrorEventResult {
  mode: McpModeResolution;
  source: "fixture" | "inline";
  fixtureId: string | null;
  event: SentryStyleErrorEvent;
  signal: IncidentSignal;
}

function summarize(event: SentryStyleErrorEvent): string {
  const ex = event.exception?.values[0];
  if (ex) {
    return `${ex.type}: ${ex.value}`;
  }
  return event.message ?? `Sentry event ${event.event_id}`;
}

export function ingestErrorEvent(
  ctx: McpToolContext,
  args: IngestErrorEventArgs,
): IngestErrorEventResult {
  const mode = resolveToolMode("ingest_error_event", ctx.env);

  let event: SentryStyleErrorEvent;
  let fixtureId: string | null = null;
  if (args.event) {
    event = args.event;
  } else {
    fixtureId = args.fixtureId ?? DEFAULT_ERROR_EVENT_FIXTURE;
    const fixture = ERROR_EVENT_FIXTURES[fixtureId];
    if (!fixture) {
      throw new Error(
        `Unknown error event fixture "${fixtureId}". Known: ${Object.keys(ERROR_EVENT_FIXTURES).join(", ")}`,
      );
    }
    event = fixture;
  }

  const status = event.request?.status_code;
  const signal: IncidentSignal = {
    kind: status !== undefined && status >= 500 ? "health_check_failed" : "error_rate",
    source: `sentry-style:${fixtureId ?? "inline"}`,
    message: summarize(event),
    observedAt: event.timestamp,
    metadata: {
      eventId: event.event_id,
      level: event.level,
      environment: event.environment,
      url: event.request?.url,
      statusCode: status,
      tags: event.tags,
    },
  };

  log("info", "mcp:ingest_error_event", "[DRY-RUN] Ingested error event", {
    mode: mode.effective,
    eventId: event.event_id,
    fixtureId,
  });

  return { mode, source: args.event ? "inline" : "fixture", fixtureId, event, signal };
}
