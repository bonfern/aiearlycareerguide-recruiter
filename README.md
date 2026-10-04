# AI Early Career Guide — Recruiter Assessment V3

**Independent Recruiter application** for `https://recruiter.aiearlycareerguide.com`. Student and Professional assessments remain in their existing repository and deployment.

## INSTALL V3 — No local Node.js installation required

1. Download and extract the complete V3 ZIP.
2. Open the **Recruiter GitHub repository**, not the Student/Professional repository. Upload the ZIP's **contents** into the repository root, replacing earlier versions of files. Include `server`, `lib`, `assets`, `docs`, `tests` and the hidden `.github` directory. Do not create a second nested `recruiter-assessment-v3` directory in GitHub.
3. **Important:** delete any old `.js` files in `api` except `router.js`. The V3 ZIP contains only **one deployable Vercel function**, `api/router.js`; the separate endpoint handlers reside in `server/` and do not count as Vercel functions.
4. In the **Recruiter Vercel project → Settings → Environment Variables**, retain your existing Firebase, Resend and pilot-mode variables. Ensure `OPENAI_API_KEY` is configured. Add or update:
   - `OPENAI_QUESTION_MODEL` = `gpt-5.6-sol` (only if your API project has access).
   - `OPENAI_REASONING_EFFORT` = `high`.
   - Optionally `OPENAI_FOCUS_MODEL` = `gpt-5.6-sol` (otherwise uses the question model).
   The code defaults to these values even if the optional model/effort variables are absent. **OpenAI API billing is separate from ChatGPT subscriptions.** If your API project lacks model access, select a reasoning-capable model that your project supports and set `OPENAI_QUESTION_MODEL` accordingly.
5. Commit the repository changes. Wait for **Vercel → Deployments → Ready**; there are no Firebase migrations or DNS changes.
6. Create a **NEW TEST JD**. Previous published assessments remain locked and continue to use their original question and reporting versions.
7. Approve the JD requirements, propose critical competencies, review/approve the 20-, 30- or 40-question focus, and create an assessment draft.
8. Select **Generate questions**. The first call plans distinct topics for the whole assessment; later calls generate four questions per batch. The browser keeps calling the API and displays progress. If generation pauses, click **Continue generation**; already saved batches are retained.
9. **Review all questions and their four alternatives before publishing.** The system checks for repeated topics and obvious distractors and will automatically retry a quality-rejected batch up to twice. It cannot prove every answer is unambiguous or every question is challenging. A recruiter must review the content and scoring rationale. Correct any flagged questions, save and publish.
10. Send a pilot invitation, complete the timed candidate test and open the report. For a clean PDF, click **Print / Save PDF**, set destination to PDF, and **turn off the browser's “Headers and footers” option** so the browser itself does not add a URL or timestamp above your logo.

### What changes in V3

- **Assessment blueprint** plans distinct subjects, scenarios, decisions and difficulty across the **entire** assessment before writing individual questions. Generation tests the most critical recruiter-approved competencies, not every JD line. Twenty questions is the minimum.
- **Higher-reasoning question generation**, in small, recoverable batches, asks for four realistic alternatives and defends one preferred answer. A deterministic quality gate checks repeated topics, overlapping questions, common incompetent distractors and some common competency-mapping errors. Final publication runs quality checks again.
- **Organisation-specific cache** reuses a complete approved topic plan for an identical role and up to **35%** of published questions only when their exact approved topics match; unrelated roles or other recruiters' content cannot be reused. Questions generated under V2 are **not imported into the V3 cache**.
- **V3 candidate report** starts with the official logo, candidate and role, then score, attempted questions, time, factual response summary, grouped competency scores, strengths/gaps tied to question numbers, expanded interview validation, a short browser summary and a collapsible full question-by-question appendix.
- **No claims about untested abilities**: correct selections in a leadership or communication scenario are reported as correct selections, not as evidence of actual communication delivery, employment history or software expertise. The report does not show the old untested-criteria tables or “broader coverage” jargon.
- **Integrity**: brief focus changes and network delays are not flagged. The browser reports only a completed **10-second-or-longer hidden-tab episode**. There is no webcam. Browser activity is never a cheating verdict.
- **Processing feedback**: recruiter requests show a clear, accessible working message; candidate OTP verification, navigation and submission show processing; answer saves remain visible inline. Screen updates preserve navigation and position from V2.
- **Branding**: reuses the official logo and icon already present in the latest Recruiter files. Sentence-case screen labels, consistent product naming, navy and teal theme, print-specific report layout.

### Architecture and version preservation

`api/router.js` is the **only** JavaScript file in `api/`. Vercel rewrites map existing `/api/*` URLs to that one router; handlers remain in `server/`. Firebase collections and environment variables are unchanged. Existing V1/V2 question sets, published assessment IDs and historical reports stay in place. New assessments are identified internally as `critical-competencies-v3`; V2 assessment drafts can still be finished on their legacy generator, while newly created JDs use V3.

**Pilot mode still limits each JD to five invited candidates.** Prepaid credits, coupons and Razorpay are deliberately not part of this V3 quality update.

### Security

Never upload `.env.local`, service-account JSON, API keys, candidate tokens or real candidate data to GitHub. Verify your Vercel production deployment uses the intended Recruiter Firebase project only. If you added temporary GitHub secrets for the owner-seed action, remove them when no longer needed.

### Testing

The repository includes 48 automated JavaScript tests, run automatically via the existing GitHub Actions workflow; it needs no local Node.js install. A green Actions run is necessary but **not sufficient**: live OpenAI model availability, real email OTP delivery, actual question quality across different JDs, report accuracy against candidate responses, and Vercel latency still require an end-to-end pilot in your deployment.
