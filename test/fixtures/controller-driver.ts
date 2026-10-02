import { readFileSync, writeFileSync } from "node:fs";
import { Controller } from "../../src/controller.ts";
import { runPi } from "../../src/pi.ts";
import { digest } from "../../src/input.ts";

const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
const input = config.input;
const issue = { number: input.issue, title: "Task", body: "Fix value", updatedAt: input.issueUpdatedAt,
  url: `https://github.com/${input.repo}/issues/${input.issue}`, state: "OPEN" };
if (digest(issue.body) !== input.issueBodySha256) throw new Error("Fixture hash differs");
const api = {
  readIssue: () => issue,
  findPr: () => undefined,
  readFeedback: () => { throw new Error("Unexpected feedback read"); },
  publishDraft: () => { throw new Error("Unexpected publication"); },
};
const controller = new Controller(config.state, api, options => runPi({ ...options,
  executable: process.execPath, args: ["-e", 'console.log(JSON.stringify({type:"agent_start"}));setInterval(()=>{},1000)'],
  onEvent: type => { if (type === "agent_start") writeFileSync(config.marker, "started\n"); },
}));
try { await controller.start(input); } finally { controller.close(); }
