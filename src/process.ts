import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

export type Identity = { pid: number; start: string; boot: string };

export function identity(pid: number): Identity | undefined {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
    if (["Z", "X"].includes(fields[0])) return;
    return { pid, start: fields[19], boot: readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim() };
  } catch (error) {
    if (["ENOENT", "ESRCH"].includes((error as NodeJS.ErrnoException).code!)) return;
    throw error;
  }
}

export function alive(record?: Identity): boolean {
  if (!record) return false;
  const current = identity(record.pid);
  return current?.start === record.start && current?.boot === record.boot;
}

export function groupAlive(pid: number): boolean {
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = readFileSync(`/proc/${name}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      if (Number(fields[2]) === pid && !["Z", "X"].includes(fields[0])) return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return false;
}

export function signalGroup(record: Identity, signal: NodeJS.Signals): void {
  if (!alive(record)) {
    if (groupAlive(record.pid)) throw new Error("Unverified orphan process group; manual reconciliation required");
    return;
  }
  process.kill(-record.pid, signal);
}

export async function runManaged(options: {
  cwd: string; file: string; args: string[]; signal?: AbortSignal;
  stopGraceMs?: number; timeoutMs?: number; onSpawn?: (record: Identity) => void;
  stdout?: (chunk: string) => void; stderr?: (chunk: string) => void;
}) {
  if (process.platform !== "linux") throw new Error("Managed execution requires Linux");
  if (options.signal?.aborted) throw new Error("Run cancelled before spawn");
  const child = spawn(process.execPath, [new URL("./launcher.ts", import.meta.url).pathname], {
    detached: true, stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  });
  let killTimer: ReturnType<typeof setTimeout> | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  const kill = (signal: NodeJS.Signals) => {
    if (!child.pid) return;
    try { process.kill(-child.pid, signal); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  const stop = () => {
    cancelled = true; kill("SIGTERM");
    killTimer ??= setTimeout(() => kill("SIGKILL"), options.stopGraceMs ?? 2000);
  };
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => options.stdout?.(chunk));
  child.stderr.on("data", (chunk: string) => options.stderr?.(chunk));
  child.stdin.on("error", () => {});
  options.signal?.addEventListener("abort", stop, { once: true });
  return await new Promise<{ exitCode: number | null; signal: string | null; cancelled: boolean }>((resolve, reject) => {
    child.once("spawn", () => {
      try {
        const record = identity(child.pid!);
        if (!record) throw new Error("Managed process identity unavailable");
        options.onSpawn?.(record);
        if (options.signal?.aborted) { stop(); return; }
        child.stdin.write(JSON.stringify({ file: options.file, args: options.args, cwd: options.cwd }) + "\n");
        if (options.timeoutMs) timeoutTimer = setTimeout(stop, options.timeoutMs);
      } catch (error) { stop(); reject(error); }
    });
    child.once("error", reject);
    child.once("close", (exitCode, signal) => {
      if (killTimer) clearTimeout(killTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      kill("SIGKILL");
      child.stdin.destroy();
      options.signal?.removeEventListener("abort", stop);
      resolve({ exitCode, signal, cancelled });
    });
  });
}
