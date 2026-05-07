# Internal Documentation

Working notes, deployment guides, status reports, and design history for the EchoKit project.

> The top-level `docs/` folder (one level up) contains the **public-facing website** (HTML pages: index, pricing, FAQ, privacy, etc.). This `internal/` folder is for project documentation meant for contributors.

Project-root files that intentionally stay at the root:
- [`../../README.md`](../../README.md) — project README
- [`../../TODO.md`](../../TODO.md) — living roadmap

## deployment/

Deployment guides, CI/CD setup, and verification reports.

- [`deployment/DEPLOYMENT_GUIDE.md`](deployment/DEPLOYMENT_GUIDE.md) — step-by-step v1.6.0 deployment guide (worker, npm, Chrome Web Store)
- [`deployment/DEPLOY_NOW.md`](deployment/DEPLOY_NOW.md) — fast-path "do this next" deployment checklist
- [`deployment/DEPLOYMENT_VERIFICATION_RESULTS.md`](deployment/DEPLOYMENT_VERIFICATION_RESULTS.md) — verification run log + results
- [`deployment/CHROME_PUBLISHING_CICD_SETUP.md`](deployment/CHROME_PUBLISHING_CICD_SETUP.md) — Chrome Web Store auto-publishing pipeline setup

## status/

Roadmap snapshots and progress reports.

- [`status/P0_STATUS_AND_NEXT_STEPS.md`](status/P0_STATUS_AND_NEXT_STEPS.md) — P0 ship-blocker status report
- [`status/WHATS_REMAINING.md`](status/WHATS_REMAINING.md) — current remaining work, P0–P3 summary
- [`status/COMPLETED_P1_FEATURES.md`](status/COMPLETED_P1_FEATURES.md) — log of completed P1 features
- [`status/UX_IMPLEMENTATION_COMPLETE.md`](status/UX_IMPLEMENTATION_COMPLETE.md) — UX implementation completion notes

## design/

Design system notes and historical upgrade summaries.

- [`design/DESIGN_SYSTEM_UPDATES.md`](design/DESIGN_SYSTEM_UPDATES.md) — design system changes
- [`design/DESIGN_UPGRADE_SUMMARY.md`](design/DESIGN_UPGRADE_SUMMARY.md) — design upgrade summary

## architecture/

Background on subsystems and how they fit together.

- [`architecture/WORKER_EXPLAINED.md`](architecture/WORKER_EXPLAINED.md) — what the Cloudflare license worker is and why the project needs it

## Other documentation in the repo

These live close to their code and aren't duplicated here:
- `../../worker/` — operational guides for the Cloudflare worker (DEPLOY, LEMONSQUEEZY_INTEGRATION, PAYMENT_AUTOMATION_SETUP, etc.)
- `../../cli/PUBLISH.md` — npm publishing for the CLI
- `../../store/` — Chrome Web Store listing copy and upload guides
- `../../.github/` — release automation and Chrome Web Store credential setup
- `../../extension/README.md` — extension architecture and feature map

## Note on relative links

Files inside this folder reference repo-root paths via `../../../` (e.g., `../../../worker/DEPLOY.md`). If you move docs around again, update the links accordingly.
