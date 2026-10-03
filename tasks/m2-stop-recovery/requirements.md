# M2: Preserve explicit acceptance after interrupted stopping

Accepted under the operator's continuing M0–M3 v0.1 goal on 2026-10-03.
Baseline: `0c5c0f95fd179465e56574d8c7054fc448d5335d`.

After an owner disappears, stopping managed execution must preserve the
checkout and observe its state without silently accepting intervening edits.
Continuation must require inspection and explicit acceptance of unknown dirty
changes, then rerun the accepted checks before publication.

Scope: controller stop reconciliation, the existing hard-interruption regression,
the recovery guide and this task package. Use disposable local process/Git
fixtures. Do not invoke Pi, change live task branches or publish pending code.
