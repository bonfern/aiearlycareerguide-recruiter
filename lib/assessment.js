import {createHash, randomUUID} from 'node:crypto';
import {requirementSimilarity} from './extraction.js';

export const QUESTION_VERSION = 'choice-v1';
export const SIZES = [15, 25, 40];
export const TYPES = ['Knowledge', 'Situational judgement', 'Problem solving', 'Leadership', 'Stakeholder management'];
const canon = value => String(value ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');
const clean = (v, max) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

/** Include all recruiter-validated requirements (including priority) in the exact cache key. */
export function assessmentSignature(orgId, approved) {
  if (!orgId || !approved?.roleTitle || !Array.isArray(approved.requirements)) throw new Error('Invalid role');
  const parts = [QUESTION_VERSION, orgId, canon(approved.roleTitle), canon(approved.seniority), canon(approved.experience),
    ...approved.requirements.map(r => [canon(r.text), canon(r.category), canon(r.priority)].join('|')).sort()];
  return createHash('sha256').update(parts.join('::')).digest('hex');
}

export function cleanQuestions(input, approved, {strict = true} = {}) {
  if (!Array.isArray(input) || input.length > 40) throw new Error('Assessment contains too many questions');
  const seen = new Set();
  return input.map((item, i) => {
    const text = clean(item?.text, 650);
    const options = Array.isArray(item?.options) ? item.options.map(x => clean(x, 260)) : [];
    const correctIndex = Number(item?.correctIndex);
    const index = Number(item?.requirementIndex);
    if (text.length < 25) throw new Error(`Question ${i + 1}: add a complete question`);
    if (options.length !== 4 || options.some(x => x.length < 2) || new Set(options.map(canon)).size !== 4) {
      throw new Error(`Question ${i + 1}: provide four different answer choices`);
    }
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) throw new Error(`Question ${i + 1}: choose the best answer`);
    if (!Number.isInteger(index) || index < 0 || index >= approved.requirements.length) throw new Error(`Question ${i + 1}: select a JD requirement`);
    if (seen.has(canon(text))) throw new Error(`Duplicate question ${i + 1}`);
    seen.add(canon(text));
    const rationale = clean(item.rationale, 700);
    if (strict && rationale.length < 12) throw new Error(`Question ${i + 1}: explain why the answer is best`);
    return {id: typeof item.id === 'string' && /^[a-zA-Z0-9-]{8,50}$/.test(item.id) ? item.id : randomUUID(),
      text, options, correctIndex, requirementIndex: index,
      type: TYPES.includes(item.type) ? item.type : 'Knowledge', rationale,
      source: ['exact-cache', 'similar-cache', 'ai', 'edited'].includes(item.source) ? item.source : 'edited'};
  });
}

/** Published recruiter-approved templates only, restricted to the authenticated org upstream. */
export function reusableQuestions(approved, templates, targetCount, orgId) {
  const signature = assessmentSignature(orgId, approved);
  const exact = templates.find(t => t.orgId === orgId && t.signature === signature && Array.isArray(t.questions) && t.questions.length >= targetCount);
  if (exact) {
    const reindex = exact.requirements.map(old => approved.requirements.findIndex(now =>
      canon(now.text) === canon(old.text) && now.priority === old.priority && now.category === old.category));
    if (reindex.every(x => x >= 0)) {
      const choices = exact.questions.slice(0, targetCount).map(q => ({...q, id: randomUUID(), requirementIndex: reindex[q.requirementIndex], source: 'exact-cache'}));
      if (choices.every(q => q.requirementIndex >= 0)) return {questions: cleanQuestions(choices, approved), source: 'exact-cache', reused: choices.length};
    }
  }
  // Conservative similarity gating: same role/seniority and coverage of ALL must-have requirements in both directions.
  const similar = templates.filter(t => {
    if (t.orgId !== orgId || t.seniority !== approved.seniority || !Array.isArray(t.requirements) || !Array.isArray(t.questions)) return false;
    if (requirementSimilarity(t.roleTitle, approved.roleTitle) < 0.8) return false;
    const left = approved.requirements.filter(x => x.priority === 'Must Have');
    const right = t.requirements.filter(x => x.priority === 'Must Have');
    if (!left.length || !right.length) return false;
    return left.every(r => right.some(s => s.category === r.category && requirementSimilarity(r.text, s.text) >= 0.78)) &&
      right.every(r => left.some(s => s.category === r.category && requirementSimilarity(r.text, s.text) >= 0.78));
  });
  const maxReusable = Math.floor(targetCount * 0.6); // Remaining questions tailored to this JD.
  const candidates = [];
  const seen = new Set();
  for (const tmpl of similar.slice(0, 12)) {
    for (const q of tmpl.questions) {
      const oldReq = tmpl.requirements[q.requirementIndex];
      if (!oldReq) continue;
      const index = approved.requirements.findIndex(newReq => newReq.category === oldReq.category &&
        newReq.priority === oldReq.priority && requirementSimilarity(newReq.text, oldReq.text) >= 0.78);
      if (index < 0 || seen.has(canon(q.text))) continue;
      try {
        const [verified] = cleanQuestions([{...q, id: randomUUID(), requirementIndex: index, source: 'similar-cache'}], approved);
        seen.add(canon(q.text)); candidates.push(verified);
      } catch { /* Never reuse malformed published items. */ }
      if (candidates.length >= maxReusable) return {questions: candidates, source: 'similar-cache', reused: candidates.length};
    }
  }
  return {questions: candidates, source: candidates.length ? 'similar-cache' : 'new', reused: candidates.length};
}

/** Prioritize Must Have > Important > Preferred and fill under-covered requirements first. */
export function nextRequirements(approved, existing, amount) {
  const counts = approved.requirements.map(() => 0);
  for (const q of existing) if (Number.isInteger(q.requirementIndex) && counts[q.requirementIndex] !== undefined) counts[q.requirementIndex]++;
  const weights = { 'Must Have': 3, 'Important': 2, 'Preferred': 1 };
  const indices = [];
  for (let i = 0; i < amount; i++) {
    const index = counts.reduce((best, count, idx) => (count / weights[approved.requirements[idx].priority] <
      counts[best] / weights[approved.requirements[best].priority] ? idx : best), 0);
    indices.push(index); counts[index]++;
  }
  return indices;
}
