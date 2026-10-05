# Deploy Recruiter Assessment V3.3

## 1. Replace the GitHub files

Extract the V3.3 ZIP and upload the full contents of `recruiter-assessment-v3-3` to the existing Recruiter repository, replacing V3.2 files.

Keep `api/router.js` as the only JavaScript file inside `api/`. Do not move files from `server/` into `api/`.

## 2. Add Razorpay Test Mode credentials in Vercel

In **Vercel → Recruiter Project → Settings → Environment Variables**, add:

```text
RAZORPAY_KEY_ID=<your Razorpay Test Mode Key ID>
RAZORPAY_KEY_SECRET=<your Razorpay Test Mode Key Secret>
```

Do not put these values into GitHub files.

## 3. Configure the platform administrator

Add the email that should be allowed to change package pricing and create coupons:

```text
PLATFORM_ADMIN_EMAILS=your-email@example.com
```

Multiple administrators can be comma-separated.

## 4. Tax setting

For payment testing, use:

```text
RECRUITER_TAX_PERCENT=0
```

Only change this after the business has confirmed the tax treatment to apply to the displayed prices.

## 5. Keep Pilot Mode on for the first deployment

Initially leave:

```text
RECRUITER_PILOT_MODE=true
```

Deploy and verify that the Credit Wallet, package pricing and coupon administration screens display correctly. Payments are intentionally disabled while Pilot Mode is true.

## 6. Enable Razorpay Test Mode payments

When ready to test purchases, change:

```text
RECRUITER_PILOT_MODE=false
```

Redeploy. The wallet will now allow Test Mode Razorpay checkout.

## 7. Recommended payment test

1. Sign in as the Platform Administrator.
2. Confirm the 5 / 10 / 20 / 50 / 100 credit package prices.
3. Create a test coupon, for example `TEST10` for 10%.
4. Buy the 5-credit Starter package using Razorpay Test Mode.
5. Confirm the wallet balance increases only after successful payment verification.
6. Publish a 20-question Essential assessment.
7. Invite one candidate. Confirm 1 credit moves from Available to Reserved.
8. Open the candidate link, verify the email and start the assessment. Confirm the reserved 1 credit is consumed once.
9. Invite another candidate and delete that invitation before it starts. Confirm the reservation is released.
10. Test Standard (1.5 credits) and Advanced (2 credits) in the same way.

## 8. Before Live Mode

Complete Razorpay account activation and replace the Test Mode keys with Live Mode keys. Keep the keys only in Vercel. Run one controlled low-value live transaction before making the Recruiter product publicly available.
