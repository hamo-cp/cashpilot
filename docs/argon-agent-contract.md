# Argon 4 Operating Contract — Cashpilot Android

Status: **Do not begin implementation until the preflight gate in Issue #5 is complete.**  
Repository: `hamo-cp/cashpilot`  
Authoritative Android issue: [Issue #3](https://github.com/hamo-cp/cashpilot/issues/3)  
Repository hygiene gate: [Issue #5](https://github.com/hamo-cp/cashpilot/issues/5)  
Reference baseline: `master` at `5bf83ffc2f12ec5509cdbdb7f453a2dc1454f493`

## 1. Branch and Git boundaries

- The only permitted implementation branch is `mobile/android-capacitor`.
- Base it on the explicitly verified baseline SHA above unless the repository owner approves a newer baseline in writing.
- Never commit directly to `master`.
- Never push to `master`, change the default branch, rewrite protected history, force-push, or merge any PR.
- Do not work on `android/capacitor-baseline`, `copilot/androidcapacitor-baseline-implement-proof-of-conce`, or the audit branch unless the owner explicitly changes this contract.
- Open exactly one draft PR from `mobile/android-capacitor` to `master` only after the owner confirms the branch-protection policy and CI baseline. If the owner chooses a staged development base instead, the owner must update this contract first.
- Do not create another Android issue, another competing implementation branch, or another Android PR. Issue #3 is the single authoritative Android work item. Issue #5 is a prerequisite gate, not a second Android implementation task.
- At session start, run `git status --short --branch`, `git branch --show-current`, `git remote -v`, and inspect `git log -5 --oneline --decorate`. Confirm the exact HEAD SHA and branch before editing.
- Before every push, verify the destination branch and inspect `git diff --stat` and `git diff --check`. Push only the permitted feature branch.

## 2. Protected files and prohibited changes

Do not modify these paths without explicit owner approval recorded in Issue #3:
- `.github/workflows/**` — CI, deployment, permissions, and workflow triggers.
- `docs/operations.md` — production operations and external Cloudflare redirect details.
- `README.md` deployment/release sections.
- `wrangler.toml`, Cloudflare configuration, Pages configuration, environment settings, or any deployment-related configuration if such files are present.
- release tags, GitHub Releases, production environment settings, secrets, repository permissions, rulesets, or webhooks.

Never add, print, commit, or upload credentials, private keys, signing keys, tokens, `.env` files, or real financial data.

Do not change financial calculations, import/restore semantics, storage schemas, authentication/privacy behavior, PWA routing, or the existing product architecture merely to make an Android build easier. If a change to core financial logic or data format appears unavoidable, stop and explain the reason and migration/rollback strategy before implementation.

Normal APK CI work must create debug artifacts only. It must not sign with a production key, create a GitHub Release, publish to Play, or deploy Cloudflare Pages.

## 3. Scope

Transform the existing vanilla JavaScript/HTML/CSS PWA into an installable Android application with the smallest justified architectural change, evaluating Capacitor first.

Preserve:
- Web/PWA behavior.
- Financial calculations and regression behavior.
- Arabic RTL and English UI.
- Local-first privacy and offline startup.
- In-app backup and restore.
- Empty/default data on the first Android installation (no browser localStorage migration).
- Existing Android data when installing a subsequent APK update.

## 4. Required evidence gates

Before editing:
1. Verify the baseline SHA and run the existing tests against an unmodified worktree.
2. Record tool versions, exact commands, exit codes, and errors.
3. Inspect the current repository's actual files, issue state, branches, pull requests, and CI. Treat historical PR descriptions as unverified until files exist.
4. Confirm the baseline CI result is successful and complete, not cancelled, pending, or based on a different source tree.

During implementation:
1. Work in small commits with focused tests.
2. Run `npm test`, `npm run test:security`, and `npm run test:browser` as applicable to actual scripts.
3. Add a reproducible debug APK build and upload APK plus build logs as CI artifacts.
4. Record all CI run IDs and commit SHAs.
5. Distinguish tests run locally, in CI, on emulator, and on a real device.

Before asking for review:
- Confirm the remote feature branch contains the implementation commit(s).
- Confirm GitHub shows the actual changed files in the PR.
- Confirm existing regression/browser checks are successful.
- Confirm the Android build step ran and the expected APK artifact exists.
- Record APK SHA-256 and build provenance.
- List acceptance criteria not yet verified, especially Android 14, offline behavior, backup/restore, upgrade data preservation, notification/file handling, storage protection, and Arabic/English phone layouts.
- Leave the PR in Draft. Do not merge.

## 5. Mandatory stop conditions

Stop work immediately, do not guess, and report the exact blocker if:
- The checked-out branch is not `mobile/android-capacitor`.
- Baseline SHA or worktree state differs from the approved baseline unexpectedly.
- A push is rejected, permissions are missing, or a repository rule blocks the operation. Never bypass controls or leak credentials.
- Any operation would touch `master`, release tags, a production deployment, or protected files without written approval.
- CI results are missing, cancelled, or fail without a clear diagnosed cause.
- Android packaging appears to require a destructive storage/data change, core financial logic change, major framework rewrite, paid service, production secret, or material privacy trade-off.
- A build cannot be reproduced, dependency integrity is uncertain, secrets are detected, or financial correctness is not demonstrated.
- An earlier agent/worktree appears active or contains uncommitted work that cannot be safely attributed.

When stopping, do not overwrite/reset/delete unrecognized work. Report the exact command, error, current branch, HEAD SHA, worktree status, attempted action, and safest next step.

## 6. Session checkpoint format

At each checkpoint append to `docs/android-progress.md` on the feature branch:
- Phase and timestamp.
- Branch and full HEAD SHA.
- Files changed.
- Commands run and exit codes.
- CI run IDs and outcomes.
- APK path, SHA-256, and whether emulator/real-device testing occurred.
- Known limitations, blockers, and a single next action.

Keep source-of-truth facts in GitHub. Do not rely on chat memory or unpushed local changes.

## 7. Owner authorization

The owner retains control over:
- Branch protection and rulesets.
- Choosing/approving any different baseline or work branch.
- Editing protected paths.
- Merging a PR.
- Production deployment and release publication.
- Paid usage and production signing.

No completion claim is valid without GitHub-visible commits/files and matching test/build evidence.
