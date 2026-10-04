# Cache strategy — Recruiter (Step 2)

**Implemented now**
1. Organization-scoped *exact-JD extraction cache*. A SHA256 key contains the organization ID, extraction prompt/schema version, normalized job title, and JD text hash. The full extracted result is saved in Firestore and reused on an exact hit, avoiding an OpenAI call.
2. Organization-scoped *approved role suggestions*. After extracting a JD, compare it to up to 100 previously approved organization templates using conservative token overlap. Require compatible role title, identical seniority and complete matching of the approved template's Must Have requirements; suggest only. Never silently replace the new JD's extraction with a template.
3. Stable system instructions precede role-specific JD content for API-side prompt caching when available.

**Next phase (assessment generation)**
- Cache approved question templates alongside requirements for similar roles. Reuse safe, suitable questions after recruiter review; generate only missing/changed requirements. Save template version, model, prompt version and requirement linkage. Published versions remain immutable.
- Optionally add embedding-based semantic search when organization template count merits the added complexity and spend; only after hard Must Have and seniority checks.

**No candidate personal data** in any cache. Do not share one organization’s JD, templates or embeddings with another organization. Extracted JD text can contain confidential employer material: encrypt/lock down Admin access, limit retention, and show privacy terms before onboarding external recruiters.

**Billing**: This phase does not debit candidate assessment credits (payment and candidate invitations are not implemented yet). Separate rate/budget limits at OpenAI project level provide cost protection during testing.
