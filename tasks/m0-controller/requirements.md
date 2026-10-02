# M0: GitHub and Pi delivery experiment

Accepted on 2026-10-03 through the operator's explicit M0–M3 v0.1 goal.
Development baseline: `6cf45cec44aa85b6e09b9a8510051f7223ba2c4b`.

Use TypeScript and Node.js on Linux to run the prepared sandbox Issue through
one noninteractive Pi, verify actual changes and checks, commit the accepted
task package, push one task branch and publish a Draft PR. Verify JSON completion
and managed stopping. The operator performs acceptance and final merge.

Keep Git, GitHub and Pi responsibilities small and separate. M0 uses no
framework, additional execution adapter, workflow engine or SQLite state store.
SQLite task ownership follows after successful M0 integration.

Daqin development reuses its existing checkout serially. Product execution
uses a dedicated sandbox clone, which may be reused serially after state checks.
One active writer owns each checkout. Do not expand Pi's accepted task scope,
writable paths, agent count, credentials or provider purchases.

Evidence: accepted Issue snapshot and baseline, Pi actual code changes,
controller-run checks, source commit, Draft PR metadata and managed-stop result.
Fixture tests and documentation checks supplement real integration evidence.
