# Local controller (pre-release)

Use Linux, Node.js 24.18+, Git, authenticated GitHub CLI and Pi 1.0.0.
Install development dependencies with `npm ci`; run `npm run check` to check
documents, TypeScript and local behavioral/failure fixtures. There are no
production npm dependencies. SQLite uses Node's built-in `node:sqlite`.

The controller currently runs one task at a time per state directory and takes
a checkout lease shared across state directories. This implementation scope
does not impose a universal agent count or task duration. Trusted local execution
and prompts are not a security sandbox. The operator accepts requirements and
scope, selects feedback and performs the final merge.

## Accepted input

Keep the JSON input and SQLite state in ignored `.daqin/` or another private
local directory. Do not commit credentials, local paths, raw sessions or state.

Required fields:

| Field | Meaning |
| --- | --- |
| `repo`, `issue` | GitHub owner/repository and positive safe integer Issue number |
| `workspace` | Absolute dedicated clone path, outside the Daqin development checkout |
| `branch`, `base` | One new `codex/` task branch and its target branch |
| `startingCommit` | Exact full SHA of the accepted remote base |
| `issueUpdatedAt`, `issueBodySha256` | Accepted Issue version and SHA-256 of its body |
| `taskPath` | Unique task package directory under `tasks/` |
| `allowedPaths` | Exact writable files, including `taskPath/handoff.md` |
| `checks` | Nonempty array of `{file, args}` commands, independently run by the controller |
| `pi` | Explicit `{provider, model, thinking}` using existing credentials |

Optional `pi.timeoutMs` and per-check `timeoutMs` enforce operator-configured
durations. `stopGraceMs` controls escalation after cancellation. No task duration,
cost budget or repair count is imposed by default. The controller does not
automatically retry failed tasks. Existing Pi provider retry settings still apply.

Pi can write only the task handoff within the package. Accepted requirement and
check records are controller-owned and checked against saved copies. Commands
and snapshots must be suitable for the target repository's visibility.

## Explicit operations

```sh
npm run daqin -- start .daqin/accepted-input.json
npm run daqin -- status 'OWNER/REPO#ISSUE'
npm run daqin -- stop 'OWNER/REPO#ISSUE'
npm run daqin -- continue 'OWNER/REPO#ISSUE' --feedback 'COMMENT_URL'
```

Pass `--state DIR` consistently to use another state directory. `start` is
foreground; another terminal can query or stop it. A duplicate start returns the
saved task. Concurrent starts/continues are rejected by SQLite and the checkout
lease. An already-delivered feedback version returns the existing delivery.
Discussion alone never starts work. Only an explicitly selected top-level
Issue/PR comment is accepted as feedback; controller output is excluded.

The controller creates a dedicated clone when its path does not exist. Serial
reuse requires a clean checkout, matching origin and baseline, and inspection
of residual `.pi/` and `.daqin/` data. It restores the saved task branch on
continuation only when the current branch has no unpreserved changes. It never
resets, cleans, force-pushes or discards unknown files.

States distinguish running, stopping, interrupted, failed, stopped, awaiting
human action, merged and closed. Status queries verify GitHub facts. A process
exit, successful check or Draft PR is not human acceptance.

## Recovery

Failures preserve the checkout, saved requirements, actual run/check outcomes
and process identities. A gated Linux launcher starts Pi/checks only after its
identity is saved; losing the controller's pipe terminates its process group.
An interrupted record keeps ownership until explicit `stop` reconciles it.
PID start time and boot identity prevent signalling an unrelated reused PID.
Unknown process groups or another state's lease require human reconciliation.

After inspecting changes, use explicit `continue`. Changes matching the saved
failure digest remain available. Unknown dirty changes require `--accept-dirty
SHA256`; changed source commits require `--accept-head SHA`; changed target
baselines require manual integration and `--accept-base SHA`. Changed Issues
require both `--accept-issue-version TIMESTAMP` and `--accept-issue-hash SHA256`.
These acceptances do not broaden writable paths or change configured checks.

After a publication failure, `continue --publish-only` reruns the accepted
checks and reconciles the remote branch and existing PR without invoking Pi.
PR creation with a lost response queries once; an unconfirmed outcome remains
uncertain. Do not manually create another PR as a shortcut.

`start INPUT.json --adopt` records the prepared M0 delivery only when the
checkout is clean, its saved snapshot matches the input, and one open Draft PR
matches the source commit. Adoption does not claim a new agent run or new checks.

GitHub Actions and branch protections belong to the target project. The
controller publishes local check evidence but does not bypass protections,
mark a PR ready, approve its own work or merge. Full v0.1 acceptance still
requires the real M0–M3 records and a human-accepted, human-merged real task.
