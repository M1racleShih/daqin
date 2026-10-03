# Failure verification

The local suite verifies two serial tasks and same-PR feedback, duplicate
start/continue, cross-state checkout ownership, failed Pi/checks, actual process
stopping, hard controller termination, configured duration/descendant stopping,
lost push and PR-creation responses, changed Issue/remote branches, unknown dirty
changes, immutable-package/scope violations and merged/closed PR facts.

Fault inspection found that a refused unknown-dirty continuation could otherwise
save its observed digest as accepted failure evidence. Observed and accepted
digests are now separate; repeated refusal cannot silently authorize changes.

Fixtures are disposable local Git repositories, simulated GitHub responses and
Node executors. The real Pi sleep probe additionally confirmed that the current
Linux launcher stops its group. No production task was used for fault injection,
and no credentials, sessions, additional agents or platform permissions were added.

Full acceptance still requires real delivery records and human feedback/merge.
The code and fixture results do not represent human approval of v0.1.
