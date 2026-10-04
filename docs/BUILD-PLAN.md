# Recruiter V1: incremental build plan

This is a standalone application deployed to `recruiter.aiearlycareerguide.com`. Do not import code or secrets from the existing Student or Professional projects.

## Step 1 — included in this ZIP
- Independent vanilla HTML/JS Vercel project, new Firebase Auth and Firestore project.
- Invite-only recruiter login; owner membership seeded with an administrative script.
- Multi-job dashboard and create/paste/save JD form.
- Organization ID assigned server-side to every job; ID token verified on every private API request.
- Exact JD hashing groundwork and automated cache tests. No AI calls yet.

## Step 2 — JD and requirement extraction
- PDF and DOCX uploads, validation, and secure object storage; continue accepting pasted JDs.
- Check exact normalized-JD hash in the organization's extraction cache before calling AI.
- For unseen JDs, extract structured skills/seniority/domain, then compare against stored approved role templates.
- Semantically similar suggestions must be reviewed and approved by the recruiter. Never silently assume equivalence.

## Step 3 — validated questions and role-template cache
- Priority-weighted requirement validation; 15, 25, 40 questions; preview and edit.
- Exact hash or sufficiently close embedding match: propose reuse of approved template, then regenerate missing/different requirements only.
- Version and lock published assessments; scope all caches to recruiter organization.

## Step 4 — credit wallet, coupons, Razorpay
- Packs of 5, 10, 20, 50, 100 and 200+; pricing and coupon rules in admin configuration.
- Maintain a transactional credit ledger; grant credits only on verified and idempotent payment webhook.
- Reserve credit on invitation, consume on first candidate start, release unused expired invitations.
- Define credit expiry and refund rules explicitly before accepting live payments.

## Step 5 — candidates and secure assessment
- Separate candidate records and many assignments per JD; per-candidate secure link and OTP.
- Candidate accepts terms; one active attempt per assignment; persist each choice securely.
- Prevent candidate access to other candidates, recruiter dashboard or answer keys.

## Step 6 — AI evidence report and operational checks
- Each report links verified question responses to recruiter-approved JD requirements.
- Report explains evidence and uncertainty, without automatic hiring decisions or invented facts.
- Ensure question coverage, accessibility, privacy/retention policy, clear candidate consent, rate limiting, logs, backups and cost monitoring before public launch.
