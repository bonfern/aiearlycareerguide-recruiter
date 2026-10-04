# AI Early Career Guide — Recruiter Assessment | Step 2

Independent recruiter application. Keep the existing Student and Professional apps untouched. Step 2 adds authenticated JD upload/paste, OpenAI requirement extraction, organisation-scoped exact-JD caching, organisation-scoped suggestions of similar *previously recruiter-approved* roles, recruiter editing and approval.

**Not yet implemented:** choice-based question generation, full approved-question reuse, candidate invitations, OTP, evidence reports, and paid credits/coupons. These follow in later phases. Similar-role suggestions here are *not* automatic extraction reuse; they become inputs to controlled question-template reuse during assessment generation.

## Deploy this update without installing Node.js

1. Download and unzip `recruiter-assessment-step2.zip`. In your **recruiter-only GitHub repository**, replace existing files with the new full versions and add the new files. Keep the directory structure (e.g., `api/extract.js` remains under `api/`). Do not change the Student/Professional repository.
2. Create an OpenAI **API key** in a separately configured API project at https://platform.openai.com/api-keys. Set a modest project spend limit and usage alerts. An existing ChatGPT subscription does not include API credits.
3. In your **Recruiter Vercel project only**, go to **Settings → Environment Variables**. Add `OPENAI_API_KEY` (secret) with the new key. Optionally set `OPENAI_EXTRACTION_MODEL` to `gpt-4.1-mini` (default). Never enter an OpenAI key in website code or GitHub.
4. Redeploy the recruiter project (ensure Vercel is building the new GitHub commit). The new `package.json` installs `mammoth` and `pdf-parse` in Vercel automatically; you don't need Node.js locally.
5. Log in at https://recruiter.aiearlycareerguide.com. Open the previously created draft job, select **Extract requirements with AI**, edit a requirement or priority, and click **Approve requirements**. For upload testing, create another job using a machine-readable PDF/DOCX or TXT file up to 2 MB.
6. For cache testing, create a new job with the **same title and identical JD text**, then extract. The screen should say **Cache hit** and no second OpenAI call is needed. A similar but not identical approved JD may show a suggested template; it will not blindly reuse it.

## Data collections

- `recruiter_jobs`: JD, extraction, approval, and status for each role. Existing draft jobs remain compatible.
- `jd_extraction_cache`: SHA256 of org ID + prompt version + JD fingerprint. Exact hits skip extraction API costs. Does not store candidate data.
- `approved_role_templates`: reviewer-approved requirements stored per organization for future question-template reuse. For safety, comparison requires compatible seniority, role title and Must Have requirements.

All API endpoints require a Firebase ID token and membership in the organization. Direct client access to Firestore remains denied by `firestore.rules`. A recruiter cannot pass another organization's ID in the request to access its data.

## Typical problems

- **OpenAI configuration missing**: Confirm `OPENAI_API_KEY` exists under the *recruiter* Vercel project and redeploy.
- **Unauthorized**: Verify the recruiter Firebase login and your existing `recruiter_members` record.
- **Scanned PDF**: Image-only PDFs aren't supported in this phase; paste the JD text or use a readable DOCX/PDF.
- **File parsing error**: Keep uploads under 2 MB, and ensure that `package.json` has been replaced and deployed.
- **Status already approved**: Approved requirements are locked for this phase. To assess a materially revised JD, create a new job; versioning follows in assessment-generation phase.

## Internal checks

`npm test` (executed by GitHub Actions if desired) verifies JD hashing, organization-scoped keys, extraction validation and guarded similarity suggestions. Never commit `.env.local` or service-account JSON to GitHub.
