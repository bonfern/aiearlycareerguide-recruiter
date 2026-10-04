# AI Early Career Guide — Recruiter Assessment | Step 4

**Independent recruiter-only application.** Does not change either existing Student or Professional assessment. Step 4 adds secure candidate invitations, email OTP, timed exams with back navigation and server autosave, optional fullscreen, browser activity logs, a complete objective evidence report, and owner-controlled permanent deletion. Existing Steps 1–3 JDs, approved requirements and published questions remain usable.

## IMPORTANT: Hobby-plan deployment fix (October 2026)

This package replaces the previously uploaded Step 4 ZIP. The original had too many `api/*.js` files for Vercel Hobby's 12-function limit. This package uses **one** deployable function (`api/router.js`) and moves internal handlers into `server/`. Existing `/api/...` URLs continue to work through `vercel.json` rewrites. No new Firebase collections, environment variables, domains or accounts are necessary compared with Step 4.

**GitHub update (critical):** Upload all files from this ZIP **and delete ALL previous `api/*.js` files except the NEW `api/router.js`**. Uploading a ZIP's contents through GitHub's normal uploader adds/replaces files, but **does not delete old files**. If the old API files remain, Vercel will still count them and the deployment will fail. The easiest no-install method: on your GitHub repository press **`.`** to open the web editor; delete the existing `api/` folder, upload/drag the new package's folder contents including `api/` and `server/`, commit all changes, then redeploy. Alternatively use GitHub's normal file editor to delete old API files one by one before uploading.

## Deploy using GitHub + Vercel (NO local Node.js required)

1. Extract `recruiter-assessment-step4.zip`. In your **recruiter-only GitHub repository**, upload the **contents** of the extracted folder into the repository root and replace the existing files (`index.html`, `app.js`, `style.css`, `api/`, `lib/`, etc.). Keep existing Firebase and Vercel projects and the existing Student / Professional repository unchanged. Do not upload an outer `recruiter-assessment-step4` folder.
2. In **Vercel → Recruiter project → Settings → Environment Variables**, keep your existing Firebase and `OPENAI_API_KEY` settings. Add the five settings below for the **Recruiter Vercel project only**:

   | Variable | Value / where to obtain it |
   | --- | --- |
   | `RESEND_API_KEY` | API key from [Resend](https://resend.com/api-keys) with email-send permission. |
   | `RECRUITER_FROM_EMAIL` | Verified sender on your Resend account, e.g. `AI Early Career Guide <assessments@aiearlycareerguide.com>` **ONLY once you have verified that sender's domain with Resend**. |
   | `CANDIDATE_SESSION_SECRET` | A **new**, unique randomly generated 48+ character secret; never share it or commit it. Changing it invalidates current candidate sessions and encrypted invitation-link storage. |
   | `RECRUITER_BASE_URL` | `https://recruiter.aiearlycareerguide.com` (without trailing slash). |
   | `RECRUITER_PILOT_MODE` | `true` for your controlled, **maximum five active invitations per JD** trial. If absent or set to anything else, candidate creation is blocked until credits are implemented. |

   You **must verify your sending domain inside the Resend account that owns the new API key**. Resend will show any required SPF/DKIM DNS records. Copy exactly those records; do not overwrite your existing site's A or CNAME records. If your existing Resend account has already verified the domain, use its verified sender. Treat all API keys and the session secret as private Vercel environment variables. Don't put them in GitHub secrets unless a future workflow explicitly needs them.
3. Once GitHub triggers a successful Vercel build, go to `https://recruiter.aiearlycareerguide.com`. Existing login and JDs should be unchanged.
4. Open a **published** assessment. Under **Candidates & evidence reports**, choose the duration (defaults: 15 questions/25 minutes, 25/40, 40/60; adjustable 10–120 minutes) and select **Save duration**. **Duration locks at the first invitation.** Published Step 3 assessments work without regenerating.
5. Add your own **test candidate name and email** and click **Send secure invitation**. The invitation is sent automatically via Resend and a secure link appears for manual copying. If email delivery fails, fix the sender-domain configuration and use **Resend email**. The link alone does not permit entry; candidate must retrieve the email OTP.
6. Open the invitation in a **separate browser or incognito window**. Click **Email verification code**, enter the six-digit code received, review the privacy/timer notice, check the acknowledgement box, and select **Start assessment**. Test back navigation, changed answers, and a tab switch. Your time does not pause on tab switches or disconnections. Optional fullscreen may be unavailable on some devices.
7. Submit normally (or allow the clock to expire). In the recruiter dashboard, open the same JD → **Candidates & evidence reports** → **View report**. Verify all questions, answer options, the candidate's answer, best answer, explanation, changes, time, score, requirements and browser activity. Select **Print / save PDF** to print or save from the browser.
8. You can permanently delete any test candidate's invitation, responses, browser log and report using **Delete**. Only the organisation owner can delete; use this for your trial and to respond to deletion requests. This version has no automated retention deletion yet. Decide on and implement an appropriate retention schedule before a public launch.

## Pilot safeguards and boundaries

- **Payment is not implemented yet.** No credits are charged or deducted during Step 4. Invitations fail closed unless `RECRUITER_PILOT_MODE=true`, and are limited to five per JD. Implement Razorpay credits/coupon verification with transactional credit reservation in the next build before inviting paying customers.
- Each candidate receives a **32-byte random invitation token**, encrypted at rest for controlled recruiter resend, plus a separate six-digit OTP (**10-minute expiry, five guesses per code, max five OTP emails per invitation, at least one minute between sends**). Candidate session tokens are HMAC-signed, bound to a single active session and expire after 12 hours. An additional verification revokes the previous candidate session. The code/secret and answer keys are never returned to the browser.
- Questions and answer choices are shuffled **per candidate**. They currently come from the same recruiter-approved published question set; truly distinct equivalent forms will require a larger vetted question bank and psychometric testing. Do not claim that the shuffled versions establish statistical equivalence.
- The **server determines the deadline**, scores from the recruiter-approved answer key and calculates active per-question time from server timestamps + browser foreground signals. Client timers are purely visual. Offline/disconnected candidates resume if within their allotted duration; expiry is finalized when the candidate reconnects or the recruiter opens the JD. No timer pause is granted by disconnecting.
- Browser monitoring logs **only** declared events (tabs, window focus, copy/paste, fullscreen exit, online/offline and 90-second inactivity). It never takes webcam snapshots, records video, accesses the microphone, reads another device or declares cheating. Browsers can miss events. Logs and time spent are supporting context, **not misconduct proof**.
- Requirements with fewer than **three assessed questions** are labelled **Insufficient evidence** regardless of score. Reports deliberately show descriptive evidence, not a hire/reject decision. A recruiter must validate AI-drafted answer keys and question quality before publishing.
- Existing **same-organisation approved question caching** from Step 3 is unchanged; candidate answers and reports are neither included nor reused in the cache. Org membership is checked for every recruiter API. All direct Firestore browser reads/writes remain denied.

## Data collections

Existing: `recruiter_jobs`, `recruiter_assessments`, approved role/cache collections, `recruiter_organizations`, `recruiter_members`.

New: `recruiter_invitations/{sha256(invitationToken)}` (only encrypted token, name/email, OTP digest/rate counters, verification, timer, answer records, per-question time and bounded browser events); `recruiter_reports/{invitationId}` (server-produced individual evidence report). Organisation ID is saved in both. The report API checks the signed-in recruiter's organisation.

## Testing and operational notes

`npm test` (run in GitHub Actions, or optionally locally) covers question-cache isolation, OTP/session signatures, answer-key non-disclosure, duration checks, per-question timing, scoring, competency uncertainty and integrity reporting. **Automated tests do not constitute a live Firebase/Resend/Vercel end-to-end test**. Before paid release, test real emails (including spam/delivery), expiry, reconnection, deletion, accessibility and a candidate using a second device. Review Indian data-protection obligations and present a suitable privacy notice to real candidates.

This implementation is **a controlled pilot**, not a production-ready payment or high-stakes proctoring system. If Vercel deployment fails, share the deployment error (never share private keys or candidate data). Keep existing Firebase Firestore production rules denying direct browser access.
