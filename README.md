# Pirate Path V2

Pirate Path is a solo, iPad-first ninth-grade science game about distance, displacement magnitude, and cardinal direction. Students complete three required guided missions before a 20-point formative assessment.

## Stack

- Vite, React, and TypeScript
- Phaser for the route world and pirate movement
- Accessible HTML for identity, answers, progress, review, and results
- Vercel Functions for session and attempt APIs
- Google Apps Script as the only Google Sheets writer

## Local demo

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

The example environment enables the classroom-safe demo flow. Demo completion is explicitly unscored, stays on the device, and never writes student information externally.

## Verification

```powershell
npm run verify
npm run test:e2e
npm audit --audit-level=high
```

The current verified state and remaining physical-device/live-Sheets gates are recorded in [CURRENT_STATUS.md](docs/handoffs/CURRENT_STATUS.md). Stable product and architecture decisions are recorded in [PROJECT_CONTEXT.md](docs/handoffs/PROJECT_CONTEXT.md).

## Deployment boundary

The live legacy Apps Script deployment remains the temporary rollback version. Do not promote V2 to the classroom until the staging Sheet, synthetic-submission, privacy-log, and physical-school-iPad gates in `docs/handoffs/CURRENT_STATUS.md` are complete.
