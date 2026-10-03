# M2: Verify repaired stopping with Pi

Accepted under the operator's continuing M0–M3 v0.1 goal on 2026-10-03.
Controller source: `7cc94a8fe27c4755017cfec8c8b480047850bb70`.

The Linux stopping implementation changed after the earlier real Pi probes.
Verify the repaired behavior using the existing Pi 1.0.0 provider/model and
dedicated M0 sandbox clone. This is serial verification, not a new product task
or another agent. The clone must be clean and have no active managed run.

Allow one noninteractive Pi invocation with only Bash and only `sleep 30`.
No file reads/writes, implementation edits, publications or credential changes.
Observe the detached descendant identities before cancellation, then confirm
the root group and those observed descendants have stopped. Keep only a concise
result and task package; do not save raw sessions or machine paths.
