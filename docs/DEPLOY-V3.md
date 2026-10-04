# Recruiter V3 — Step-by-step release

1. Replace **all** files in your existing Recruiter GitHub repository with the ZIP's root contents. Keep `.github/workflows` and the `assets` directory.
2. Check the `api` directory: it must contain **only `router.js`**. All other API handlers belong in `server/`.
3. In Vercel, set `OPENAI_QUESTION_MODEL=gpt-5.6-sol` and `OPENAI_REASONING_EFFORT=high`. Your OpenAI API project must have access to that model. Keep `OPENAI_API_KEY`, Firebase service-account values, Firebase Web App values, Resend settings and existing pilot settings.
4. Trigger deployment by committing to the Recruiter repository. Check `Deployments → Ready`; do not upgrade Vercel to Pro solely for the number of API files.
5. Sign in at `https://recruiter.aiearlycareerguide.com`. Create a **new** 20-question test JD. Generate/approve competency focus and create a draft.
6. Generate the blueprint and question batches. Review, edit, save, then publish. Existing published assessments are not modified.
7. Invite a pilot candidate, verify by email OTP, complete the timed assessment and check the new report. Print as PDF with browser Headers and footers **off**.
8. If a batch is rejected as repetitive or a model request times out, choose **Continue generation**. The saved blueprint and previously completed batches remain available. If the current model is unavailable to your OpenAI API account, change `OPENAI_QUESTION_MODEL` to another reasoning-capable model available to that account and redeploy.
9. Before commercial release, independently check question difficulty and answer validity across several roles. Rule-based duplication checks reduce but cannot eliminate semantic repetition or dubious answer keys.
