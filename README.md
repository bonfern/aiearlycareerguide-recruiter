# AI Early Career Guide — Recruiter Assessment V3.3

Independent Recruiter application for `https://recruiter.aiearlycareerguide.com`. The Student and Professional assessments remain in their existing repository and Vercel deployment.

## Start here

Read **[DEPLOY-V3.3.md](DEPLOY-V3.3.md)** before replacing the files in GitHub.

V3.3 retains the V3.2 assessment and reporting model and adds the commercial layer: credit wallet, configurable packages, coupons and Razorpay checkout.

## Current product flow

1. Recruiter signs in.
2. Create a Job and upload/paste a JD.
3. AI extracts requirements; recruiter reviews and approves them.
4. AI proposes the most important testable technical/domain and job-related behavioural competencies only.
5. Recruiter chooses Essential, Standard or Advanced and approves the assessment focus.
6. AI plans distinct topics, generates and quality-checks questions; recruiter reviews and publishes.
7. Recruiter purchases assessment credits.
8. Candidate invitation reserves the appropriate credits. Credits are consumed only when that candidate actually starts.
9. Candidate completes the timed assessment.
10. Recruiter receives the evidence report. The process ends at the report.

## Assessment credit usage

| Tier | Questions | Default time | Credit usage per candidate |
|---|---:|---:|---:|
| Essential | 20 | ~30 minutes | 1 credit |
| Standard | 30 | ~45 minutes | 1.5 credits |
| Advanced | 40 | ~60 minutes | 2 credits |

Two internal units equal one credit, so half-credit usage is stored as integers rather than floating-point balances.

## Credit packages

Default launch prices can be changed from the Platform Administrator section without changing code.

| Package | Credits | Default price |
|---|---:|---:|
| Starter | 5 | ₹1,495 |
| Basic | 10 | ₹2,790 |
| Standard | 20 | ₹4,980 |
| Growth | 50 | ₹10,950 |
| Business | 100 | ₹19,900 |

Coupons can be percentage or fixed-amount discounts, with optional expiry dates, usage limits and minimum package sizes.

## Credit lifecycle

- Buying credits adds them only after Razorpay payment-signature verification and a server-side check that the payment is captured.
- Inviting a candidate reserves the tier cost, preventing over-inviting beyond the available balance.
- Starting the assessment consumes the reservation exactly once.
- Deleting an unstarted invitation or allowing it to expire releases the reservation.
- Existing pilot/legacy invitations are not retroactively charged.
- `Sync Recent Payments` can recover a captured Razorpay payment if the browser callback was interrupted.

## Vercel Hobby architecture

`api/router.js` remains the **only deployable API function**. All handlers stay in `server/`, including the new wallet handler. This keeps the project within the Vercel Hobby function limit.

## Required environment variables

Keep all existing Firebase, OpenAI, Resend and candidate-session variables. V3.3 adds:

```text
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
PLATFORM_ADMIN_EMAILS=your-admin-email@example.com
RECRUITER_TAX_PERCENT=0
RECRUITER_PILOT_MODE=true
```

Use Razorpay **Test Mode** keys first. When payment testing is ready, set `RECRUITER_PILOT_MODE=false` so the wallet and credit rules become active. Set the tax percentage only after confirming the applicable tax treatment for the business.

## Security

- Never expose `RAZORPAY_KEY_SECRET`, Firebase Admin credentials or candidate-session secrets to browser code or GitHub.
- Package prices, coupons, payment amount and credit quantities are recalculated on the server.
- Razorpay checkout success is not trusted by itself: the server validates the HMAC signature and fetches the payment before adding credits.
- Credit purchases and assessment usage are recorded in an organisation-level credit ledger.

## Testing

V3.3 contains **60 automated tests**. These cover the previous assessment, report, candidate, caching and Vercel safeguards plus package structure, fractional credit accounting, coupon calculations, Razorpay UI wiring and candidate credit consumption. Live Razorpay, Firebase, Resend and end-to-end browser testing still need to be completed on the deployed Test Mode environment.
