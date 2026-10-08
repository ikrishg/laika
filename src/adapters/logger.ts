export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  component: string;
  message: string;
  data?: object;
  ts: string;
}

const entries: LogEntry[] = [];

export function log(
  level: LogLevel,
  component: string,
  message: string,
  data?: object,
): void {
  const entry: LogEntry = {
    level,
    component,
    message,
    data,
    ts: new Date().toISOString(),
  };
  entries.push(entry);
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function getLogBuffer(): readonly LogEntry[] {
  return entries;
}

export function clearLogBuffer(): void {
  entries.length = 0;
}
