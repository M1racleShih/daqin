# Detached-descendant stop repair

The new cancellation regression failed on the baseline: the main managed group
ended, but its detached child remained alive. The fixture cleaned up the captured
child without touching unrelated processes.

Stopping now reaches the Linux launcher before the main executable. The launcher
observes descendants through `/proc`, retains their PID/start/boot identities
after reparenting, and directly kills detached descendants. It sends SIGTERM
to the main group and escalates at the accepted grace period. It stays alive
until its observed descendants stop; a still-running group retains ownership.
Owner-pipe loss uses the same cleanup, including the configured grace period.

This remains trusted local execution, not daemon containment or a security
sandbox. Deliberate escape before observation or externally killing the launcher
requires manual process and checkout reconciliation. Normal Pi 1.0.0 JSON mode
also has a detached-child cleanup handler; controller stopping no longer relies
solely on that handler.

Actual checks: `npm run check` passed repository checks, strict TypeScript and
19 behavioral/failure tests. The hard-controller-kill regression now verifies a
detached child stops while unknown edits remain preserved and unaccepted. The
detached test was then strengthened to cover a child and grandchild under both
cancellation and a duration limit; it, type checking, repository checking and
`git diff --check` passed again. Other valid results were reused.

No Pi/model call, live task edit, additional agent, publication, credential
change, human acceptance or merge was performed for this repair.
