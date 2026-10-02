import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { piSucceeded, runPi } from "../src/pi.ts";

async function fixture(source: string, extra: Partial<Parameters<typeof runPi>[0]> = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "daqin-pi-test-"));
  try { return await runPi({ cwd, executable: process.execPath, args: ["-e", source], prompt: "fixture", ...extra }); }
  finally { rmSync(cwd, { recursive: true }); }
}

test("settlement and successful process exit are both required", async () => {
  assert.equal(piSucceeded(await fixture('console.log(JSON.stringify({type:"agent_end"}))')), false);
  assert.equal(piSucceeded(await fixture('console.log(JSON.stringify({type:"agent_settled"}))')), true);
  assert.equal(piSucceeded(await fixture('console.log(JSON.stringify({type:"agent_settled"}));process.exitCode=1')), false);
});

test("JSONL uses LF boundaries and preserves Unicode separators inside strings", async () => {
  const result = await fixture('process.stdout.write(JSON.stringify({type:"message_end",message:{content:"a\\u2028b"}})+"\\n");console.log(JSON.stringify({type:"agent_settled"}))');
  assert.equal(result.protocolErrors, 0);
  assert.equal(piSucceeded(result), true);
});

test("invalid or truncated records and assistant errors fail completion", async () => {
  assert.equal(piSucceeded(await fixture('process.stdout.write("broken\\n")')), false);
  assert.equal(piSucceeded(await fixture('process.stdout.write(JSON.stringify({type:"agent_settled"}))')), false);
  const result = await fixture('console.log(JSON.stringify({type:"message_end",message:{role:"assistant",stopReason:"error"}}));console.log(JSON.stringify({type:"agent_settled"}))');
  assert.equal(piSucceeded(result), false);
});

test("cancellation kills a managed process that ignores SIGTERM", async () => {
  const abort = new AbortController();
  let pid = 0;
  const result = await fixture('process.on("SIGTERM",()=>{});console.log(JSON.stringify({type:"agent_start"}));setInterval(()=>{},1000)', {
    signal: abort.signal, stopGraceMs: 50, onSpawn: (value) => { pid = value; }, onEvent: () => abort.abort(),
  });
  assert.equal(result.cancelled, true);
  assert.equal(result.signal, "SIGKILL");
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
});
