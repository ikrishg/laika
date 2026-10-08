import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

export async function waitForHealth(
  baseUrl: string,
  maxAttempts = 30,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, "")}/health`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Sample app did not become healthy at ${url}`);
}

export function startSampleApp(port: number): ChildProcess {
  const sampleDir = path.join(process.cwd(), "examples/sample-app");
  const child = spawn("node", ["server.js"], {
    cwd: sampleDir,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  return child;
}
