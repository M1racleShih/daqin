# Contributing

Daqin is validating its first usable release. Start from an approved task
with a concrete goal, scope, dependencies and observable acceptance criteria.
Link an Issue when one is used. A human and one agent is a complete product mode;
custom roles and optional workflows must not require a fixed team structure.
Use [ROADMAP.md](ROADMAP.md) to keep work within the current milestone.
Use Mermaid diagrams for architecture, flows and states when they clarify the
behavior; distinguish planned capabilities from implemented ones.
The selected product stack is TypeScript, Node.js and SQLite. Discuss
architectural changes before adding a framework or adapter.

## Local checks

Run `npm ci` and `make check` for document checks, TypeScript checking and
local behavioral/failure fixtures. These checks use disposable local fixtures
and do not need model credentials or production access. CI runs them on main
and pull requests. Real Pi/GitHub evidence remains separate.

## Skills

Install dskills separately, then run `dskills sync --project .` to restore
the pinned manager skill. Version 0.1.0 was used for the bootstrap. If a
pinned version is unavailable, restore that version from its recorded source
instead of silently upgrading it. Use `dskills doctor --project .` to inspect
the local installation. Skills are optional for contributors running checks.

Keep `.dynamic-skills/config.json` and `.dynamic-skills/lock.json` under Git.
Generated skill copies, local execution records and history stay local. Prefer
reading a specialist skill on demand to permanently selecting a large pack.

## Pull requests

For the M0–M3 development effort, reuse the existing checkout serially and use
one `codex/` branch per task. Keep one active writer; the controller developer
and Pi must not edit the same checkout concurrently. Before switching tasks or
branches, stop managed processes, commit or preserve changes, and verify the
target branch, starting commit and residual run data. Do not discard unknown
changes with reset, clean or file replacement. This exception applies to
Daqin's own development only and does not expand Pi permissions.

Product tasks use a dedicated checkout. v0.1 may serially reuse one dedicated
clone after state checks before reassignment; continuation restores and verifies
the original task branch.

Use an isolated branch and worktree for concurrent work. Describe the user
problem, resulting behavior, linked Issue and relevant validation. Include
documentation with the behavior it describes. Review the complete diff for
credentials, machine-specific configuration and unrelated changes.

AI review must identify the reviewed commit and distinguish findings from a
human's final approval. Rerun affected checks when new commits change the reviewed code.
A maintainer performs the final merge.

Original contributions are submitted under the MIT License. Check third-party
licenses before introducing source, assets or dependencies, and preserve
required notices. Use English for repository-facing material.
