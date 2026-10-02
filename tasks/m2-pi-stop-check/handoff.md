# Real Pi stop verification

Verified controller source: `7cc94a8fe27c4755017cfec8c8b480047850bb70`.
The dedicated M0 clone remained on source
`31bbf4b068e995774816ce2702a9f761d09a5306` and its accepted task branch,
with a clean checkout before and after verification.

Pi 1.0.0 used the existing `xiaomi-token-plan-cn/mimo-v2.6-pro` provider/model,
medium thinking, noninteractive JSON mode and no session persistence. Only Bash
was enabled; the accepted prompt allowed only `sleep 30`. The result recorded
one Bash call. Before cancellation, `/proc` observation captured two descendants,
including one in a detached group. After cancellation, neither the root group
nor either captured descendant remained alive.

Actual result: cancelled=true, exitCode=143, signal=null, settled=false,
protocolErrors=0 and assistantErrors=0. This is successful stop evidence,
not successful task completion. No source edits, PR changes or human merge
occurred, and no raw session or machine-specific process identities were saved
in this package.

Two initial sandbox startup attempts exited before any tool call because Pi
could not create its existing settings lock on the read-only filesystem.
Executable/version checks confirmed Pi 1.0.0; the same narrow probe then ran
with tool-approved access for Pi's existing local runtime lock. These failed
startup attempts are not counted as successful stop evidence.

The code was unchanged from the verified repair: reuse its 19 passing
behavior/failure tests, strict type check and strengthened detached-tree test.
Repository checks and `git diff --check` also passed for this evidence package.
