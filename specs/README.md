# EchoKit — Product Specs

Living product specifications, feature designs, and developer reference material.

> This folder contains active design documents and feature specs — not implementation notes (those live in `docs/`) and not roadmap items (those live in `TODO.md`).

---

## Files

### Core reference (always relevant)

| File | What it covers | When to read it |
|------|---------------|-----------------|
| [`PRD.md`](PRD.md) | Product Requirements Document — problem statement, personas, core requirements, what's been implemented version by version, current backlog | Starting a new feature; understanding what's already shipped |
| [`DUAL_INTERFACE_STRATEGY.md`](DUAL_INTERFACE_STRATEGY.md) | Popup vs DevTools panel — feature matrix, when each surface shows what, how `mode` flag works in `shared/app.js`, feature flag pattern | Adding any UI; changing what's visible in popup vs devtools |
| [`QUICK_REFERENCE.md`](QUICK_REFERENCE.md) | Developer quick-start for the Global Request Headers feature — templates and config patterns | Setting up headers injection; testing with real apps |

### Feature designs

| File | Feature | Status |
|------|---------|--------|
| [`SEARCH_FILTER_SORT_DESIGN.md`](SEARCH_FILTER_SORT_DESIGN.md) | Advanced search, filter & sort for the API list — full UX spec with UI mockups, filter state machine, sort interactions | Shipped (v1.2+) |
| [`ACCEPTANCE_CRITERIA.md`](ACCEPTANCE_CRITERIA.md) | BDD-style acceptance criteria and user scenarios for Advanced Search, Filter & Sort | Shipped; use for regression testing |
| [`PM_DESIGN_SUMMARY.md`](PM_DESIGN_SUMMARY.md) | PM-level design brief for Advanced Search, Filter & Sort — executive summary, scope, success metrics | Reference for scope decisions on the search/filter feature |
| [`DEVELOPER_CONFIG_EXAMPLES.md`](DEVELOPER_CONFIG_EXAMPLES.md) | Real-world configuration templates for Global Request Headers — bearer auth, tenant IDs, feature flags | Setting up Global Request Headers for a new use case |
| [`PRODUCT_STRATEGY_ROLLOUT.md`](PRODUCT_STRATEGY_ROLLOUT.md) | Rollout strategy for Global Request Headers — phased enablement, success metrics, risk mitigation | Understanding the intended launch sequencing for this feature |

---

## What goes here vs elsewhere

| Content type | Where it lives |
|-------------|----------------|
| Active product specs, feature designs, acceptance criteria | `specs/` ← here |
| Living roadmap with priority + status | [`TODO.md`](../TODO.md) |
| Version history of shipped features | [`CHANGELOG.md`](../CHANGELOG.md) |
| Architecture deep-dives, deployment guides, troubleshooting | [`docs/`](../docs/) |
| Extension architecture and feature map | [`extension/README.md`](../extension/README.md) |
| Code quality rules and PR checklist | [`DEVELOPMENT_RULES.md`](../DEVELOPMENT_RULES.md) |
