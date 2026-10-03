import { spawn } from "node:child_process";
import { alive, identity, trackDescendants } from "./process.ts";
import type { Descendant } from "./process.ts";

// Execution is gated until the owner persists this group's identity.
let buffer = "";
let started = false;
let child: ReturnType<typeof spawn> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let stopping = false;
let stopGraceMs = 2000;
let childEnded = false;
let exitCode = 143;
let forced = false;
const root = identity(process.pid)!;
const descendants = new Map<number, Descendant>();
function cleanup(all = false) {
  trackDescendants(root, descendants);
  for (const record of descendants.values()) {
    if ((all || record.group !== process.pid) && alive(record)) {
      try { process.kill(record.pid, "SIGKILL"); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
  }
}
function finish() {
  if (!childEnded) return;
  trackDescendants(root, descendants);
  if (descendants.size) return;
  clearInterval(tracking);
  if (timer) clearTimeout(timer);
  process.stdin.destroy();
  if (forced) process.kill(-process.pid, "SIGKILL");
  else process.exit(exitCode);
}
const tracking = setInterval(() => {
  if (childEnded || forced) cleanup(true);
  else if (stopping) cleanup();
  else trackDescendants(root, descendants);
  finish();
}, 25);
tracking.unref();
function stop() {
  if (stopping) return;
  stopping = true;
  // Pi Bash starts a separate group. Terminate observed detached descendants
  // directly rather than relying on Pi's signal handler or the main group.
  cleanup();
  if (!timer) timer = setTimeout(() => { forced = true; cleanup(true); finish(); }, stopGraceMs);
  if (child?.pid) {
    try { process.kill(-process.pid, "SIGTERM"); } catch { /* Already exited. */ }
  } else { childEnded = true; finish(); }
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
process.stdin.setEncoding("utf8");
process.stdin.on("end", stop);
process.stdin.on("data", (chunk: string) => {
  if (started) return;
  buffer += chunk;
  const end = buffer.indexOf("\n");
  if (end < 0) return;
  started = true;
  const config = JSON.parse(buffer.slice(0, end));
  stopGraceMs = config.stopGraceMs;
  buffer = "";
  child = spawn(config.file, config.args, { cwd: config.cwd, stdio: ["ignore", "inherit", "inherit"] });
  child.once("error", () => { childEnded = true; exitCode = 127; finish(); });
  child.once("exit", (code, signal) => {
    childEnded = true; exitCode = code ?? (signal ? 143 : 1);
    cleanup(true); finish();
  });
});
