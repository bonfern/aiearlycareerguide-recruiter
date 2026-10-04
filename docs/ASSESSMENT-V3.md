# Assessment V3 — Functional acceptance criteria

**Audience:** Recruiter application owner and testers. **Scope:** new assessments only.

1. **Recruiter controls:** Choose 20/30/40 questions; AI proposes 4/5/6 competency groups; recruiter edits groups, requirement mappings and question counts before approval. No assessment is created without an approved focus.
2. **Blueprint:** One full-assessment plan with different `topicTitle`, `scenario`, `decisionTarget` and `difficulty` per question. Overlapping topics within a competency or identical topics across groups are rejected.
3. **Question generation:** Four choices per question, plausible alternatives, one defensible preferred answer, clear rationale, mapping to the approved group and question blueprint. Batch size four; saved progress is never thrown away on retry.
4. **Quality:** Reject duplicate or near-duplicate stems, repeated topic titles, common cartoonish distractors, some obvious group-mapping errors, and answers made conspicuously longer than alternatives. A recruiter reviews for genuine substantive overlap, cultural fairness, current regulatory accuracy and answer ambiguity before publication. A quality check cannot guarantee a perfectly discriminating assessment.
5. **Cache:** Only templates **published by a recruiter in the same organisation** and created with V3 may be reused. Identical role signatures can reuse an approved question blueprint; exact topic-level matches can reuse at most 35% of questions for a newly created JD.
6. **Candidate:** Existing unique links, OTP, signed session, 20/30/40 question timings, randomised option and question order, autosave, one-click Next, previous question navigation and last-question Submit remain in place.
7. **Monitoring:** No `window_blur` event is used in V3 reports. A browser-side hidden-tab episode only becomes a reportable event if it lasted at least 10 seconds. A count or duration is never a misconduct conclusion. A server delay by itself creates no tab event.
8. **Report:** Only the tested groups and the candidate's actual answers inform summary, strengths and score. Suggested interview validation explains responses that need exploration, asks deeper applied questions even for perfect scores, and adds essential JD competencies that may need separate practical assessment. Unverified attributes are not claimed in findings. There is no automated hire/reject decision.
9. **Print:** The visible recruiter dashboard, workflow step labels, publication status and unrelated workspace panels are hidden in the PDF. The official logo and `Candidate Assessment Report` appear first. Browser-generated PDF headers must be disabled in the print dialog.
10. **Compatibility:** Historical V1/V2 published assessments and reports remain unchanged. Do not manually modify published Firestore assessment documents to change their version identifiers.

### Pilot acceptance checklist

- Create two similar JDs and one materially different JD; check that questions across **each** assessment test distinct decisions rather than repeated versions of the same scenario.
- Have the recruiter challenge **all four alternatives** for five randomly selected questions; they must be plausible, with the correct answer justified by the question's facts.
- Complete at least one assessment with deliberate wrong answers and one with correct answers. Compare every competency and summary statement with the recorded answer key and selected options.
- Simulate a momentary browser blur and a slow network response: neither should appear as an integrity warning. Then deliberately hide a tab for 12+ seconds and confirm that only the sustained episode is recorded.
- Print and review the executive report and appendix on A4, including mobile access and branding.
- Confirm Vercel builds on the Hobby plan with **one** API entry file and all GitHub Actions tests pass.

### Quality retry

A failed automatic quality review retries its current four-question batch up to two additional times, with a visible message in the recruiter dashboard. Previously generated batches remain stored in Firestore. After repeated failure, the recruiter can continue generation or revise the question plan. Live model access, answer-key accuracy and genuinely difficult distractors still require recruiter verification.
