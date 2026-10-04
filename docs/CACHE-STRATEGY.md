# Persistent role-template caching (designed now; implemented in Steps 2–3)

Keep two different caches:

1. **Exact JD extraction cache**: SHA-256 hash of normalized text, scoped to the recruiter organization. An identical JD can reuse the prior AI extraction. Editing a JD changes its hash and invalidates the exact hit.
2. **Approved role-template cache**: store the organization, canonical role, seniority, extracted skill/requirement list, embedding, validated requirements, approved question templates, template version, AI prompt version and model version. Suggest candidates when semantic similarity is sufficiently high **and** mandatory requirements and seniority agree; no similarity threshold should override a must-have mismatch.

When a recruiter uploads a JD, check exact hash first. If there is no hit, perform extraction and check role-template similarity. Provide the closest safe template to the recruiter for review, show differences, generate only missing questions, then publish a new assessment version. Do not blindly reuse a generic assessment merely because job titles match.

**Isolation**: never share an organization's proprietary JDs, approved templates or embeddings with another organization by default. Candidate names, responses, scores, reports, invitation tokens, coupon details and invoices are *never* part of reusable role caches.

**Cost tracking**: store cache-hit type (exact/similar/miss), skipped calls, embedding cost, model usage tokens, input cached tokens and AI generation cost by organization. OpenAI prompt caching is a separate, short-lived API optimization: keep shared instructions first and JD-specific information last. This does not replace your persistent Firestore role cache.

**Question integrity**: approved templates may need rotating equivalent questions and answer-option ordering to reduce sharing between candidates. Maintain consistent difficulty and validated requirement coverage across variants. Published assessments are immutable; editing creates a new version. Candidate reports must still be computed from that individual's answers.
