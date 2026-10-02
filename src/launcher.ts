import { spawn } from "node:child_process";

// Execution is gated until the owner persists this group's identity.
let buffer = "";
let started = false;
let child: ReturnType<typeof spawn> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  if (!timer) timer = setTimeout(() => process.kill(-process.pid, "SIGKILL"), 2000);
  if (child?.pid) {
    try { process.kill(-process.pid, "SIGTERM"); } catch { /* Already exited. */ }
  } else process.exitCode = 143;
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
  buffer = "";
  child = spawn(config.file, config.args, { cwd: config.cwd, stdio: ["ignore", "inherit", "inherit"] });
  child.once("error", () => { process.exitCode = 127; process.stdin.destroy(); if (timer) clearTimeout(timer); });
  child.once("exit", (code, signal) => {
    if (timer && !stopping) clearTimeout(timer);
    process.stdin.destroy();
    process.exitCode = code ?? (signal ? 143 : 1);
  });
});
