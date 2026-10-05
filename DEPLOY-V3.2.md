# Recruiter Assessment V3.2 — Usability, Richer Reporting and Assessment Tiers

V3.2 keeps the V3.1 skills-only question generator and timeout recovery, and adds three calibrated changes before payments are built.

## What changes

### 1. Compact dropdowns
- Desktop dropdowns no longer stretch across the full page.
- Standard maximum widths are used for assessment length, seniority, competency importance, question type, mapped requirements and other selects.
- On mobile, dropdowns expand to the available width for usability.

### 2. Richer evidence report
The report remains evidence-based and does **not** make claims about competencies that were not tested. New reports now include:
- Candidate Assessment Summary with a fuller five-part interpretation of actual results.
- Evidence From Stronger Responses and Areas to Explore Further, linked to question numbers.
- Performance by Competency, including examples of the topics actually tested.
- Performance by Question Type.
- Response Pattern and Timing: total time, average/median active time, answer changes and sustained tab changes.
- More comprehensive Suggested Interview Validation, combining missed responses, deeper checks on high-scoring areas and relevant role capabilities best validated in an interview.
- Detailed Question Evidence with selected answer, preferred answer, explanation and time.
- A short plain-English disclaimer at the end.

Historical V3 reports are enriched when opened using their stored questions and responses; no candidate score or answer is changed.

### 3. Assessment tiers and future credit usage
V3.2 prepares the application for the agreed commercial model. It does **not** charge credits yet.

| Tier | Questions | Default time | Future credit usage |
|---|---:|---:|---:|
| Essential | 20 | ~30 minutes | 1 credit |
| Standard | 30 | ~45 minutes | 1.5 credits |
| Advanced | 40 | ~60 minutes | 2 credits |

The selected tier and credit cost are stored on new assessment drafts so the payment build can enforce the correct charge later. Pilot invitations remain free while `RECRUITER_PILOT_MODE=true`.

## Deploy

1. Extract the V3.2 ZIP.
2. Upload the **contents** of `recruiter-assessment-v3-2` to the root of the existing Recruiter GitHub repository, replacing prior files.
3. In `api/`, keep **only `router.js`**. Do not move any `server/*.js` file into `api/`.
4. Keep all current Firebase, Resend, OTP and OpenAI environment variables. **No new environment variable is required for V3.2.** Keep the V3.1 model settings:
   - `OPENAI_QUESTION_MODEL=gpt-5.6-terra`
   - `OPENAI_FOCUS_MODEL=gpt-5.6-terra`
   - `OPENAI_REASONING_EFFORT=low`
5. Commit the changes and wait for Vercel to show **Ready**.
6. Test one new 20-question Essential assessment and one existing completed V3 report.

## Live checks before payments

- Dropdowns are compact on desktop and full-width on mobile.
- Essential / Standard / Advanced display the correct question count, duration and future credit usage.
- A new candidate report contains only tested competency findings.
- Performance by Question Type and Response Pattern and Timing match the underlying question evidence.
- Interview validation is useful and specific, without treating untested capabilities as candidate weaknesses.
- PDF starts with the official AI Early Career Guide logo and remains readable.
- Vercel deploys exactly one serverless JavaScript function: `api/router.js`.

Automated tests cover the tier values, compact dropdown CSS, report sections, routing and the existing V3.1 assessment/candidate safeguards. Live Firebase, OpenAI and email behaviour should still be tested after deployment.
