import { resolve } from "node:path";
import { piArgs, runPi } from "../src/pi.ts";

const abort = new AbortController();
let timer: ReturnType<typeof setTimeout> | undefined;
let pid: number | undefined;
const args = [...piArgs];
args[args.indexOf("--tools") + 1] = "bash";
const result = await runPi({
  cwd: resolve(process.argv[2]), args, signal: abort.signal,
  prompt: "This is the authorized M0 managed-stop probe. Make exactly one bash tool call: sleep 30. Do not read or write files, run other commands, access credentials, or launch agents. After the command returns, reply STOP_PROBE_END.",
  onSpawn: (value) => { pid = value; },
  onEvent: (type) => {
    if (type === "tool_execution_start" && !timer) timer = setTimeout(() => abort.abort(), 300);
  },
});
if (timer) clearTimeout(timer);
let groupAlive = false;
try { process.kill(-pid!, 0); groupAlive = true; } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
}
console.log(JSON.stringify({ ...result, groupAlive }));
if (!result.cancelled || !result.tools.bash || groupAlive) process.exitCode = 1;
