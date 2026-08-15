# Daily Finding — Agent 17: Payments & Messaging SME
**Date:** 2026-08-15
**Agent:** 17-payments-messaging-sme

---

## FINDING

SWIFT has confirmed that effective November 14, 2026, all CBPR+ cross-border payments must carry fully structured or hybrid postal addresses — unstructured (free-text) address fields will be technically rejected by the network — and MT101 payment initiation messages must be migrated to ISO 20022 pain.001 format by the same date, with no translation contingency available.

---

## WHY_IT_MATTERS

AISENA is building a payments screening pipeline whose Stage 0 ingestion layer parses sample transaction events. The November 2026 mandate has two direct implications:

1. **Richer screening inputs available now:** Structured addresses (`<TwnNm>`, `<Ctry>`, `<StrtNm>`) are machine-readable and deterministic — in contrast to free-text blobs that degrade entity resolution. AISENA's detection service must be designed from Stage 0 to consume and index these structured ISO 20022 fields, not treat address as a single opaque string. Doing so will directly improve sanctions screening precision and reduce false positives.

2. **Message format alignment:** The Stage 0 sample event schema (`services/ingestion/produce.py`) currently uses a flat JSON structure. As the project advances toward realistic payloads, it must align with pacs.008 / pain.001 ISO 20022 XML or JSON-equivalent structures. Designing the ingestion schema now to mirror ISO 20022 party/address element paths avoids costly re-modelling later.

Additionally, mandatory `camt.110` (case management) message reception begins November 2026, creating a new ingestion channel for payment investigations that AISENA's case management story will need to address.

---

## EVIDENCE

- SWIFT: "ISO 20022 milestone for November 2026: Unstructured addresses to be removed"
  https://www.swift.com/news-events/news/iso-20022-milestone-november-2026-unstructured-addresses-be-removed
  (Published: 2026, official SWIFT announcement)

- SWIFT: "ISO 20022 in bytes for payments: Call-to-action for November 2026"
  https://www.swift.com/standards/iso-20022/iso-20022-bytes/call-action-november-2026
  (Published: 2026)

- Federal Reserve Financial Services: "ISO 20022 Upcoming Releases"
  https://www.frbservices.org/resources/financial-services/wires/iso-20022-implementation-center/iso-20022-2025-releases
  (Updated: 2026)

- Cambridge Currencies: "ISO 20022 in 2026: Critical Deadlines After November 2025"
  https://cambridgecurrencies.com/iso-20022-guide-2026/
  (Published: 2026)

---

## RECOMMENDED_ACTION

Update the Stage 0 sample event schema in `services/ingestion/produce.py` to use structured address sub-fields aligned with ISO 20022 party elements:

```json
"debtor": {
  "name": "Acme Corp",
  "address": {
    "street_name": "123 Main St",
    "town_name": "New York",
    "country": "US",
    "post_code": "10001"
  }
},
"creditor": {
  "name": "Global Supplies Ltd",
  "address": {
    "town_name": "London",
    "country": "GB"
  }
}
```

This is the smallest change that: (a) future-proofs the ingestion schema against the Nov 2026 mandate, (b) gives the detection/screening service discrete indexed fields for sanctions name+address matching, and (c) becomes the canonical data model for all subsequent stories. Add a corresponding acceptance criterion to the Stage 0 screening story: "Transaction events MUST include structured debtor/creditor address fields (`town_name`, `country` at minimum) conforming to ISO 20022 PostalAddress22 semantics."
