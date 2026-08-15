# Frontend Engineer Checklist

- [ ] Reviewed project context and requirements.
- [ ] Produced role-specific deliverables.
- [ ] Documented assumptions and risks.
- [ ] Created handoff documentation if required.
- [ ] Aligned output with the Implementation Manager's guidance.

## Accessibility Standards (updated 2026-08-15)

- [ ] Every new UI component targets **WCAG 3.0 Bronze** minimum (equivalent to WCAG 2.2 AA — currently legally required).
- [ ] Interactive patterns (live alert regions, modals, case management screens) have explicit ARIA 1.3 roles documented before implementation.
- [ ] Form inputs include visible labels, error messages linked via `useId`, and keyboard navigability.
- [ ] Focus management is tested after async UI changes (e.g., sanctions hit notifications).
- [ ] Automated accessibility checks run in CI using `axe-core` / `jest-axe`.
- [ ] WCAG 3.0 Bronze conformance noted as aspirational target so migration to Silver/Gold is additive rather than a rewrite.

> Reference: W3C WCAG 3.0 Working Draft, March 2026 — https://www.w3.org/TR/2026/WD-wcag-3.0-20260303/
