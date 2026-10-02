import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { Controller } from "../src/controller.ts";
import { command } from "../src/command.ts";
import { digest, validateInput } from "../src/input.ts";
import type { Input } from "../src/input.ts";
import type { Issue, PullRequest } from "../src/github.ts";
import type { runPi } from "../src/pi.ts";
import { identity } from "../src/process.ts";
import { runManaged } from "../src/process.ts";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "daqin-controller-test-"));
  const cwd = join(root, "checkout"); mkdirSync(cwd);
  const bare = join(root, "remote.git"); command("git", ["init", "--bare", bare]);
  command("git", ["init", "-b", "main"], cwd);
  command("git", ["config", "user.name", "Fixture"], cwd);
  command("git", ["config", "user.email", "fixture@example.invalid"], cwd);
  mkdirSync(join(cwd, "src")); mkdirSync(join(cwd, "test"));
  writeFileSync(join(cwd, "src/value.ts"), "export const value = 0;\n");
  writeFileSync(join(cwd, "test/value.test.ts"), 'import assert from "node:assert/strict"; import {value} from "../src/value.ts"; assert.equal(value,0);\n');
  command("git", ["add", "."], cwd); command("git", ["commit", "-m", "fixture"], cwd);
  const baseline = command("git", ["rev-parse", "HEAD"], cwd);
  command("git", ["remote", "add", "origin", "https://github.com/Fixture/repo.git"], cwd);
  command("git", ["config", `url.${bare}.insteadOf`, "https://github.com/Fixture/repo.git"], cwd);
  command("git", ["push", "origin", "main"], cwd);
  const issues = new Map<number, Issue>();
  const prs = new Map<string, PullRequest>();
  let executions = 0, publications = 0;
  const api = {
    readIssue: (_repo: string, number: number) => issues.get(number)!,
    findPr: (_repo: string, branch: string) => prs.get(branch),
    readFeedback: (_repo: string, url: string) => ({ url, body: "Use value 2", updatedAt: "2026-10-03T00:00:00Z", author: "human" }),
    publishDraft: (_repo: string, branch: string, base: string) => {
      const prior = prs.get(branch);
      const pr: PullRequest = { number: prior?.number ?? ++publications, url: `https://github.com/Fixture/repo/pull/${prior?.number ?? publications}`,
        state: "OPEN", isDraft: true, headRefOid: command("git", ["rev-parse", "HEAD"], cwd), baseRefName: base };
      prs.set(branch, pr); return pr;
    },
  };
  const pi: typeof runPi = async options => {
    executions++;
    const value = options.prompt.includes("Writable files") && options.prompt.includes("requirements-")
      && readFileSync(join(cwd, options.prompt.match(/snapshot (\S+)\./)![1]), "utf8").includes("Use value 2") ? 2 : 1;
    writeFileSync(join(cwd, "src/value.ts"), `export const value = ${value};\n`);
    writeFileSync(join(cwd, "test/value.test.ts"), `import assert from "node:assert/strict"; import {value} from "../src/value.ts"; assert.equal(value,${value});\n`);
    const snapshot = JSON.parse(readFileSync(join(cwd, options.prompt.match(/snapshot (\S+)\./)![1]), "utf8"));
    writeFileSync(join(cwd, snapshot.allowedPaths.at(-1)), "Implemented the accepted value behavior.\n");
    return { exitCode: 0, signal: null, settled: true, cancelled: false, protocolErrors: 0, assistantErrors: 0, events: { agent_settled: 1 }, tools: {} };
  };
  function input(number: number): Input {
    const issue: Issue = { number, title: `Task ${number}`, body: "Fix value", updatedAt: "2026-10-03T00:00:00Z", url: `https://github.com/Fixture/repo/issues/${number}`, state: "OPEN" };
    issues.set(number, issue);
    return { repo: "Fixture/repo", issue: number, workspace: cwd, branch: `codex/issue-${number}`, base: "main",
      startingCommit: baseline, issueUpdatedAt: issue.updatedAt, issueBodySha256: digest(issue.body), taskPath: `tasks/issue-${number}`,
      allowedPaths: ["src/value.ts", "test/value.test.ts", `tasks/issue-${number}/handoff.md`],
      checks: [{ file: process.execPath, args: ["--test", "test/value.test.ts"] }],
      pi: { provider: "fixture", model: "fixture", thinking: "medium" } };
  }
  const controller = new Controller(join(root, "state"), api, pi);
  return { root, cwd, baseline, issues, prs, api, pi, input, controller,
    counts: () => ({ executions, publications }),
    cleanup: () => { controller.close(); rmSync(root, { recursive: true }); } };
}

test("two Issues deliver serially and human feedback updates the original branch and PR", async () => {
  const f = fixture();
  try {
    const one = f.input(1); await f.controller.start(one);
    const pr = f.prs.get(one.branch)!;
    await f.controller.start(one);
    assert.equal(f.counts().executions, 1);
    const first = f.controller.store.task("Fixture/repo#1")!.lastCommit;
    await f.controller.continue("Fixture/repo#1", { feedback: pr.url + "#issuecomment-1" });
    await f.controller.continue("Fixture/repo#1", { feedback: pr.url + "#issuecomment-1" });
    assert.equal(f.counts().executions, 2);
    assert.equal(f.prs.get(one.branch)!.number, pr.number);
    assert.notEqual(f.controller.store.task("Fixture/repo#1")!.lastCommit, first);
    assert.match(readFileSync(join(f.cwd, "src/value.ts"), "utf8"), /value = 2/);
    await f.controller.start(f.input(2));
    assert.equal(f.counts().publications, 2);
    assert.equal(f.controller.store.task("Fixture/repo#2")!.status, "delivered");
    await f.controller.continue("Fixture/repo#1", { feedback: pr.url + "#issuecomment-2" });
    assert.equal(command("git", ["branch", "--show-current"], f.cwd), one.branch);
    assert.equal(f.prs.get(one.branch)!.number, pr.number);
  } finally { f.cleanup(); }
});

test("hard controller termination stops its gated executor and leaves explicit recovery ownership", async () => {
  const f = fixture();
  try {
    const input = f.input(1); input.stopGraceMs = 50;
    const config = join(f.root, "driver.json");
    const marker = join(f.root, "running");
    writeFileSync(config, JSON.stringify({ input, state: join(f.root, "state"), marker }));
    const child = spawn(process.execPath, [new URL("./fixtures/controller-driver.ts", import.meta.url).pathname, config], {
      env: { ...process.env, NODE_TEST_CONTEXT: undefined }, stdio: "ignore",
    });
    const exit = new Promise<void>(resolve => child.once("exit", () => resolve()));
    const deadline = Date.now() + 5000;
    while (!existsSync(marker) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(existsSync(marker), "managed executor started");
    child.kill("SIGKILL"); await exit;
    assert.equal(f.controller.status("Fixture/repo#1").status, "interrupted");
    await assert.rejects(f.controller.continue("Fixture/repo#1"), /owns/);
    // The launcher's owner pipe closes and it terminates its group.
    const run = f.controller.store.active()!;
    const end = Date.now() + 4000;
    while (run.process && identity(run.process.pid) && Date.now() < end) await new Promise(resolve => setTimeout(resolve, 30));
    await f.controller.stop("Fixture/repo#1");
    assert.equal(f.controller.store.active(), undefined);
    assert.equal(existsSync(f.cwd + ".daqin-lock"), false);
    assert.ok(command("git", ["status", "--porcelain"], f.cwd), "accepted snapshot preserved");
  } finally { f.cleanup(); }
});

test("explicit stopping blocks publication and keeps scope changes for inspection", async () => {
  const f = fixture();
  let spawnReady!: () => void;
  const ready = new Promise<void>(resolve => { spawnReady = resolve; });
  try {
    f.controller.executePi = async options => {
      const result = await runManaged({ cwd: options.cwd, file: process.execPath,
        args: ["-e", "setInterval(()=>{},1000)"], signal: options.signal, stopGraceMs: 50,
        onSpawn: record => { options.onSpawn?.(record.pid, record); spawnReady(); },
      });
      return { ...result, settled: false, protocolErrors: 0, assistantErrors: 0, events: {}, tools: {} };
    };
    const input = f.input(1); input.stopGraceMs = 50;
    const pending = f.controller.start(input);
    const rejection = assert.rejects(pending, /Pi failed|cancelled/);
    await ready;
    await assert.rejects(f.controller.continue("Fixture/repo#1"), /owns/);
    const another = new Controller(join(f.root, "other-state"), f.api, f.pi);
    try {
      await assert.rejects(another.start(f.input(2)), /ownership lease/);
      assert.ok(existsSync(f.cwd + ".daqin-lock"));
    } finally { another.close(); }
    await f.controller.stop("Fixture/repo#1"); await rejection;
    assert.equal(f.counts().publications, 0);
    assert.equal(f.controller.store.task("Fixture/repo#1")!.status, "stopped");
  } finally { f.cleanup(); }
});

test("unknown dirty changes remain unaccepted after repeated refused continuations", async () => {
  const f = fixture();
  try {
    await f.controller.start(f.input(1));
    writeFileSync(join(f.cwd, "src/value.ts"), "export const value = 123;\n");
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(f.controller.continue("Fixture/repo#1", { publishOnly: true }), /Workspace changes differ/);
      assert.equal(f.controller.store.task("Fixture/repo#1")!.workspaceDigest, undefined);
      assert.ok(f.controller.store.task("Fixture/repo#1")!.observedWorkspaceDigest);
    }
    assert.equal(f.counts().executions, 1);
  } finally { f.cleanup(); }
});

test("failed checks preserve changes and evidence without publishing", async () => {
  const f = fixture();
  try {
    const input = f.input(1); input.checks = [{ file: process.execPath, args: ["-e", "process.exit(4)"] }];
    await assert.rejects(f.controller.start(input), /check failed/);
    assert.equal(f.counts().publications, 0);
    const task = f.controller.store.task("Fixture/repo#1")!;
    assert.equal(task.status, "failed"); assert.ok(task.workspaceDigest);
    assert.ok(command("git", ["status", "--porcelain"], f.cwd));
    assert.equal((f.controller.store.runs(task.id)[0].result as { checks: { exitCode: number }[] }).checks[0].exitCode, 4);
    assert.equal(f.controller.store.active(), undefined);
  } finally { f.cleanup(); }
});

test("Pi failure preserves its partial edits and blocks publishing", async () => {
  const f = fixture();
  try {
    f.controller.executePi = async options => ({ ...await f.pi(options), assistantErrors: 1 });
    await assert.rejects(f.controller.start(f.input(1)), /Pi failed/);
    assert.equal(f.counts().publications, 0);
    assert.equal(f.controller.store.task("Fixture/repo#1")!.status, "failed");
    assert.ok(command("git", ["status", "--porcelain"], f.cwd));
  } finally { f.cleanup(); }
});

test("checks that mutate accepted source invalidate their results", async () => {
  const f = fixture();
  try {
    const input = f.input(1);
    input.checks = [{ file: process.execPath, args: ["-e", 'require("node:fs").writeFileSync("src/value.ts","export const value = 999;\\n")'] }];
    await assert.rejects(f.controller.start(input), /Checks changed task inputs/);
    assert.equal(f.counts().publications, 0);
  } finally { f.cleanup(); }
});

test("a lost push response preserves the commit and publish-only recovery does not rerun Pi", async () => {
  const f = fixture();
  const priorPath = process.env.PATH;
  try {
    const realGit = command("which", ["git"]);
    const marker = join(f.root, "lost-response");
    const script = `#!${process.execPath}\nimport {execFileSync} from "node:child_process";import {existsSync,writeFileSync} from "node:fs";
const args=process.argv.slice(2);const output=execFileSync(${JSON.stringify(realGit)},args,{encoding:"utf8"});process.stdout.write(output);
if(args[0]==="push"&&!existsSync(${JSON.stringify(marker)})){writeFileSync(${JSON.stringify(marker)},"lost");process.exitCode=1;}
`;
    writeFileSync(join(f.root, "git"), script, { mode: 0o755 });
    process.env.PATH = f.root + ":" + priorPath;
    const input = f.input(1);
    await assert.rejects(f.controller.start(input), /External Git/);
    const task = f.controller.store.task("Fixture/repo#1")!;
    assert.equal(f.controller.store.runs(task.id)[0].phase, "pushing");
    assert.equal(command(realGit, ["ls-remote", "origin", `refs/heads/${input.branch}`], f.cwd).split(/\s/)[0], task.lastCommit);
    await f.controller.continue(task.id, { publishOnly: true });
    assert.deepEqual(f.counts(), { executions: 1, publications: 1 });
    assert.equal(f.controller.store.task(task.id)!.status, "delivered");
  } finally { process.env.PATH = priorPath; f.cleanup(); }
});

test("out-of-scope edits and snapshot tampering block delivery", async () => {
  for (const mode of ["scope", "snapshot"]) {
    const f = fixture();
    try {
      f.controller.executePi = async options => {
        const result = await f.pi(options);
        if (mode === "scope") writeFileSync(join(f.cwd, "unapproved.txt"), "preserve me\n");
        else writeFileSync(join(f.cwd, options.prompt.match(/snapshot (\S+)\./)![1]), "{}\n");
        return result;
      };
      await assert.rejects(f.controller.start(f.input(1)), mode === "scope" ? /outside/ : /package changed/);
      assert.equal(f.counts().publications, 0);
    } finally { f.cleanup(); }
  }
});

test("Issue changes, remote branch changes and closed/merged PRs require reconciliation", async () => {
  const f = fixture();
  try {
    const input = f.input(1); await f.controller.start(input);
    const issue = f.issues.get(1)!; issue.body += " changed";
    await assert.rejects(f.controller.continue("Fixture/repo#1", { publishOnly: true }), /Issue changed/);
    issue.body = "Fix value";
    const pr = f.prs.get(input.branch)!;
    pr.state = "MERGED";
    assert.equal(f.controller.status("Fixture/repo#1").status, "merged");
    await assert.rejects(f.controller.continue("Fixture/repo#1", { publishOnly: true }), /PR is ended/);
    pr.state = "CLOSED";
    assert.equal(f.controller.status("Fixture/repo#1").status, "closed");
    pr.state = "OPEN";
    command("git", ["push", "origin", `${f.baseline}:refs/heads/${input.branch}`, "--force"], f.cwd);
    await assert.rejects(f.controller.continue("Fixture/repo#1", { publishOnly: true }), /Remote task head changed/);
  } finally { f.cleanup(); }
});

test("SQLite rejects a second owner, including after controller interruption", async () => {
  const f = fixture();
  try {
    const input = f.input(1); await f.controller.start(input);
    const task = f.controller.store.task("Fixture/repo#1")!;
    const dead = { pid: 2147483647, start: "0", boot: "fixture" };
    const run = f.controller.store.claim(task, dead, false)!;
    assert.equal(f.controller.status(task.id).status, "interrupted");
    assert.throws(() => f.controller.store.claim(task, identity(process.pid)!, false), /owns/);
    await assert.rejects(f.controller.continue(task.id, { publishOnly: true }), /owns/);
    await f.controller.stop(task.id);
    assert.equal(f.controller.store.active(), undefined);
    assert.equal(f.controller.store.task(task.id)!.status, "stopped");
    assert.ok(run.id);
  } finally { f.cleanup(); }
});

test("path traversal and agent-write access to immutable package fields are rejected", () => {
  const f = fixture();
  try {
    const input = f.input(1);
    assert.throws(() => validateInput({ ...input, allowedPaths: ["../outside"] }), /Invalid/);
    assert.throws(() => validateInput({ ...input, allowedPaths: [...input.allowedPaths, "tasks/issue-1/requirements.json"] }), /handoff/);
  } finally { f.cleanup(); }
});
