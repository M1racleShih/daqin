# M2: Stop observed detached descendants

Accepted under the operator's continuing M0–M3 v0.1 goal on 2026-10-03.
Baseline: `7c2753726282354d97207b830bebe9165d96fa0e`.

A disposable Node fixture reproduced an independent process group surviving
managed cancellation when its parent ignored SIGTERM. Pi 1.0.0 Bash also uses
detached groups; its normal cleanup handler alone is insufficient evidence for
controller stopping and interruption handling.

The Linux launcher must terminate observed detached descendants on stopping
and owner-pipe loss, verify identities before signalling, and retain ownership
until observed execution stops. Preserve the existing immutable requirements
and dirty-change acceptance gates. Keep this trusted local mode's limits explicit.

Scope: managed process/launcher stopping, controller stop waiting, disposable
process and hard-interruption fixtures, recovery documentation and this package.
Reuse the development checkout serially on `codex/m2-detached-stop`. No Pi
invocation, live task edits, additional agents, credential changes or publication.
