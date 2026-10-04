# AI Early Career Guide — Recruiter Assessment | Step 3

Independent recruiter application. Do **not** edit the existing Student / Professional repository, Firebase project or Vercel project. Step 3 adds question generation, strict organisation-scoped reuse of previously published recruiter-approved questions, a review/edit screen and assessment publishing. Existing Step 1/2 JDs and approved requirements remain usable.

## Deploy Step 3 — no local Node.js needed

1. Extract **recruiter-assessment-step3.zip**. In your *recruiter-only* GitHub repository, upload/replace the **contents** of the extracted folder, preserving `api/`, `lib/`, `tests/` and the other directories. Do not upload the outer folder as a nested directory. Commit changes to the branch connected to your recruiter Vercel project.
2. In **Recruiter Vercel → Settings → Environment Variables**, confirm `OPENAI_API_KEY` is already present from Step 2. Your other Firebase variables remain unchanged. **No new mandatory variable** for Step 3. Optional: `OPENAI_QUESTION_MODEL=gpt-4.1-mini`.
3. Go to **Recruiter Vercel → Deployments**, check the deployment for the new GitHub commit succeeded. Redeploy the latest commit if required. If Vercel warns that the function duration setting is unsupported on your plan, shorten `api/generate-questions.js` `BATCH` to 4 and set `maxDuration` in `vercel.json` to your plan's supported limit.
4. Visit **https://recruiter.aiearlycareerguide.com**, sign in, and open a job whose requirements you already approved.
5. Scroll to **Choice-based assessment**, select 15 (start with the shortest test), click **Create assessment draft**, and then click **Generate questions**. The interface builds the assessment in small AI batches and displays progress.
6. Review all questions, edit a scenario or answer choice, change the best answer if needed, **Save edited questions**, and **Publish assessment**. Publishing locks the questions and stores the approved template for later reuse within your organisation.
7. To test caching, create a **new JD** with the same title and requirements, approve its extraction, create another 15-question assessment and generate. An exact approved match should reuse all 15 without a new AI question-generation call. Similar roles at the same seniority with matching must-have requirements may reuse up to 60%; the remaining questions are generated specifically for the new JD. Reused questions must still be reviewed.

**This step stops at publishing the recruiter assessment.** Candidate invitations, OTP, purchased credits/coupons, answer submission and evidence reports are not yet active. Do not send question-editor URLs to candidates.

## How this cache works

- Exact JD extraction cache from Step 2 is unchanged (`jd_extraction_cache`).
- New collection `published_question_templates` contains only *recruiter-reviewed and published* question sets, with a signature that includes the organisation, role, seniority, experience and all approved requirements.
- Exact approved match with sufficient questions: reuse the whole assessment. Similar approved role: require the same seniority and an 80%+ role-title overlap, matching all mandatory requirements in both directions; map each reused question to a matching approved requirement; cap reuse at 60%. The remaining questions are newly generated.
- No candidate information is stored or reused in the cache. Cache lookups are limited to the currently authenticated recruiter's organisation. This is a conservative **keyword/requirements similarity cache**, not a semantic vector-search system; semantic matching may follow after testing its cost and accuracy.
- OpenAI may also provide automatic prompt caching for repeated static instructions. Avoid changing the constant prompt wording on every request.

## Data model

- `recruiter_assessments/{jobId}`: one assessment (V1) per JD, selected question count, draft generation progress, recruiter edits and final published questions. You cannot change the question count after starting, and published assessments cannot be modified. For a materially different JD or assessment, create a new job.
- `published_question_templates`: organisation-scoped approved question-cache entries, created **only when the recruiter publishes**.
- Existing `recruiter_jobs` status changes to `assessment_draft` and then `published`.

All new endpoints use the same Firebase ID token and recruiter organisation membership checks. Firestore client access remains denied; only authorised backend endpoints read/write question keys. No changes to Firebase security rules or GitHub secrets are needed.

## Checks and limitations

`npm test` uses built-in Node.js tests for caching, role compatibility, organisation isolation, invalid questions and requirement coverage. Vercel installs Node.js and production packages automatically; none are required on your personal computer.

- Only objective, **four-option, one-best-answer** screening questions in this version. AI-drafted answers and rationales are not authoritative: recruiters must verify accuracy and fairness before publishing.
- Do not score or reject candidates automatically. Future reports should provide evidence and flag uncertainty for human judgement.
- Generated batches are saved after every successful request; if a batch fails, press **Continue generation** instead of restarting or paying to regenerate completed batches.
- The backend blocks concurrent generation with an expiring lock. Large AI batches and downstream API issues can occasionally require retrying.
- The initial cache scans up to 100 templates within an organisation; larger organisations will need indexed search/pagination.
- No site secrets belong in GitHub source code, browser HTML or screenshots.
