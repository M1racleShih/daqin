# Local controller implementation

Four explicit foreground operations now manage accepted GitHub Issues using one
noninteractive Pi and a dedicated checkout. SQLite stores task/run ownership,
snapshots, check outcomes and publication facts; a checkout lease prevents
another state directory from becoming a second writer.

The Linux launcher waits for persisted process identity before executing and
stops its group when the controller disappears. Normal failure/cancellation
preserves the checkout and evidence. Continuation restores and validates the
saved branch, snapshots, Issue version, remote source/base, dirty-change digest,
residual data and PR status. Publication reuses one Draft PR and reconciles a
lost creation response. No automatic retry, merge or deployment was added.

Actual validation on Node.js 24.18.0/Linux: `npm run check` passed repository
checks, strict TypeScript checking and 14 behavioral/failure tests. Fixtures use
disposable Git repositories and simulated platform/Pi responses. Covered flows
include two serial Issues, feedback updating one PR, duplicate operations,
failed checks, scope/snapshot violations, stop, hard controller termination,
changed Issue/remote branch, PR closure/merge and lost creation responses.
The updated launcher also passed a real Pi `sleep 30` cancellation probe;
the managed group no longer existed.

These fixtures do not constitute M1–M3 acceptance. M1 still needs real distinct
Issue deliveries and a real human-feedback update through the controller.
M2 needs its final coverage/evidence review. M3 needs the selected real task,
actual project checks, human acceptance and human-performed merge. No v0.1
release is claimed. See `docs/controller.md` for supported operations and limits.
