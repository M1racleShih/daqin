<p align="center">
  <img src="assets/daqin-mark.png" width="160" alt="Daqin seal: paths converging around a central mark">
</p>

# Daqin

**Your agents. Your workflow. Built on Git.**

Daqin is a Git-native development project for one coding agent or a team.
It is being built to connect approved tasks, isolated branches and code review
through GitHub and GitLab. You choose the participants and workflow.

Daqin means “Great Qin,” inspired by the Qin dynasty's unification and shared
standards. The goal is to let different agents work together with shared task and
delivery rules while preserving each tool's native capabilities.

> **Status: pre-release implementation.** M0 has real delivery and stop evidence.
> The local controller is implemented; M1–M3 acceptance and v0.1 release remain
> pending. See the [controller guide](docs/controller.md) for current operations.

## Work your way

The initial target is a human and one Pi agent working through GitHub:

1. The human gives a task and confirms its scope.
2. The selected agent works in an isolated branch and records its delivery.
3. The human checks the result and performs the final merge.

Planning agents, parallel contributors, automated review and full team workflows
are optional. Roles are user-defined: Planner, Worker and Reviewer are examples,
not required participant types. A single-agent run does not need a team template.

Issues, comments, pull requests, merge requests and CI can carry collaboration
and evidence. Configured checks and platform protections still apply. When
independent agent review is enabled, it must use independent context and identify
the reviewed version; a human can also review directly.

## First useful release

Start with one GitHub Issue, one noninteractive Pi agent and one isolated task
branch. You start the run locally. GitHub holds the task, feedback and a draft pull
request (Draft PR) with the actual check results. After leaving feedback, you
explicitly continue the task to update the same PR. The human performs the merge.

```mermaid
flowchart LR
  I[GitHub Issue] --> L[Explicit local start]
  L --> P[Pi in an isolated workspace]
  P --> D[Task package, code and checks]
  D --> M[Draft PR]
  M --> H[Human review and merge]
```

The [Roadmap](ROADMAP.md) moves through a real integration experiment,
repeatable delivery, basic failure handling and a useful real-project task.
M0 has produced a verified Draft PR and actual checks. The complete M0–M3
acceptance gate, including human feedback and merge, remains pending.

## Design boundaries

- Save the accepted requirements and delivery notes in a task package.
  Commit it on the task branch and keep it after merging. Keep raw sessions and credentials out of the delivery.
- Use one active writer per task. Record failures, stop managed execution,
  and check the workspace, process and platform before retrying after an
  interruption or an uncertain publish result.
  A process exit or an agent's claim is not acceptance evidence.
- Use explicit operations to start, stop and continue. Natural-language
  discussion does not trigger work. Platform comment commands come later.
- Use the operator's existing platform account for the prototype and label
  automated posts. Account sharing does not enforce human/agent separation.
- Use trusted local execution and the existing development environment.
  Worktree isolation is not a security sandbox.
- Use TypeScript, Node.js and SQLite, initially on Linux. Begin with serial
  tasks and keep deployment paths configurable. There are no universal team
  sizes, task time limits or repair-round caps.
- Add GitLab once the GitHub workflow is familiar and useful. Codex
  collaboration, parallel work, native TUI and optional Herdr follow actual
  needs. Claude Code, Kimi Code and standalone local Git are later candidates.
  Preserve user-defined roles and optional workflows as capabilities grow.
- Leave final merging to a human. Automatic merging, production deployment
  and distributed scheduling are outside the initial scope.

## Development setup

### M0 experiment

The experimental entry point is `npm run m0 -- INPUT.json` on Linux with
Node.js 24.18+, Git, authenticated GitHub CLI and Pi 1.0.0. It expects a prepared,
clean dedicated checkout on the accepted task branch. It records the Issue
snapshot, runs one Pi, independently checks changes, commits the task package
and publishes a Draft PR. It is not the repeatable v0.1 controller.

The local input specifies `repo`, `issue`, `workspace`, `branch`, `base`,
`startingCommit`, `issueUpdatedAt`, `issueBodySha256`, `taskPath`, exact
`allowedPaths` and `checks` (executable plus argument array). Store machine paths
and execution input under the ignored `.daqin/` directory. Review the accepted
Issue and allowed paths before running. Signals stop Pi's Linux process group;
failures preserve the checkout for inspection. Do not rerun blindly after a
failure or uncertain publication. This trusted local mode is not a sandbox.

Run `npm test` for local process/protocol fixtures. M0 integration requires a
real sandbox Issue, Pi execution and independently confirmed Draft PR.

The controller uses TypeScript, Node.js 24.18+ and built-in SQLite on Linux.
GitHub operations use the authenticated GitHub CLI; Pi 1.0.0 runs noninteractively.
Python 3.10+ checks repository documents and configuration.
Use `npm ci` followed by `npm run check`; see the [controller guide](docs/controller.md).

```sh
git clone git@github.com:M1racleShih/daqin.git
cd daqin
python3 scripts/check_repository.py
```

With dskills installed (bootstrap verified with version 0.1.0):

```sh
dskills sync --project .
dskills --json status --project .
dskills doctor --project .
```

Only the `dynamic-skills` manager is selected initially. The selected skills and their exact
versions are tracked; generated skill copies and local state are ignored. Read
specialist skills on demand and add a project pin only for recurring needs.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the collaboration workflow and
[AGENTS.md](AGENTS.md) for agent instructions.

## License and identity

Original project materials are provided under the [MIT License](LICENSE).
Third-party integrations must retain their own notices and license terms.
The logo and its creation brief are in [assets](assets/README.md).
