# Assessment V2 — approved release specification

| Assessment length | Competency groups | Default duration | Purpose |
|---|---:|---:|---|
| 20 questions | 4 | 30 minutes | Focused initial screen |
| 30 questions | 5 | 45 minutes | General recruitment |
| 40 questions | 6 | 60 minutes | Complex or senior roles |

## Workflow

**JD upload → AI requirement extraction → recruiter approves JD requirements → AI proposes most critical 4/5/6 competency groups → recruiter edits and approves competencies plus question quotas → AI generates questions with org-scoped V2 cache → recruiter reviews the entire answer key and publishes → individual candidate invitations → timed candidate assessment → grouped evidence report.** End there; the system does not make hiring decisions.

### Guardrails

- Focus groups map to **approved, testable requirements**. Experience and formal qualifications remain eligibility checks, not performance items.
- The default distribution assigns at least three questions per approved group, with full count coverage enforced on save and publish.
- The AI writes question text, choices and explanations; group/requirement mappings are imposed and validated by the server.
- Recruiter-edited and approved questions alone enter the V2 reuse pool upon publication. Similar-role question reuse is capped at 60%; exactly matching focus can reuse all questions. This is an org-scoped cache; no cross-org leakage.
- Candidate answers are scored against the originally published key. New profile text never changes original question evidence or the score.
- The descriptive report differentiates group performance from *evidence depth* (3–4 items: directional, 5+: broader), not unvalidated psychometric confidence. It separately identifies uncovered critical requirements and independently verifiable eligibility criteria.
- Retain complete question, all choices, selected/correct answer, explanation, estimated question time, answer revisions and the browser-integrity log. No automatic adverse inference from browser events or quick answers.

## Versioning / migration

V1 and V2 are distinguished by `questionVersion` (`choice-v1` versus `critical-competencies-v2`) and, for the report, `reportVersion` (new reports only). Existing `recruiter_assessments`, invitations and saved `recruiter_reports` are never rewritten. V2 has a different question-template signature and uses only V2-approved templates. No Firestore migrations or Vercel plan upgrades are necessary.

## Deferred

Paid credit packs (5 / 10 / 20 / 50 / 100 / custom), coupon rules, Razorpay checkout and bulk-candidate billing are **not included** in this release. Keep `RECRUITER_PILOT_MODE=true` until payment safeguards have been implemented and tested.
