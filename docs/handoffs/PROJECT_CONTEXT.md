# Pirate Path V2 Project Context

## Purpose and audience

Pirate Path is a solo, iPad-first formative learning game for ninth-grade science. A representative student should finish in 15-18 minutes, with a 20-minute classroom ceiling. The game teaches students to:

- total the complete traveled path as distance;
- compare start and finish to determine displacement;
- report displacement as magnitude plus North, East, South, West, or no direction;
- recognize that returning to the start produces `0 m` displacement but can have nonzero distance; and
- compare routes with equal displacement and different distances.

## Locked learning design

The required sequence is:

`Join -> Briefing -> G1-G3 guided practice -> A1-A5 assessment -> C1-C3 rapid check -> Review -> Final submission -> Results`

- Guided practice is required, unscored, retry-friendly, and gives a targeted hint after the first error and a worked example after the second.
- The assessment is worth 20 points. Responses remain editable until final confirmation, and correctness is withheld until the canonical result is stored.
- V2 uses integer meters and cardinal or zero displacement. Diagonal displacement, speed, velocity, multiplayer, and direct ClassPoints integration are out of scope.
- One grid interval is `1 m`. Distance is the sum of every segment. Displacement magnitude uses Euclidean magnitude, never the legacy Manhattan calculation.
- Mastery tiers are 18-20, 16-17, 14-15, 10-13, and 0-9, with the approved direction and C3 gates.
- The teacher-only ClassPoints recommendation equals the final mastery tier.

## Architecture boundaries

- React and a typed reducer own the student flow, responses, settings, persistence, and submission state.
- Phaser owns the route map, adjacent-node input, path rendering, pirate movement, obstacles, and displacement overlays. It never owns scoring or canonical state.
- Public assessment content contains prompts, boards, routes, and options but no authored scoring keys, explanations, or worked solutions.
- Vercel Functions validate sessions, issue opaque tokens, choose deterministic variants, recompute scores, and return review data only after successful persistence.
- Apps Script is the only Google Sheets writer. Vercel signs bridge requests with HMAC; the browser never receives the bridge secret, Sheet ID, or teacher operations.
- The session code is classroom submission control, not identity authentication. Normalized name plus class period remains the V2 identity convention.
- Local recovery stores no raw name or teacher code and expires four hours after the attempt start.

## Data and classroom operations

- Existing Sheets tabs and historical rows are preserved. V2 changes are additive.
- One canonical attempt is allowed per teacher session and normalized student key.
- Identical final retries are idempotent. A changed payload after successful submission conflicts.
- Teacher reset invalidates rather than deletes, requires a reason, and allows exactly one replacement attempt.
- No third-party analytics or student-identifiable log payloads are allowed.
- The student result never displays the teacher-only ClassPoints recommendation.

## Legacy references and trust boundary

- `legacy/apps-script-main-8981dc7`: original default-branch baseline.
- `legacy/pirate-lab-ui-273c52d`: pirate-lab visual checkpoint.
- `legacy/apps-script-refactor-1910a2b`: latest legacy maintenance checkpoint.
- `PiratePath_GPT55Pro_Review_Handoff.md` in the legacy refactor tag is historical reference only; it is not current operational truth.
- The V2 branch keeps Apps Script source under `apps-script/`; the tags preserve exact historical source.
- The existing live legacy deployment remains unchanged as the rollback version. Its original browser-side scoring and anonymous write trust model are not suitable as the long-term canonical formative-assessment path. Retire it after V2 completes its first classroom unit.

## Reconsideration triggers

Reopen these decisions only if the curriculum adds diagonal vectors, authenticated student identity becomes required, ClassPoints exposes an approved integration, or physical-iPad evidence shows the interaction model cannot meet the 20-minute ceiling.
