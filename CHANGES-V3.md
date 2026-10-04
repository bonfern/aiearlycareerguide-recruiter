# Recruiter Assessment V3 — changes and acceptance criteria

1. **Distinct questions.** Plan 20/30/40 unique decisions and scenarios before generating individual questions. Flag repeated topics, similar wording, paraphrased shift-change/customer-escalation scenarios and unsuitable competency mappings. Generate questions four at a time; retry quality-rejected batches at most twice, retaining earlier batches. V2 cached questions are never mixed into new V3 assessments.
2. **Plausible answers.** Require four attractive, role-appropriate options, one defensible preferred answer, and an explanation. Flag even one cartoonishly bad distractor, options that are too similar and conspicuously longer correct answers. Recruiter approval remains mandatory.
3. **Evidence-only reporting.** Base the summary and grouped competency scores on actual responses; avoid asserting communication delivery, real-world leadership, employment experience or other unmeasured skills. Interview recommendations draw on wrong answers, test the depth of correct answers and include role-relevant practical demonstrations.
4. **Clean reports.** Print starts with the official logo and candidate information, not the dashboard or workflow headings. Hide outcome, version, untested-competency tables and technical narrative jargon on new V3 reports. Grouped competency performance, concise summary, fuller interview recommendations, timing and the full answer appendix remain. Existing published V1/V2 reports stay accessible in their original format. Disable browser print headers/footers when saving PDF.
5. **Accurate browser indicators.** Ignore window blur and server latency as integrity events. Only a completed hidden-tab episode lasting at least 10 seconds appears in the report. Browser monitoring is never proof of misconduct.
6. **Processing messages.** Recruiter actions and candidate verification/saving/submission show visible processing states; longer question generation shows progress, including quality retries.
7. **Higher-reasoning model.** Question planning, generation and focus use a configurable OpenAI model, defaulting to `gpt-5.6-sol` with `high` reasoning, subject to API access and billing. One model call per Vercel request avoids long multi-call function timeouts.
8. **Deployment and brand.** Independent Recruiter repository and Firebase project, official site logo on both screens and report, consistent title case for the brand and sentence case for user-facing headings. Vercel deploys **one** API function, `api/router.js`, under Hobby's twelve-function limit. No database migration.

## Release checks

- All 48 automated tests pass locally or in GitHub Actions and JavaScript parses successfully.
- Confirm a full live pilot with at least two similar JDs and a different JD; verify generated questions and preferred answers with a human reviewer.
- Verify OTP, timer, autosave, navigation, submission, report facts and A4 PDF on the deployed Vercel/Firebase/OpenAI stack.
- Verify brief tab switches and network delays do not appear as sustained-tab changes.
