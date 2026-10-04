# AI Early Career Guide — Recruiter Assessment (Step 1)

**Independent project**: a separate GitHub repository, Vercel project, Firebase project and future AI/payment integrations from the existing Student and Professional assessments. Suggested domain: `recruiter.aiearlycareerguide.com`.

This first build supports recruiter login, a multi-JD dashboard, and creating draft JDs by pasting the text. AI extraction, PDF/DOCX uploads, credits, coupons, candidates and reports are intentionally **not built yet**. See `docs/BUILD-PLAN.md` and `docs/CACHE-STRATEGY.md`.

## 1. Create a NEW Firebase project
1. Open https://console.firebase.google.com and select **Add project**. Give it a distinct name such as `ai-guide-recruiter`.
2. Under **Build → Authentication → Sign-in method**, enable **Email/Password**.
3. Under **Authentication → Users**, add your own email and a strong temporary password. Only create trusted users there; the website has no public signup.
4. Under **Build → Firestore Database**, create a database. Choose a region suitable for your users and select production mode.
5. Publish the provided `firestore.rules` under **Firestore → Rules**. All browser access is denied; Vercel APIs use Firebase Admin and validate each request.
6. Under **Project settings → General → Your apps**, add a Web App. Copy its public config values.
7. Under **Project settings → Service accounts**, generate a **NEW** Admin SDK service-account key for this Firebase project. Keep it private; never upload it to GitHub.

## 2. Create your new GitHub repository
1. Create a new **private** repository called `aiearlycareerguide-recruiter`.
2. Unzip this starter folder on your computer. Upload its **contents** to the new repository (not into the existing student/professional repo).
3. Confirm `.env.local` and service-account JSON files are not committed. `.gitignore` already excludes `.env.*` except `.env.example`.

## 3. Configure and seed the first recruiter locally
1. Install Node.js 20+ and Git if not already installed. Download your new private GitHub project onto your computer, open a terminal in its folder and run `npm install`.
2. Copy `.env.example` to `.env.local`. Fill in credentials from the **new** Firebase project, public Web App fields, `OWNER_EMAIL` matching the Auth user you created and `ORGANIZATION_NAME`.
3. For `FIREBASE_PRIVATE_KEY`, use the service-account `private_key` value with `\\n` inside the quoted environment string. Do not paste the JSON file itself into GitHub.
4. Run `npm run seed:owner` **once**. This creates your organization and grants your Auth user owner access. The script is idempotent if run twice.
5. Run `npm test`. All cache-key tests should pass. `npm run dev` starts the application locally if you have authenticated the Vercel CLI and linked the project.

## 4. Create a NEW Vercel deployment
1. Import the new GitHub repository at https://vercel.com/new as a **new project**; leave Framework Preset at **Other**. Do not attach the existing two assessment deployments to this project.
2. Add all Firebase variables from `.env.example` in **Project → Settings → Environment Variables** (except `OWNER_EMAIL`/`ORGANIZATION_NAME`, used only by the local seed script). Never set `FIREBASE_PRIVATE_KEY` as a public variable.
3. Deploy. Open the provided `.vercel.app` preview and confirm you see the recruiter login.
4. In the **new project**'s **Settings → Domains**, add `recruiter.aiearlycareerguide.com`, then follow Vercel's DNS instructions. Keep the root domain configured for the existing website.
5. In **Firebase Authentication → Settings → Authorized domains**, add the Vercel preview/deployment domain and new recruiter subdomain. Some configurations need a matching `authDomain`; keep it set to your new Firebase project domain unless you have configured custom Firebase Auth hosting.
6. Sign in and test: **Create job → paste at least 50 characters of JD → Save draft → see the new job on the dashboard → sign out**.

## Security / boundaries
- Do not reuse the existing Student/Professional Firebase project, authentication records or service-account credentials.
- Backend verifies Firebase ID tokens and checks the `recruiter_members/{uid}` organization membership before accessing any recruiter data.
- The API gets `orgId` from verified membership, never from the browser's request body.
- Do not add AI or payment keys until the respective phases.
- Initial organization onboarding is administrative, not self-service. Owner invitations and multi-company onboarding will be implemented when required.
