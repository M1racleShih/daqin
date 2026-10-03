import { runManaged } from "./process.ts";
import type { Identity } from "./process.ts";

export type PiSummary = {
  exitCode: number | null;
  signal: string | null;
  settled: boolean;
  cancelled: boolean;
  protocolErrors: number;
  assistantErrors: number;
  events: Record<string, number>;
  tools: Record<string, number>;
};

export const piArgs = [
  "--provider", "xiaomi-token-plan-cn", "--model", "mimo-v2.6-pro",
  "--thinking", "medium", "--mode", "json", "--print", "--no-session",
  "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-context-files",
  "--no-approve", "--tools", "read,bash,edit,write",
];

// This is trusted local execution. Tool selection and prompts are not a sandbox.
export async function runPi(options: {
  cwd: string;
  prompt: string;
  executable?: string;
  args?: string[];
  signal?: AbortSignal;
  onEvent?: (type: string) => void;
  onSpawn?: (pid: number, record: Identity) => void;
  timeoutMs?: number;
  stopGraceMs?: number;
}): Promise<PiSummary> {
  if (process.platform !== "linux") throw new Error("Pi process control requires Linux");
  if (options.signal?.aborted) throw new Error("Run cancelled before spawn");
  const summary: PiSummary = {
    exitCode: null, signal: null, settled: false, cancelled: false,
    protocolErrors: 0, assistantErrors: 0, events: {}, tools: {},
  };
  let pending = "";
  const abort = new AbortController();
  const stop = () => abort.abort();
  options.signal?.addEventListener("abort", stop, { once: true });
  if (options.signal?.aborted) stop();
  const line = (record: string) => {
    try {
      const event = JSON.parse(record.replace(/\r$/, ""));
      if (typeof event.type !== "string") throw new Error("Missing event type");
      summary.events[event.type] = (summary.events[event.type] ?? 0) + 1;
      if (event.type === "agent_settled") summary.settled = true;
      if (event.type === "agent_start") summary.settled = false;
      if (event.type === "message_end" && event.message?.role === "assistant"
          && ["error", "aborted"].includes(event.message.stopReason)) summary.assistantErrors++;
      if (event.type === "tool_execution_start" && typeof event.toolName === "string") {
        summary.tools[event.toolName] = (summary.tools[event.toolName] ?? 0) + 1;
      }
      options.onEvent?.(event.type);
    } catch { summary.protocolErrors++; }
  };
  try {
    const result = await runManaged({
      cwd: options.cwd, file: options.executable ?? "pi",
      args: [...(options.args ?? piArgs), options.prompt], signal: abort.signal,
      timeoutMs: options.timeoutMs, stopGraceMs: options.stopGraceMs,
      onSpawn: record => options.onSpawn?.(record.pid, record),
      stdout: chunk => {
        pending += chunk;
        let end: number;
        while ((end = pending.indexOf("\n")) >= 0) {
          line(pending.slice(0, end));
          pending = pending.slice(end + 1);
        }
        if (pending.length > 8 * 1024 * 1024) {
          summary.protocolErrors++; pending = ""; stop();
        }
      },
    });
    if (pending) summary.protocolErrors++;
    return { ...summary, ...result };
  } finally { options.signal?.removeEventListener("abort", stop); }

}

export function piSucceeded(result: PiSummary): boolean {
  return result.exitCode === 0 && result.settled && !result.cancelled
    && result.protocolErrors === 0 && result.assistantErrors === 0;
}
