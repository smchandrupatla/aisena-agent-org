# HSFS Documentation Center

## Common Branding Standard
All templates in this folder use the same branding header and metadata block:
- Brand: `HSFS (Hybrid Sanctions and Fraud Screening System)`
- Program: `Autonomous Delivery Shop`
- Header fields: Document Type, Version, Owner, Status, Classification, Last Updated, Review Cycle
- Footer line: `HSFS | Controlled Document | Do not distribute without approval`

## Category Templates
1. `01-planning-requirements/TEMPLATE-planning-requirements.md`
2. `02-design/TEMPLATE-design.md`
3. `03-development/TEMPLATE-development.md`
4. `04-testing-qa/TEMPLATE-testing-qa.md`
5. `05-devops-infrastructure/TEMPLATE-devops-infrastructure.md`
6. `06-security-compliance/TEMPLATE-security-compliance.md`
7. `07-project-management/TEMPLATE-project-management.md`
8. `08-release-maintenance/TEMPLATE-release-maintenance.md`
9. `09-end-user/TEMPLATE-end-user.md`
10. `10-handover-knowledge-transfer/TEMPLATE-handover-knowledge-transfer.md`

## Usage Notes
- Copy a template section into a new document for each deliverable.
- Keep the branding block intact for consistency.
- Maintain append-only change history where required by governance.

## Word Templates (.docx)
- Generated templates are located under `/documentation/word-templates/`.
- Generator script: `/documentation/generate_word_templates.py`.
- Regenerate all templates:

```bash
/home/codespace/.python/current/bin/python documentation/generate_word_templates.py
```
