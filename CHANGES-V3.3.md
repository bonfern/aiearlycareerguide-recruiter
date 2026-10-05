# V3.3 Changes

- Added organisation Credit Wallet with Available, Reserved and Total Credit balances.
- Added Starter 5, Basic 10, Standard 20, Growth 50 and Business 100 credit packages.
- Added Platform Administrator controls to update package prices without code changes.
- Added percentage and fixed-amount coupons with expiry, usage-limit and minimum-package options.
- Added Razorpay checkout using server-created orders.
- Added server-side Razorpay payment signature verification and captured-payment verification before credits are granted.
- Added payment reconciliation through **Sync Recent Payments**.
- Essential / Standard / Advanced assessments now reserve 1 / 1.5 / 2 credits respectively when a candidate is invited.
- Reserved credits are consumed once when the candidate starts, not when the invitation is sent.
- Unstarted expired/deleted invitations release reservations.
- Added credit purchase and assessment-usage ledger entries.
- Preserved V3.2 question generation, reporting, branding and compact dropdowns.
- Preserved the single Vercel API router for Hobby-plan compatibility.
