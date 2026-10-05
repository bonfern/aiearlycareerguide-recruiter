# AI Early Career Guide — Recruiter Assessment V3.2

Independent Recruiter application for `https://recruiter.aiearlycareerguide.com`. The Student and Professional assessments remain in their existing repository and Vercel deployment.

## Start here

Read **[DEPLOY-V3.2.md](DEPLOY-V3.2.md)** before replacing the files in GitHub.

V3.2 includes all V3.1 fixes: skills-only competency selection, GPT-5.6 Terra defaults, recoverable AI planning, three-question generation batches, question-quality checks, processing messages, browser monitoring, official branding and the single-function Vercel Hobby architecture.

## Current product flow

1. Recruiter signs in.
2. Create a Job and upload/paste a JD.
3. AI extracts requirements; recruiter reviews and approves them.
4. AI proposes only the most important **testable technical/domain and job-related behavioural competencies**. Education, years of experience and employment history are excluded from the choice-based test.
5. Recruiter selects an assessment tier and approves the competency focus.
6. AI plans distinct topics and generates challenging questions in recoverable batches. Recruiter reviews and publishes.
7. Recruiter invites pilot candidates using a secure email link and OTP.
8. Candidate completes a timed assessment with back navigation, autosave and light browser monitoring.
9. Recruiter receives a detailed evidence report. The process ends at the report.

## Assessment tiers

| Tier | Questions | Default time | Future credit usage |
|---|---:|---:|---:|
| Essential | 20 | ~30 minutes | 1 credit |
| Standard | 30 | ~45 minutes | 1.5 credits |
| Advanced | 40 | ~60 minutes | 2 credits |

Credits are **not charged in V3.2**. These values are stored now so the next payment build can enforce the correct cost per candidate.

## V3.2 report

The report is based only on actual assessment evidence and includes:

- Candidate Assessment Summary
- Evidence From Stronger Responses
- Areas to Explore Further
- Performance by Competency, including the areas actually tested
- Performance by Question Type
- Response Pattern and Timing
- Suggested Interview Validation
- Detailed Question Evidence
- Short assessment limitations disclaimer

The report does not state that untested capabilities are strengths or weaknesses, does not verify work history or qualifications, and does not make the hiring decision.

## Vercel Hobby architecture

`api/router.js` is the **only** JavaScript file in `api/`. All endpoint handlers remain in `server/` and are routed through `vercel.json`. Do not move server handlers into the `api` folder.

## Required environment variables

Keep the existing Firebase, Resend and candidate-session settings. For the current generation configuration use:

```text
OPENAI_QUESTION_MODEL=gpt-5.6-terra
OPENAI_FOCUS_MODEL=gpt-5.6-terra
OPENAI_REASONING_EFFORT=low
```

No new V3.2 environment variables or Firebase migrations are required.

## Security

Never upload `.env.local`, Firebase service-account JSON, API keys, candidate tokens or real candidate data to GitHub.

## Testing

Run `npm test` in GitHub Actions. The V3.2 package contains **55 automated tests**, including the prior V3.1 quality, candidate and routing safeguards plus tests for assessment tiers, compact dropdowns and richer report sections. Live OpenAI, Firestore, Resend and end-to-end browser behaviour still require a production pilot after deployment.
