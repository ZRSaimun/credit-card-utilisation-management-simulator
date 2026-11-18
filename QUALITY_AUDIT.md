# Software Quality Audit

Audit date: 18 November 2026  
Scope: React/Vite simulator, financial model, local Express/SQLite API, GitHub Pages deployment.

## Current result

- Financial unit tests: passing
- Python validation: passing
- C++ ledger check: passing
- Production build: passing
- Simulation-only boundary: present
- Public deployment: configured through GitHub Actions

## Findings

### High priority

1. Browser-level tests are not yet present. Add Playwright tests for navigation, card editing, transfer preview, cycle events, exports, mobile layout, and presentation mode.
2. The frontend scenario API integration needs load/edit/delete UI. The local API exists, but the UI currently saves a scenario without a management workflow.
3. Transfer preview and ledger transfer events should share one typed transaction model so the preview cannot diverge from the monthly ledger.

### Medium priority

1. Add stable React keys to every mapped row/card/chart item.
2. Add accessible chart titles, summaries, and a table alternative. Never rely on colour alone for utilisation status.
3. Validate API payloads and return structured errors for malformed scenario data.
4. Add an error boundary and visible export/API failure messages instead of browser alerts.
5. Add mobile/tablet snapshots and keyboard navigation checks.

### Low priority

1. Split `main.tsx` into feature components: Dashboard, Cards, Allocation, Cycle, Calendar, Scenarios, Reports, and FinancialMathLab.
2. Lazy-load Excel/PDF/chart modules to reduce the current large JavaScript bundle.
3. Add a polished report cover, version metadata, and a print-specific layout.

## Quality target

For this educational prototype, target WCAG 2.2 AA for the interface, OWASP ASVS Level 1 controls for the local API, deterministic financial unit tests, and Playwright smoke coverage for the main user journeys. This is a simulation tool, not a banking or payment system.

## Recommended order

1. Stable keys and accessibility metadata
2. Playwright browser tests
3. Scenario load/edit/delete workflow
4. Shared transaction schema for transfer and Direct Debit events
5. Component split and code splitting
6. Final mobile and keyboard QA

