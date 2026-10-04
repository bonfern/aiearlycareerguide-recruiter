# Recruiter assessment roadmap — current: Step 4 controlled pilot

- Step 1 (complete): independent recruiter login, organisation-scoped Firestore and multiple-JD dashboard.
- Step 2 (complete): JD extraction / approval, exact JD cache.
- Step 3 (complete): editable 15/25/40-question sets and organisation-scoped published question reuse.
- **Step 4 (this package):** 5-candidate-per-JD controlled pilot; Resend invitation email, one-time code and signed session; configurable server timer, autosaved answers, back navigation, shuffled questions/options, declared browser-monitoring events; full answer-by-answer report, competency evidence, timing and event log. Owner deletion.
- **Step 5 (next):** Prepaid assessment packages 5/10/20/50/100/200+, coupon codes and Razorpay webhook verification. Atomic credit reservation on candidate start, idempotent consumption on first start, release of unused/expired invitations, ledger/refunds and admin pricing/coupon controls. Replace `RECRUITER_PILOT_MODE` gate with server-side credit gating and anti-overspending transactions.
- Step 6 (pre-launch): consent/privacy review; automated retention purge, audit controls; broader question bank and fairness/reliability pilots, usability and load testing, robust retry queues, candidate accommodations and independent security review.

Payment and hiring decisions are **outside** the Step 4 pilot. Do not activate unrestricted invitations or claim webcam proctoring / cheating detection.
