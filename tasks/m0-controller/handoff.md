# M0 controller experiment delivery

The experiment completed a real sandbox task with one noninteractive Pi 1.0.0
using the existing MiMo v2.6 Pro Coding Plan on Node.js 24.18.0 and Linux.
One dedicated clone was reused after checking its clean state and exact baseline.

The controller checked the accepted Issue version and hash, saved its snapshot,
started Pi, consumed JSONL without persisting a raw session, checked settlement
and process exit, verified writable paths and actual code changes, independently
ran checks, committed the task package and code, pushed the branch, and confirmed
the Draft PR source commit. The source commit is
`31bbf4b068e995774816ce2702a9f761d09a5306`; the integration baseline is
`a75eabbd9b998ef7bf55df97cbb8278916a9253a`.

Actual checks: 10 sandbox behavior tests passed; all six accepted examples
passed `git check-ref-format --branch`; `git diff --check` passed. No remote
CI was configured. No separate TypeScript type check was run.

A second serial Pi invocation tested stopping only: its sole tool call was
`sleep 30`, with no file writes. The controller cancelled the run after the tool
started. Result: cancelled=true, exitCode=143, settled=false, and the managed
process group no longer existed. Four local process/protocol tests also passed.

The experimental input, clone preparation and publication recovery are still
partly manual. The M0 entry point has no persistent task ownership and must not
be used for unattended retries. M1 will replace it with explicit start, status,
stop and continue operations backed by SQLite. Human acceptance and merge are
pending; neither the agent's completion nor the Draft PR represents approval.
