import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Controller } from "./controller.ts";

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  state: { type: "string", default: ".daqin" }, adopt: { type: "boolean" },
  feedback: { type: "string" }, "publish-only": { type: "boolean" },
  "accept-issue-version": { type: "string" }, "accept-issue-hash": { type: "string" },
  "accept-head": { type: "string" }, "accept-dirty": { type: "string" }, "accept-base": { type: "string" },
} });
const [operation, argument] = positionals;
if (!["start", "status", "stop", "continue"].includes(operation)) {
  console.error("Usage: node src/cli.ts start INPUT.json | status [REPO#ISSUE] | stop REPO#ISSUE | continue REPO#ISSUE --feedback COMMENT_URL [--state DIR]");
  process.exitCode = 1;
} else {
  const controller = new Controller(values.state!);
  try {
    let result;
    if (operation === "start") result = await controller.start(JSON.parse(readFileSync(argument, "utf8")), { adopt: values.adopt });
    else if (operation === "status") result = controller.status(argument);
    else if (operation === "stop") result = await controller.stop(argument);
    else result = await controller.continue(argument, {
      feedback: values.feedback, publishOnly: values["publish-only"],
      acceptIssueVersion: values["accept-issue-version"], acceptIssueHash: values["accept-issue-hash"],
      acceptHead: values["accept-head"], acceptDirty: values["accept-dirty"], acceptBase: values["accept-base"],
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Operation failed"); process.exitCode = 1;
  } finally { controller.close(); }
}
