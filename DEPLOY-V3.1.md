# Recruiter Assessment V3.1 — Timeout Fix & Skills-Only Competencies

## What this fixes

- **Faster model:** GPT-5.6 Terra instead of Sol. The generator and focus proposer default to low reasoning; you can increase to medium after the live pilot if response time permits.
- **Recoverable planning:** One competency is planned per serverless request. Each plan is written to Firestore before the next starts. Questions are then created and saved in batches of three. Each AI request has its own 35-second timeout, below the 60-second Vercel function limit. If a request fails, previous plans and questions remain saved.
- **Skills only:** The focus picker ignores eligibility criteria, degrees, qualifications, years of experience, employment history and irrelevant generic items, even if extracted in the wrong category. JD extraction now requests separate standalone technical/behavioural skill requirements where experience and capabilities are mixed together.
- **Existing stuck drafts:** An *unpublished* assessment can be reset to clear its question plan and approve a new skills-only focus. The original JD and approved requirements remain. Reset deletes draft questions, so do not reset a draft that already contains questions you want to retain. Published assessments and completed reports cannot be reset.
- **Vercel Hobby:** Only `api/router.js` is a serverless function. `server/*.js` modules are imported by that single router. Do not move server modules into `api/`.
- **Branding:** Existing official logo, recruiter/candidate pages, assessment styling and print report are retained.

## Deploy without installing Node.js

1. Extract the ZIP. Upload **all** extracted files and folders to your *separate Recruiter GitHub repository*, overwriting the V3 files. Do not upload `.env.local` or Firebase service-account JSON.
2. Delete any obsolete files remaining in GitHub's `api` folder: `router.js` must be the **only** JavaScript file directly in `api/`. Keep all files in `server/`, `lib/`, `assets/`, `docs/` and `tests/` as supplied.
3. Vercel → **Recruiter project → Settings → Environment Variables**. Update or add the values below for **Production** (and Preview if you use it). Keep the existing Firebase, Resend, OTP and other settings unchanged.

   ```text
   OPENAI_QUESTION_MODEL=gpt-5.6-terra
   OPENAI_FOCUS_MODEL=gpt-5.6-terra
   OPENAI_REASONING_EFFORT=low
   ```

   No new API keys or Firebase collections are required. These settings require API access to `gpt-5.6-terra`; if your API key cannot access it, the website will show an actionable model-access message instead of silently using a different model.
4. Commit GitHub changes, wait for the Recruiter Vercel deployment to show **Ready**, then **redeploy** from Vercel if you changed environment variables *after* the GitHub deployment.
5. Visit `https://recruiter.aiearlycareerguide.com` and create a new test JD. Approve the skills-only focus and run a **20-question** assessment first. You should see a separate progress message for each competency plan and three-question generation batch.

## If the existing test was paused

- **Saved draft has the right technical and soft skills:** Open it and press **Continue generation**. Previously saved questions and an existing full blueprint remain usable.
- **Saved draft includes education, degrees or years of experience in its approved competency groups:** Open the draft and select **Reset Unpublished Draft & Revise Competencies**. Confirm only if you agree to delete unfinished questions. Then propose, review and approve the corrected focus and regenerate.
- **A JD has *no* separate testable skill requirements** because the extracted items only mention years/education: create a fresh JD and review the newly extracted skill items. Previously approved JD requirements remain locked by design.
- **One batch still times out:** Retry once. If repeated, check Vercel Logs for rate limits or model-access errors; do not repeatedly retry on a 429 response. The batch has a 35-second client-side OpenAI timeout and previously saved work remains intact.

## Pilot tests

1. A JD that includes degrees and five years of experience: neither should appear in the proposed competencies.
2. A 20-question JD: progress should report four individually saved competency plans, followed by saved question batches of up to three.
3. If an AI batch fails, refresh the JD: saved plans/questions should remain, and **Continue generation** should resume.
4. Review final questions: realistic alternatives, no repeated scenario, correct skills mapping; publish, invite one test candidate, complete the assessment, and compare the report against actual answers.
5. Check branding, login, evidence report and mobile layout. Historical published JDs, invitations and reports should remain intact.

The automated test suite runs on GitHub Actions; live OpenAI, Firestore and Resend behaviour still requires testing against your production deployment.
