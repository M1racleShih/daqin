# M2: Verify failure visibility and duplicate protection

Accepted through the operator's M0–M3 v0.1 goal on 2026-10-03.
Baseline: M1 source `0407af3` and its 14 passing local tests.

Verify duplicate start/continue, failed Pi and checks, managed stopping,
controller interruption with a potentially live executor, lost push/PR creation
responses, changed Issue/workspace/remote branches, and closed/merged PRs.
Preserve partial edits and actual evidence. Do not start a second executor,
duplicate delivery, force-push, discard unknown changes or claim human approval.

Use disposable local Git/platform/process fixtures for controlled faults and
real sandbox/Pi integration records where needed. Keep live agent tasks serial
and within their accepted scopes. No new adapters, agents or credentials.
