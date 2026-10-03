import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { publishDraft } from "../src/github.ts";

test("a lost PR creation response is reconciled without creating a second PR", () => {
  const root = mkdtempSync(join(tmpdir(), "daqin-gh-test-"));
  const priorPath = process.env.PATH;
  try {
    const statePath = join(root, "state.json");
    writeFileSync(statePath, JSON.stringify({ creates: 0, prs: [], confirm: true }));
    const script = `#!${process.execPath}\nimport {readFileSync,writeFileSync} from "node:fs";
const path=${JSON.stringify(statePath)};const state=JSON.parse(readFileSync(path,"utf8"));
const args=process.argv.slice(2);
if(args[1]==="list")console.log(JSON.stringify(state.prs));
if(args[1]==="create"){state.creates++;if(state.confirm)state.prs=[{number:3,url:"https://github.com/Fixture/repo/pull/3",state:"OPEN",isDraft:true,headRefOid:"fixture",baseRefName:"main"}];writeFileSync(path,JSON.stringify(state));process.exitCode=1;}
`;
    writeFileSync(join(root, "gh"), script, { mode: 0o755 });
    process.env.PATH = root + ":" + priorPath;
    const body = join(root, "body.md"); writeFileSync(body, "fixture\n");
    assert.equal(publishDraft("Fixture/repo", "codex/task", "main", "Task", body).number, 3);
    publishDraft("Fixture/repo", "codex/task", "main", "Task", body);
    assert.equal(JSON.parse(readFileSync(statePath, "utf8")).creates, 1);
    writeFileSync(statePath, JSON.stringify({ creates: 0, prs: [], confirm: false }));
    assert.throws(() => publishDraft("Fixture/repo", "codex/task", "main", "Task", body), /uncertain/);
    assert.equal(JSON.parse(readFileSync(statePath, "utf8")).creates, 1);
  } finally { process.env.PATH = priorPath; rmSync(root, { recursive: true }); }
});
