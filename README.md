# AI Early Career Guide — Recruiter Assessment V2

**This is the complete replacement of the standalone Recruiter website**, based on the previous Step 4.1 UI-fix release. It is **not** a replacement for the Student or Professional website. Its deployment remains on the independent `recruiter.aiearlycareerguide.com` Vercel project and Firebase database.

## What changed

- For **new assessments** only, question packages are **20 (30 min), 30 (45 min), 40 (60 min)**. Recruiters can still adjust time before inviting anyone.
- After JD requirements are approved, click **Propose critical competencies with AI**. AI chooses the most important **4 / 5 / 6 groups** according to question count. The recruiter can edit group names, rationale, relative importance, approved JD requirement mappings and question allocation (minimum 3 per group) and must explicitly **Approve assessment focus** before creating the draft.
- AI generates in batches of 6 and maps each question to one **approved focus group AND approved JD requirement**, rather than allocating questions across every JD requirement.
- The independent organisation-scoped **V2 cache** reuses recruiter-approved question templates only when the exact focus matches, or conservatively reuses compatible questions from comparable roles (up to 60% for similar roles). Existing V1 question templates cannot accidentally pollute V2 assessments. Existing exact-JD extraction caching is unchanged.
- The **V2 report** begins with the candidate assessment profile, grouped competency performance, test coverage descriptions, role-relevant interview validation ideas, independently verified eligibility criteria, uncovered critical JD requirements, grouped browser activity and question timing. All options, answers, correct answers, explanations and individual timings remain in a compact appendix.
- A one-time optional OpenAI narrative edit occurs when a V2 recruiter report is first viewed; the narrative is cached in Firestore. Hard scores always come from the saved answer key, **never** the AI narrative. If OpenAI is unavailable, the rule-based factual profile remains available.
- Older **15/25/40-question assessments, invitations, responses and reports remain untouched**. Reopening one renders the older display and generation workflow for that existing assessment. To try V2 with a previously used JD, create a **new Job**, paste that JD and run the new focus approval flow.
- Official branding, responsive layout, collapsible sections, the server-enforced candidate timer, question navigation, OTP, browser monitoring and the pilot invitation limit of **five per JD** remain.

## Install — no Node.js needed on your computer

1. Download the `recruiter-assessment-v2.zip` file and extract it on your computer.
2. Open your **Recruiter GitHub repository only** (not the Student/Professional repository). Upload the ZIP's **contents to the repository root**, preserving the `api`, `server`, `lib`, `assets`, `tests` and `.github` folders. Replace the corresponding old files and commit to `main`.
3. Check that the **`api` folder contains only `router.js`**. This is essential for Vercel Hobby's 12-function deployment limit; the other handlers stay in `server`, not `api`.
4. Open Vercel → your **Recruiter project** → Deployments and wait for the new GitHub deployment to say **Ready**. No new environment variables or Firebase rules are required: the project reuses the **existing Recruiter** `OPENAI_API_KEY`, Firebase settings and Resend settings.
5. Open `https://recruiter.aiearlycareerguide.com` and sign in. Create a **new test job** (or use a job whose requirements are approved and that does not yet have an assessment). Select **20 questions**, propose the critical competencies, check/edit them and their counts, approve, create the draft, generate the questions, review/edit, save and publish.
6. Invite a test candidate and complete the assessment. Check the new report's **grouped competency scores, summary and compact detailed appendix**. Test Print → Save as PDF. Your original published assessment and report should remain accessible unchanged.

### Important constraints

- **Existing published assessments are immutable.** V2 does not migrate or silently overwrite them. New `questionVersion` values distinguish old and new report generation.
- The recruiter approves the focus and every answer key. MCQs cannot verify employment experience or prove cheating. The browser log is only a set of observations, not a misconduct verdict.
- The pilot remains limited to five candidate invitations per JD, without paid credits. Razorpay packages and coupons are **the next phase** and are **not** part of this release.
- A V2 focus proposal and report narrative each use OpenAI when needed. Repeated viewing of a successfully generated report will reuse its saved summary rather than generate it again. Candidate answers and reports are never put into the question cache.
- `OPENAI_QUESTION_MODEL` and `OPENAI_REPORT_MODEL` may optionally be configured to override the default question/narrative model. Existing `OPENAI_API_KEY` is sufficient for testing.
- Don't upload `.env.local`, service-account JSON files or keys to GitHub.

## Automated tests

GitHub Actions runs `npm test` and JavaScript syntax checks after each push. The updated suite includes focus selection, group quotas, organisation-isolated V2 caching, eligibility separation, report grouping and legacy compatibility. Browser simulations covered the V2 recruiter focus → draft journey, V2 report and the existing candidate navigation. These are not substitutes for live OpenAI/Resend/Firebase deployment tests.

## Directory map

- `api/router.js` — **only** deployable Vercel API function; maps clean URLs to `server/*` handlers.
- `server/focus.js` — AI focus proposal and recruiter validation.
- `lib/focus.js` — deterministic, versioned focus validation, allocation, signature and compatible question reuse.
- `server/generate-questions.js` — V2 focus-aware AI questions with incremental progress and cached-question reuse.
- `lib/candidate.js` — deterministic grouped evidence reporting and legacy V1 report compatibility.
- `server/_profile.js` — optional one-time AI editorial summary from recorded results (not scoring).
- `app.js`, `index.html`, `style.css` — recruiter dashboard, competency editor, report UI and print layout.
- `candidate.js`, `candidate.html` — unchanged secure, timed candidate journey.

See also: `docs/ASSESSMENT-V2.md`.
