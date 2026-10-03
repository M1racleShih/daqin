# Interrupted-stop recovery fix

A regression reproduced the bug on the baseline: after a controller was killed
and another editor changed an allowed source file, `stop` stored the observed
digest as accepted failure evidence. That allowed continuation to skip the
explicit dirty-change checkpoint.

Interrupted stopping now saves only `observedWorkspaceDigest`, retaining any
previously accepted digest. The hard-kill fixture confirms that the process
group stops, the lease is released and edits remain, while continuation refuses
unaccepted changes. Explicit digest acceptance then reruns the configured check;
its intentional failure blocks publication. No changes are discarded.

This is local M2 repair work. No Pi invocation, credential change, live task
branch update, public push or human approval/merge was performed.

Actual checks: the new assertion failed on the baseline, then the targeted
hard-termination regression passed after the fix. `npm run check` passed all
18 cases, strict TypeScript checking and repository checks. After making the
fixture's intentional check failure quiet, the affected regression, type check,
repository check and `git diff --check` passed again; unaffected results were reused.
