import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { piSucceeded, runPi } from "../src/pi.ts";
import { alive, groupAlive, identity, runManaged } from "../src/process.ts";
import type { Identity } from "../src/process.ts";

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

test("configured duration stops execution and descendants in the process group", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "daqin-limit-test-"));
  let pid = 0;
  try {
    const result = await runManaged({ cwd, file: process.execPath,
      args: ["-e", 'require("node:child_process").spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"inherit"});setInterval(()=>{},1000)'],
      timeoutMs: 150, stopGraceMs: 50, onSpawn: record => { pid = record.pid; },
    });
    assert.equal(result.cancelled, true); assert.equal(groupAlive(pid), false);
  } finally { rmSync(cwd, { recursive: true }); }
});

test("cancellation and duration limits stop detached descendants whose parents ignore SIGTERM", async () => {
  const detachedSource = `
    const child = require("node:child_process").spawn(process.execPath,
      ["-e", 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'], {stdio:"ignore"});
    process.on("SIGTERM",()=>{});console.log(child.pid);setInterval(()=>{},1000);
  `;
  const source = `
    const child = require("node:child_process").spawn(process.execPath,
      ["-e", ${JSON.stringify(detachedSource)}], {detached:true,stdio:["ignore","pipe","ignore"]});
    process.on("SIGTERM",()=>{});
    child.stdout.once("data", chunk => console.log(JSON.stringify({detached:child.pid,grandchild:Number(chunk)})));
    setInterval(()=>{},1000);
  `;
  for (const mode of ["cancel", "duration"]) {
    const abort = new AbortController();
    let detached: Identity | undefined, grandchild: Identity | undefined;
    let group = 0, pending = "";
    try {
      const result = await runManaged({ cwd: tmpdir(), file: process.execPath, args: ["-e", source],
        signal: abort.signal, timeoutMs: mode === "duration" ? 300 : 3000, stopGraceMs: 50,
        onSpawn: record => { group = record.pid; },
        stdout: chunk => {
          pending += chunk;
          if (!detached && pending.includes("\n")) {
            const pids = JSON.parse(pending.trim());
            detached = identity(pids.detached); grandchild = identity(pids.grandchild);
            if (mode === "cancel") abort.abort();
          }
        },
      });
      assert.ok(detached && grandchild, "fixture captured the detached tree before stopping");
      assert.equal(result.cancelled, true);
      assert.equal(groupAlive(group), false);
      assert.equal(alive(detached), false, `${mode}: detached child must stop before ownership is released`);
      assert.equal(alive(grandchild), false, `${mode}: detached grandchild must also stop`);
    } finally {
      if (alive(detached)) process.kill(-detached!.pid, "SIGKILL");
      if (alive(grandchild)) process.kill(grandchild!.pid, "SIGKILL");
    }
  }
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
