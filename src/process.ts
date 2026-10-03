import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

export type Identity = { pid: number; start: string; boot: string };
export type Descendant = Identity & { group: number };

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

// Follow live ancestry and retain already observed descendants after reparenting.
// PID/start/boot checks keep a reused PID out of the managed tree.
export function trackDescendants(root: Identity, tracked: Map<number, Descendant>): void {
  const processes = new Map<number, Descendant & { parent: number }>();
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = readFileSync(`/proc/${name}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      if (!["Z", "X"].includes(fields[0])) processes.set(Number(name), {
        pid: Number(name), start: fields[19], boot: root.boot,
        parent: Number(fields[1]), group: Number(fields[2]),
      });
    } catch (error) {
      if (!["ENOENT", "ESRCH"].includes((error as NodeJS.ErrnoException).code!)) throw error;
    }
  }
  const parents = new Set<number>();
  if (alive(root)) parents.add(root.pid);
  for (const [pid, prior] of tracked) {
    const current = processes.get(pid);
    if (current?.start === prior.start && alive(prior)) {
      tracked.set(pid, current); parents.add(pid);
    } else tracked.delete(pid);
  }
  let added = true;
  while (added) {
    added = false;
    for (const current of processes.values()) {
      if (current.pid !== root.pid && !parents.has(current.pid)
          && (parents.has(current.parent) || (parents.has(root.pid) && current.group === root.pid))) {
        tracked.set(current.pid, current); parents.add(current.pid); added = true;
      }
    }
  }
}

export function requestManagedStop(record: Identity): void {
  if (!alive(record)) {
    if (groupAlive(record.pid)) throw new Error("Unverified orphan process group; manual reconciliation required");
    return;
  }
  // Capture detached children before their parents receive the group signal.
  try { process.kill(record.pid, "SIGTERM"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
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
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  const kill = (signal: NodeJS.Signals) => {
    if (!child.pid) return;
    try { process.kill(-child.pid, signal); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  const stop = () => {
    cancelled = true;
    if (child.pid) {
      try { process.kill(child.pid, "SIGTERM"); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
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
        child.stdin.write(JSON.stringify({ file: options.file, args: options.args, cwd: options.cwd,
          stopGraceMs: options.stopGraceMs ?? 2000 }) + "\n");
        if (options.timeoutMs) timeoutTimer = setTimeout(stop, options.timeoutMs);
      } catch (error) { stop(); reject(error); }
    });
    child.once("error", reject);
    child.once("close", (exitCode, signal) => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      kill("SIGKILL");
      child.stdin.destroy();
      options.signal?.removeEventListener("abort", stop);
      resolve({ exitCode, signal, cancelled });
    });
  });
}
