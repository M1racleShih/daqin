# Contributing

Daqin is preparing its first implementation. Start from an Issue with a
concrete goal, scope, dependencies and observable acceptance criteria.
Discuss architectural changes before adding a framework or adapter.

## Local checks

Run `python3 scripts/check_repository.py` or `make check`. No product runtime
or model credentials are needed for the bootstrap checks. CI runs the same
command on main and on pull requests. These are repository checks, not an
end-to-end claim about agent coordination.

## Skills

Install dskills separately, then run `dskills sync --project .` to restore
the pinned manager skill. Version 0.1.0 was used for the bootstrap. If a
pinned version is unavailable, restore that version from its recorded source
instead of silently upgrading it. Use `dskills doctor --project .` to inspect
the local installation. Skills are optional for contributors running checks.

Keep `.dynamic-skills/config.json` and `.dynamic-skills/lock.json` under Git.
Generated copies, runtime ownership records and history stay local. Prefer
reading a specialist skill on demand to permanently selecting a large pack.

## Pull requests

Use an isolated branch and worktree for concurrent work. Describe the user
problem, resulting behavior, linked Issue and relevant validation. Include
documentation with the behavior it describes. Review the complete diff for
credentials, machine-specific configuration and unrelated changes.

AI review must identify the reviewed commit and distinguish findings from a
human's final approval. New commits require revalidation of affected checks.
A maintainer performs the final merge.

Original contributions are submitted under the MIT License. Check third-party
licenses before introducing source, assets or dependencies, and preserve
required notices. Use English for repository-facing material.
