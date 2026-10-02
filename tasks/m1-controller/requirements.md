# M1: Repeatable local GitHub and Pi operations

Accepted through the operator's M0–M3 v0.1 goal on 2026-10-03.
Development baseline: `0d927a023028fc24b1bd28175295ec336c0d7808`.

Provide explicit local start, status, stop and continue commands on Linux with
TypeScript, Node.js and SQLite. Save accepted Issue inputs, task/check snapshots,
branch, checkout, process identities, run outcomes and Draft PR addresses.
Use one active writer, preserve unknown changes, and allow serial reuse of a
dedicated product clone only after state checks. Keep Daqin development serial
in its existing checkout; do not add an adapter/workflow framework or agents.

Checks must verify actual changes and accepted paths. Human-selected feedback
updates the same task branch and PR. Query platform merge/close facts and refuse
execution on ended deliveries. Failed/cancelled/interrupted runs preserve state.
Configured durations are enforced; retries require explicit operations.

Acceptance needs two independent real Issues and a real human-feedback update
of one PR. Local fixtures supplement those records. Reliability fixtures cover
duplicate starts/continues, failed checks/Pi, stopping, interrupted ownership,
uncertain publication, changed accepted inputs and closed/merged PRs. Fixtures
cannot substitute for the operator's acceptance and final merge.
