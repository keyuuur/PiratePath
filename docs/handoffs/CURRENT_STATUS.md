# Pirate Path V2 Current Status

Last verified: 2026-07-16

## Current posture

- Branch: `overhaul/phaser-v2`
- Base commit: `8981dc7`
- Worktree: isolated sibling of the original legacy checkout
- Local implementation: complete and verified for handoff
- V2 deployment: not created
- Live legacy deployment: intentionally unchanged and still available as rollback
- Push, pull request, merge, and production deployment: not performed

## Implemented experience

- Join and classroom-code entry, mission briefing, three guided missions, readiness transition, five assessment missions, three rapid probes, response review, final confirmation, and results.
- Guided practice includes retry feedback, hints, worked routes, vector placement, route planning, Undo, Clear, Replay, Pause, Step, and 2x speed.
- Phaser renders maps and route motion while accessible React controls own all required input.
- Assessment drafts remain neutral. Quantitative review values and item correctness appear only after confirmed submission.
- Touch targets, cardinal wording, synchronized route descriptions, reduced motion, default-muted sound, keyboard-operable controls, and responsive portrait/landscape layouts are implemented.
- Four-hour local recovery uses an absolute attempt-start expiry, startup sweeping across all Pirate Path keys, and an in-tab expiry timer.

## Implemented backend and Sheets workflow

- Session validation, attempt start/resume, neutral checkpoint upsert, canonical submission, deterministic variants, score recomputation, mastery gates, and idempotent retry handling.
- HMAC-signed Apps Script bridge with timestamp, nonce, replay rejection, document locking, and no browser-held administrative capability.
- Additive Sessions, AttemptRegistry, AttemptAudit, GameResults, RoundResponses, and Dashboard behavior.
- Teacher menu actions for setup/refresh, create session, close session, audited reset, and dashboard refresh.
- The V2 Apps Script browser page is static and cannot accept scores or answers; the old public submission function is private and disabled in current V2 source.
- Formula-prefixed strings are neutralized at shared append, update, attempt-dashboard, summary-dashboard, and misconception-dashboard write boundaries.

## Verification evidence

Latest automated run:

- `npm run verify`: passed
- Lint: passed with Apps Script host-callback unused warnings only
- Vitest: 12 files, 64 tests passed
- TypeScript project build: passed
- Vite production build: passed
- `npm audit --audit-level=high`: 0 vulnerabilities
- Apps Script V8 syntax check: passed

Automated browser runs:

- Chromebook 1366x768: guided-practice smoke passed in 3.1 seconds; complete 11-mission reduced-motion demo voyage passed in 10.1 seconds.
- iPad portrait emulation: join-to-practice smoke, synchronized route text, 48-pixel visible-button check, and horizontal-overflow check passed in 3.4 seconds. A keyboard-only join at 200% root text size passed in 1.4 seconds.
- iPad landscape emulation: join-to-practice smoke, synchronized route text, 48-pixel visible-button check, and horizontal-overflow check passed in 3.6 seconds.
- The full voyage intentionally runs once on Chromebook; the iPad projects run responsive smoke coverage to avoid duplicate WebGL stress on the Windows development machine.

Boundary checks:

- Production bundle contains no `correctOptionId`, assessment scoring engine, mastery-cap reason, teacher ClassPoints cue, or assessment mission banks.
- Practice-only worked-route material remains in the client by design.
- Independent reviewers confirmed that live assessment mission objects contain no `answer` field and that post-submit review is generated from the server-bound variant.
- Independent Apps Script review confirmed only `onOpen`, `doPost`, and `doGet` remain browser-public and all dynamic dashboard cell arrays pass through the literal-value sanitizer.

## Preservation evidence

- Original checkout began on `codex/full-refactor-2026-05-03` with only untracked `AGENTS.md` and `KEYUR_WORKFLOW.md`.
- Baseline hashes to recheck before any handoff:
  - `AGENTS.md`: `9741B5D0FAE7F5A929D9F9CF0437C99871009383B02AE86A49A7F73A627FC66A`
  - `KEYUR_WORKFLOW.md`: `D39C3BE309EF2447BA32AFF710C9B8CF09B0AB38A552117677E1CFFD40BC6ABE`
- Local preservation tags:
  - `legacy/apps-script-main-8981dc7`
  - `legacy/pirate-lab-ui-273c52d`
  - `legacy/apps-script-refactor-1910a2b`

## Known residual risk

The currently live legacy deployment remains byte-for-byte unchanged so it can serve as rollback. It therefore retains the original client-side answer/scoring model and anonymous Apps Script submission boundary. The V2 source does not retain those browser mutation paths. Given the classroom threat model and explicit rollback requirement, this is accepted temporarily, but the legacy deployment should not be treated as the secure long-term canonical assessment path.

## External release gates still required

1. Configure a staging Apps Script project and Vercel preview with real server-only secrets.
2. Click-test every teacher menu action in a copy of the production Sheet.
3. Send synthetic start, checkpoint, submit, identical retry, conflicting retry, and teacher-reset flows; verify exactly one canonical result and correct audit/detail rows.
4. Confirm platform logs redact names and raw responses.
5. Run touch, keyboard, 200% zoom, VoiceOver, reduced-motion, reload, Safari tab-eviction, slow-network, and temporary-offline checks on a physical school iPad.
6. Pilot with 5-10 students and confirm a 15-18 minute median, at least 95% completion within 20 minutes, and teacher dashboard usability.
7. Promote the already-tested deployment, then merge through review. Keep the legacy URL available through the first complete classroom unit.

## Do not assume

- Browser emulation is not a physical-iPad pass.
- A Vercel build is not a verified Sheets submission.
- Local contract tests do not prove live Apps Script menu authorization or Sheet permissions.
- Public routes are intentionally observable and mathematically solvable; the protection is against shipped answer keys and pre-submit answer objects, not against doing the science.
