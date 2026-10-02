import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { command } from "./command.ts";
import { execFileSync } from "node:child_process";
import { digest, safePath } from "./input.ts";
import type { Input } from "./input.ts";
import type { Task, Run } from "./store.ts";

export function canonicalWorkspace(path: string): string {
  if (existsSync(path)) return realpathSync(path);
  return join(realpathSync(dirname(path)), path.slice(dirname(path).length + 1));
}
export function acquireLease(task: Task, run: Run, state: string) {
  const path = `${task.input.workspace}.daqin-lock`;
  const lease = JSON.stringify({ state, run: run.id, controller: run.controller });
  try { mkdirSync(path, { mode: 0o700 }); }
  catch { throw new Error("Dedicated checkout has an existing ownership lease; reconcile through its original state directory"); }
  writeFileSync(join(path, "owner.json"), lease + "\n", { mode: 0o600 });
  return () => {
    if (readFileSync(join(path, "owner.json"), "utf8") !== lease + "\n") throw new Error("Ownership lease changed; preserve it");
    unlinkSync(join(path, "owner.json")); rmdirSync(path);
  };
}
export function releaseStaleLease(task: Task, run: Run, state: string) {
  const path = `${task.input.workspace}.daqin-lock`;
  if (!existsSync(path)) return;
  const record = JSON.parse(readFileSync(join(path, "owner.json"), "utf8"));
  if (record.state !== state || record.run !== run.id) throw new Error("Cannot release another run's lease");
  unlinkSync(join(path, "owner.json")); rmdirSync(path);
}
export function prepareWorkspace(input: Input) {
  const cwd = input.workspace;
  if (!existsSync(cwd)) command("git", ["clone", `https://github.com/${input.repo}.git`, cwd]);
  verifyClone(input);
  command("git", ["check-ref-format", "--branch", input.branch]);
  command("git", ["check-ref-format", "--branch", input.base]);
  if (command("git", ["status", "--porcelain", "--untracked-files=all"], cwd)) throw new Error("Checkout has unpreserved changes; commit or preserve them before assignment");
  verifyResidualData(input);
  command("git", ["fetch", "origin", input.base], cwd);
  const baseline = command("git", ["rev-parse", "FETCH_HEAD"], cwd);
  if (baseline !== input.startingCommit) throw new Error("Remote base differs from accepted starting commit");
  const branches = command("git", ["for-each-ref", "--format=%(refname)", `refs/heads/${input.branch}`], cwd);
  if (branches) throw new Error("Task branch already exists; import or continue the known task instead");
  if (command("git", ["ls-remote", "origin", `refs/heads/${input.branch}`], cwd)) throw new Error("Remote task branch already exists; explicit reconciliation required");
  command("git", ["switch", "-c", input.branch, input.startingCommit], cwd);
}
export function verifyClone(input: Input) {
  const cwd = input.workspace;
  if (!existsSync(join(cwd, ".git")) || !lstatSync(join(cwd, ".git")).isDirectory()) throw new Error("Expected a dedicated ordinary Git clone");
  const origin = command("git", ["config", "--get", "remote.origin.url"], cwd);
  if (![ `https://github.com/${input.repo}.git`, `https://github.com/${input.repo}`, `git@github.com:${input.repo}.git` ].includes(origin)) {
    throw new Error("Checkout origin differs from accepted repository");
  }
}
export function verifyResidualData(input: Input) {
  for (const name of [".pi", ".daqin"]) {
    if (existsSync(join(input.workspace, name)) && readdirSync(join(input.workspace, name)).length) {
      throw new Error("Residual agent/controller data requires inspection before assignment or continuation");
    }
  }
}
export function changedPaths(cwd: string): string[] {
  return [...new Set([
    ...execFileSync("git", ["diff", "--name-only", "-z", "HEAD"], { cwd, encoding: "utf8" }).split("\0"),
    ...execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd, encoding: "utf8" }).split("\0"),
  ].filter(Boolean))];
}
export function auditPaths(input: Input, paths: string[], controllerPaths: string[]) {
  for (const path of paths) {
    if (!safePath(path) || ![...input.allowedPaths, ...controllerPaths].includes(path)) throw new Error("Changes include a path outside the accepted scope");
    let current = input.workspace;
    for (const component of path.split("/")) {
      current = join(current, component);
      if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error("Task path contains a symbolic link");
    }
    const absolute = join(input.workspace, path);
    if (existsSync(absolute)) {
      if (lstatSync(absolute).isSymbolicLink() || !lstatSync(absolute).isFile()) throw new Error("Writable task paths must be ordinary files");
      const rel = relative(realpathSync(input.workspace), realpathSync(absolute));
      if (rel.startsWith("..") || resolve(absolute) === input.workspace) throw new Error("Writable task path escapes checkout");
    }
  }
}
export function verifySnapshots(task: Task) {
  for (const [path, content] of Object.entries(task.snapshots)) {
    if (!existsSync(join(task.input.workspace, path)) || readFileSync(join(task.input.workspace, path), "utf8") !== content) {
      throw new Error("Saved task package changed; human reconciliation required");
    }
  }
}
export function workspaceDigest(input: Input): string {
  const parts = [command("git", ["rev-parse", "HEAD"], input.workspace), command("git", ["diff", "--binary", "HEAD"], input.workspace)];
  for (const path of changedPaths(input.workspace).sort()) {
    parts.push(path);
    if (existsSync(join(input.workspace, path))) parts.push(digest(readFileSync(join(input.workspace, path))));
  }
  return digest(parts.join("\0"));
}
