# Recruiter assessment — Step 4.1: navigation, layout and official branding

**This is the complete replacement package for the existing Step 4 Hobby-plan project.** It keeps the original GitHub repository, Vercel project, Firebase project and subdomain. It does not change your student or professional assessments, published JD/assessment data, the scoring engine, or the candidate credit/pilot limit.

## What changed

- Replaced the optional browser-fullscreen launch with a compact **Focus view** toggle. The exam is always restrained to a readable column; no artificial zoom or forced fullscreen.
- **Next works on the first click even if the candidate's answer is still saving.** The move waits for the save; radio choices briefly lock while saving to prevent a conflicting selection.
- **Review & submit appears only on the final question**. The final question has **Previous** but no **Next**. An explicit confirmation warns about unanswered questions. Auto-submission at expiry is unchanged.
- Ordinary actions and question navigation no longer hide/re-show the entire page or scroll to the global notification bar.
- The dashboard's **My jobs**, and each JD's **Requirements**, **Assessment** and **Candidates/reports** areas can collapse. Each individual question editor can also collapse; only the first draft editor opens by default.
- Uses the official AI Early Career Guide multicolour logo/tagline from the supplied original website assets throughout recruiter and candidate pages, branded report PDFs and invitation/OTP emails. Email apps may block remote images, so the message and sender remain legible without the logo.
- Styling checked for desktop and mobile.

## Deploy: no local Node.js

1. Download and extract `recruiter-assessment-step4-ui-fix.zip`.
2. Open your **Recruiter-only** GitHub repository. Replace the existing files with the *contents* of the extracted folder in the repository root, not inside an extra nested folder. Ensure you upload the new `assets/` directory (including `brand-logo.png` and `brand-icon.png`), the updated `candidate.html`, `candidate.js`, `index.html`, `app.js`, `style.css`, updated email wrapper in `server/_candidate.js` and the rest of the package.
3. Keep the **Hobby fix**: only `api/router.js` must remain directly inside `api/`. If older API files still exist in your repository, delete them; otherwise, no API deletion is necessary.
4. Commit the changes. In Vercel → Recruiter project → Deployments, wait for the new deployment to show **Ready**. If necessary, redeploy that latest commit.
5. There are **no additional Firebase configuration, Vercel environment variables, DNS changes or database migrations**.
6. Open `https://recruiter.aiearlycareerguide.com` and sign in. Open your *existing published JD*, collapse/expand the sections, and create **one new pilot candidate invitation**. A completed invitation cannot be retaken; use a fresh candidate email or have the owner delete the old test candidate record before inviting that email again.
7. On the candidate link: verify email, start, answer a question, click Next immediately, go back to change an answer, try optional Focus view, go to the final question, and check that Next is gone and Review & submit appears. After submitting, inspect the recruiter evidence report and print/save PDF to verify logo placement.

**Testing:** `npm test` (also automatically run through the included GitHub Actions workflow) covers the earlier backend behaviour plus navigation/fold/branding checks. The candidate flow was also tested in a browser against a simulated backend with deliberately delayed answer saving. **Real Firebase/Resend/Vercel testing is still necessary.** Keep `RECRUITER_PILOT_MODE=true` during your controlled pilot; credits and Razorpay come later.
