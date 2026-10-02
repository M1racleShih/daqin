import { spawn } from "node:child_process";

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
  onSpawn?: (pid: number) => void;
  stopGraceMs?: number;
}): Promise<PiSummary> {
  if (process.platform !== "linux") throw new Error("Pi process control requires Linux");
  if (options.signal?.aborted) throw new Error("Run cancelled before spawn");
  const summary: PiSummary = {
    exitCode: null, signal: null, settled: false, cancelled: false,
    protocolErrors: 0, assistantErrors: 0, events: {}, tools: {},
  };
  const child = spawn(options.executable ?? "pi", [...(options.args ?? piArgs), options.prompt], {
    cwd: options.cwd, detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  let pending = "";
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  const killGroup = (signal: NodeJS.Signals) => {
    if (!child.pid) return;
    try { process.kill(-child.pid, signal); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  const stop = () => {
    summary.cancelled = true;
    killGroup("SIGTERM");
    killTimer ??= setTimeout(() => killGroup("SIGKILL"), options.stopGraceMs ?? 2000);
  };
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
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    pending += chunk;
    let end: number;
    while ((end = pending.indexOf("\n")) >= 0) {
      line(pending.slice(0, end));
      pending = pending.slice(end + 1);
    }
    if (pending.length > 8 * 1024 * 1024) { summary.protocolErrors++; pending = ""; stop(); }
  });
  // Drain diagnostics without persisting raw sessions, paths or credentials.
  child.stderr.resume();
  options.signal?.addEventListener("abort", stop, { once: true });
  return await new Promise((resolve, reject) => {
    child.once("spawn", () => {
      try { options.onSpawn?.(child.pid!); } catch (error) { stop(); reject(error); }
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (killTimer) clearTimeout(killTimer);
      // Terminate any descendants still in the managed process group.
      killGroup("SIGKILL");
      options.signal?.removeEventListener("abort", stop);
      if (pending) summary.protocolErrors++;
      summary.exitCode = code;
      summary.signal = signal;
      resolve(summary);
    });
  });
}

export function piSucceeded(result: PiSummary): boolean {
  return result.exitCode === 0 && result.settled && !result.cancelled
    && result.protocolErrors === 0 && result.assistantErrors === 0;
}
