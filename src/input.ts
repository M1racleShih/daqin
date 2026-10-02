import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import type { Issue } from "./github.ts";

export type Check = { file: string; args: string[]; timeoutMs?: number };
export type Input = {
  repo: string; issue: number; workspace: string; branch: string; base: string;
  startingCommit: string; issueUpdatedAt: string; issueBodySha256: string;
  taskPath: string; allowedPaths: string[]; checks: Check[];
  pi: { provider: string; model: string; thinking: string; timeoutMs?: number };
  stopGraceMs?: number;
};
export function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
export function safePath(path: unknown): path is string {
  return typeof path === "string" && path.length > 0 && !isAbsolute(path)
    && !path.includes("\\") && !/[\0\r\n]/.test(path)
    && !path.split("/").some(part => ["", ".", "..", ".git", ".daqin"].includes(part));
}
export function validateInput(value: unknown): Input {
  const input = value as Input;
  if (!input || !/^[\w.-]+\/[\w.-]+$/.test(input.repo)
      || !Number.isSafeInteger(input.issue) || input.issue <= 0
      || typeof input.workspace !== "string" || !isAbsolute(input.workspace)
      || !safePath(input.branch) || !input.branch.startsWith("codex/")
      || !safePath(input.base) || !/^[0-9a-f]{40}$/.test(input.startingCommit)
      || typeof input.issueUpdatedAt !== "string" || !/^[0-9a-f]{64}$/.test(input.issueBodySha256)
      || !safePath(input.taskPath) || !input.taskPath.startsWith("tasks/")
      || !Array.isArray(input.allowedPaths) || input.allowedPaths.length === 0
      || !input.allowedPaths.every(safePath) || new Set(input.allowedPaths).size !== input.allowedPaths.length
      || !Array.isArray(input.checks) || input.checks.length === 0
      || !input.checks.every(check => typeof check.file === "string" && check.file.length > 0
        && Array.isArray(check.args) && check.args.every(arg => typeof arg === "string"))
      || !input.pi || ![input.pi.provider, input.pi.model, input.pi.thinking].every(v => typeof v === "string" && v.length > 0)) {
    throw new Error("Invalid accepted input; see docs/controller.md");
  }
  if (!input.allowedPaths.includes(`${input.taskPath}/handoff.md`)
      || input.allowedPaths.some(path => path.startsWith(input.taskPath + "/") && path !== `${input.taskPath}/handoff.md`)) {
    throw new Error("Only the task handoff may be writable by Pi within its package");
  }
  for (const value of [input.stopGraceMs, input.pi.timeoutMs, ...input.checks.map(check => check.timeoutMs)]) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647)) {
      throw new Error("Configured durations must be positive safe timer values in milliseconds");
    }
  }
  return { ...input, workspace: resolve(input.workspace) };
}
export function verifyIssue(input: Input, issue: Issue) {
  if (issue.state !== "OPEN" || issue.updatedAt !== input.issueUpdatedAt || digest(issue.body) !== input.issueBodySha256) {
    throw new Error("Issue changed from accepted version; explicit acceptance required");
  }
}
export function taskId(input: Input) { return `${input.repo}#${input.issue}`; }
