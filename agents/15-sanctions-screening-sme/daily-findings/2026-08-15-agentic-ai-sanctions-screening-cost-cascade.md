# Daily Finding — Agent 15: Sanctions Screening SME
**Date:** 2026-08-15
**Agent:** 15-sanctions-screening-sme

---

## FINDING

Moody's published guidance (August 2026) demonstrating that in agentic AI sanctions screening architectures, deploying a lightweight ML model as a first-pass filter before routing uncertain hits to an LLM layer reduces per-alert LLM cost by 60–80% while preserving recall — a "model cascade" pattern directly applicable to AISENA's multi-agent screening design.

---

## WHY_IT_MATTERS

AISENA is building a Stage 0 proof-of-concept screening pipeline with AI agents. As the project scales, unfiltered LLM calls on every transaction event will be cost-prohibitive and slow. The model cascade pattern (rule/ML pre-filter → LLM only for ambiguous hits) means AISENA can ship a cost-controlled, explainable screening path from Stage 0 onward rather than retrofitting it later. This directly affects how the 05-backend-engineer implements the detection service (`services/detection/consume.py`) and how Agent 15 specifies match algorithm expectations and acceptance criteria.

Additionally, the Federal Reserve's peer-reviewed paper (September 2025) provides empirical evidence that LLM-assisted screening achieves up to 92% false positive reduction versus legacy fuzzy matching, providing a credible baseline for AISENA's acceptance criteria thresholds.

---

## EVIDENCE

- Moody's: "Managing the Cost of Agentic AI in Sanctions Screening: Why Machine Learning Matters"
  https://www.moodys.com/web/en/us/kyc/resources/insights/managing-the-cost-of-agentic-ai-in-sanctions-screening-why-machine-learning-matters.html
  (Published: August 2026)

- Federal Reserve Board: "Can LLMs Improve Sanctions Screening in the Financial System? Evidence from a Controlled Study"
  https://www.federalreserve.gov/econres/feds/files/2025092pap.pdf
  (Published: September 2025)

- OFAC Sanctions List Service (most recent SDN update: 2026-08-07):
  https://ofac.treasury.gov/sanctions-list-service

---

## RECOMMENDED_ACTION

Update the Stage 0 sanctions screening story in `/project/requirements` to explicitly specify a two-layer match architecture:

1. **Layer 1 (Fast path):** Simple rule-based or lightweight ML fuzzy match against the toy SDN list. Flag hits above a low threshold for review.
2. **Layer 2 (Slow path):** LLM-assisted entity resolution only for scores in an ambiguous mid-range band.

Add an acceptance criterion: "False positive rate on the toy SDN test fixture must be ≤ 20% at a 100% true-positive recall rate, using Layer 1 alone." This is measurable, realistic for a Stage 0 proof, and aligns with published benchmarks.
