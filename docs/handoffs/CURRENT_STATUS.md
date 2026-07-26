# Pirate Path V2 Current Status

Last verified: 2026-07-26

## Current posture

- Branch: `overhaul/phaser-v2`
- Base commit: `8981dc7`
- Latest published implementation checkpoint: `4dfd0d4`
- Worktree: isolated sibling of the original legacy checkout
- Local implementation: functional V2 plus a verified settings-label polish; the larger visual update is still in its selection stage
- V2 deployment: not created
- Live legacy deployment: intentionally unchanged and still available as rollback
- GitHub branch: published at `origin/overhaul/phaser-v2`
- Draft pull request: [#1, Phaser V2 classroom game overhaul](https://github.com/keyuuur/PiratePath/pull/1)
- Merge and production deployment: not performed

## Implemented experience

- Join and classroom-code entry, mission briefing, three guided missions, readiness transition, five assessment missions, three rapid probes, response review, final confirmation, and results.
- Guided practice includes retry feedback, hints, worked routes, vector placement, route planning, Undo, Clear, Replay, Pause, Step, and 2x speed.
- Phaser renders maps and route motion while accessible React controls own all required input.
- Assessment drafts remain neutral. Quantitative review values and item correctness appear only after confirmed submission.
- Touch targets, cardinal wording, synchronized route descriptions, reduced motion, default-muted sound, keyboard-operable controls, and responsive portrait/landscape layouts are implemented.
- Four-hour local recovery uses an absolute attempt-start expiry, startup sweeping across all Pirate Path keys, and an in-tab expiry timer.
- The two settings controls now have one visible label each (`Muted`/`Sound on` and `Reduced motion`/`Motion on`) while preserving their pressed state and behavior.

## Locked remedial-classroom clarification

- Students will not use the Pythagorean theorem or calculate a hypotenuse.
- Student movement is fully accessible through two-dimensional vertical and horizontal steps: North, East, South, and West, one grid interval at a time.
- Every completed guided or assessed displacement is horizontal, vertical, or zero. Diagonal completed vectors are invalid content.
- Students report an integer displacement magnitude and North, East, South, West, or no direction. `0 m` has no direction.
- During both guided practice and scored A1-A5 missions, the completed dashed blue displacement vector must display an integer magnitude label such as `3 m`.
- That label is a scaffold, not an answer control: it must not auto-fill the magnitude field, select a direction, reveal correctness, or remove the requirement that the student identify displacement and submit magnitude plus direction.
- The traveled path remains unnumbered so students still calculate distance.
- In vector-placement practice, the magnitude appears only after start and finish are connected.
- This displacement-label scaffold is approved but is **not yet implemented** in the current product checkpoint.

The current scenario banks already use cardinal movement and horizontal, vertical, or zero final displacement. Scenario validation rejects diagonal assessed endpoints, route-display math refuses a completed student-facing diagonal vector, and unit tests cover the boundary. `src/domain/motion.ts` retains generic Euclidean analysis only so invalid diagonal content can be detected and rejected; it does not authorize diagonal student work.

## UI update handoff

The `$ui-update` workflow is paused after baseline review and six visual-direction explorations. No direction has been selected, so none of the generated images is an approved screen blueprint and no broad visual redesign has been applied.

- Recommended base direction from the review: Direction D, “Navigation Science Studio.”
- Possible accents after selection: Direction F's game energy or Direction A's warmth.
- All six generated directions contain invented controls, measurements, wording, or diagonal vectors. Treat them as style references only; product behavior and science come from the repository and the locked rules above.
- The next UI step is user selection of a direction, followed by four controlled refinements. Do not skip the selection gate.
- Local same-machine workflow record: `C:\Users\Keyur\Documents\Codex\2026-07-15\i-want-to-go-back-to\ui-update-runs\piratepath-v2-20260720\RUN_MANIFEST.md`

Generated style-reference images:

- A: `C:\Users\Keyur\.codex\generated_images\019f6796-e91e-7491-8aa6-a76d5e0ca99c\exec-401db739-d107-46db-b3c9-270ae2f0fd88.png`
- B: `C:\Users\Keyur\.codex\generated_images\019f6796-e91e-7491-8aa6-a76d5e0ca99c\exec-84453dce-684e-4d62-9a92-3a53e662b3d0.png`
- C: `C:\Users\Keyur\.codex\generated_images\019f6796-e91e-7491-8aa6-a76d5e0ca99c\exec-ba941d5b-6fce-4626-9bea-21389a00f65c.png`
- D: `C:\Users\Keyur\.codex\generated_images\019f6796-e91e-7491-8aa6-a76d5e0ca99c\exec-6c08e6fb-df8d-4ac0-a46f-31756d8fa763.png`
- E: `C:\Users\Keyur\.codex\generated_images\019f6796-e91e-7491-8aa6-a76d5e0ca99c\exec-41427141-f35e-465d-96e3-1925c96e8aab.png`
- F: `C:\Users\Keyur\.codex\generated_images\019f6796-e91e-7491-8aa6-a76d5e0ca99c\exec-4d4db5eb-9d9c-4e26-bb23-d35cdc5812b5.png`

## Implemented backend and Sheets workflow

- Session validation, attempt start/resume, neutral checkpoint upsert, canonical submission, deterministic variants, score recomputation, mastery gates, and idempotent retry handling.
- HMAC-signed Apps Script bridge with timestamp, nonce, replay rejection, document locking, and no browser-held administrative capability.
- Additive Sessions, AttemptRegistry, AttemptAudit, GameResults, RoundResponses, and Dashboard behavior.
- Teacher menu actions for setup/refresh, create session, close session, audited reset, and dashboard refresh.
- The V2 Apps Script browser page is static and cannot accept scores or answers; the old public submission function is private and disabled in current V2 source.
- Formula-prefixed strings are neutralized at shared append, update, attempt-dashboard, summary-dashboard, and misconception-dashboard write boundaries.

## Verification evidence

Latest automated run before the settings-label polish:

- `npm run verify`: passed
- Lint: passed with Apps Script host-callback unused warnings only
- Vitest: 12 files, 64 tests passed
- TypeScript project build: passed
- Vite production build: passed
- `npm audit --audit-level=high`: 0 vulnerabilities
- Apps Script V8 syntax check: passed

Settings-label polish verification on 2026-07-26:

- `npm run verify`: passed
- Lint: passed with existing Apps Script host-callback unused warnings only
- Vitest: 12 files, 65 tests passed
- TypeScript and Vite production build: passed with the normal Phaser chunk-size advisory
- `git diff --check`: passed
- Representative browser closeout: iPad portrait join-to-practice passed, iPad landscape join-to-practice passed, and the complete Chromebook demo voyage passed

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
- The original checkout guidance files were re-hashed on 2026-07-26 and remain byte-identical to the baseline values above.

## Known residual risk

The currently live legacy deployment remains byte-for-byte unchanged so it can serve as rollback. It therefore retains the original client-side answer/scoring model and anonymous Apps Script submission boundary. The V2 source does not retain those browser mutation paths. Given the classroom threat model and explicit rollback requirement, this is accepted temporarily, but the legacy deployment should not be treated as the secure long-term canonical assessment path.

The ignored `apps-script/.clasp.json` in the V2 worktree points to the same Apps Script project as the legacy checkout. It is not a separate V2 staging target. Do not run `clasp push` from the V2 worktree against that project: doing so would replace the rollback project's editable source and may affect any deployment configured to follow HEAD. Create or explicitly identify a separate staging Apps Script project first.

## External release gates still required

1. Create or identify a separate staging Apps Script project, link V2 to it, and configure a Vercel preview with real server-only secrets.
2. Click-test every teacher menu action in a copy of the production Sheet.
3. Send synthetic start, checkpoint, submit, identical retry, conflicting retry, and teacher-reset flows; verify exactly one canonical result and correct audit/detail rows.
4. Confirm platform logs redact names and raw responses.
5. Run touch, keyboard, 200% zoom, VoiceOver, reduced-motion, reload, Safari tab-eviction, slow-network, and temporary-offline checks on a physical school iPad.
6. Pilot with 5-10 students and confirm a 15-18 minute median, at least 95% completion within 20 minutes, and teacher dashboard usability.
7. Promote the already-tested deployment, then merge through review. Keep the legacy URL available through the first complete classroom unit.

## Do not assume

- Browser emulation is not a physical-iPad pass.
- A Vercel build is not a verified Sheets submission.
- The existing `.clasp.json` is not evidence of a safe V2 staging target; it is linked to the legacy rollback project.
- Local contract tests do not prove live Apps Script menu authorization or Sheet permissions.
- Public routes are intentionally observable and mathematically solvable; the protection is against shipped answer keys and pre-submit answer objects, not against doing the science.
