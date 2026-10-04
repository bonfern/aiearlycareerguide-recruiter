import { roleCacheKey } from './cache.js';

export const EXTRACTION_VERSION = 'requirements-v1';
export const CATEGORIES = ['Technical', 'Domain', 'Behavioural', 'Leadership', 'Experience', 'Qualification', 'Tools', 'Other'];
export const PRIORITIES = ['Must Have', 'Important', 'Preferred'];
export const SENIORITY = ['Entry', 'Mid', 'Senior', 'Lead', 'Manager', 'Director', 'Executive', 'Unspecified'];

const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const lexical = value => normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function cleanExtraction(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.requirements)) throw new Error('AI returned an invalid extraction');
  const seen = new Set();
  const requirements = [];
  for (const item of raw.requirements.slice(0, 40)) {
    if (typeof item?.text !== 'string') continue;
    const text = normalize(item.text).slice(0, 220);
    if (text.length < 3 || seen.has(lexical(text))) continue;
    seen.add(lexical(text));
    requirements.push({
      text,
      category: CATEGORIES.includes(item.category) ? item.category : 'Other',
      priority: PRIORITIES.includes(item.priority) ? item.priority : 'Important',
      evidence: normalize(item.evidence).slice(0, 300)
    });
  }
  if (!requirements.length) throw new Error('No useful requirements were extracted');
  return {
    roleTitle: normalize(raw.roleTitle).slice(0, 150),
    seniority: SENIORITY.includes(raw.seniority) ? raw.seniority : 'Unspecified',
    experience: normalize(raw.experience).slice(0, 100),
    summary: normalize(raw.summary).slice(0, 800),
    requirements
  };
}

export function validateRecruiterRequirements(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.requirements)) throw new Error('Requirements are missing');
  if (input.requirements.length < 1 || input.requirements.length > 40) throw new Error('Provide 1–40 requirements');
  if (normalize(input.roleTitle).length < 3) throw new Error('Enter the role title');
  const requirements = input.requirements.map((req, i) => {
    const text = normalize(req?.text).slice(0, 220);
    if (text.length < 3) throw new Error(`Requirement ${i + 1} must contain at least 3 characters`);
    return {
      text,
      category: CATEGORIES.includes(req.category) ? req.category : 'Other',
      priority: PRIORITIES.includes(req.priority) ? req.priority : 'Important',
      evidence: normalize(req.evidence).slice(0, 300)
    };
  });
  const keys = requirements.map(r => lexical(r.text));
  if (new Set(keys).size !== keys.length) throw new Error('Remove duplicate requirements');
  return {
    roleTitle: normalize(input.roleTitle).slice(0, 150),
    seniority: SENIORITY.includes(input.seniority) ? input.seniority : 'Unspecified',
    experience: normalize(input.experience).slice(0, 100),
    summary: normalize(input.summary).slice(0, 800),
    requirements
  };
}

export function requirementSimilarity(a, b) {
  const tokens = text => new Set(lexical(text).split(' ').filter(token => token.length > 2));
  const x = tokens(a), y = tokens(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const token of x) if (y.has(token)) shared++;
  return shared / (x.size + y.size - shared);
}

/** Conservative suggestion; only validated templates, same organization (filtered in query) and same seniority. */
export function findSimilarApprovedRoles(extraction, candidates, jobId, limit = 3) {
  const requestedTitle = lexical(extraction.roleTitle);
  const requestedText = extraction.requirements.map(r => r.text).join(' ');
  const requestedMustHaves = extraction.requirements.filter(r => r.priority === 'Must Have');
  const out = [];
  for (const doc of candidates) {
    const candidate = doc.data ?? doc;
    if (candidate.jobId === jobId || candidate.seniority !== extraction.seniority || !candidate.requirements?.length) continue;
    const titleMatch = requirementSimilarity(requestedTitle, candidate.roleTitle);
    if (titleMatch < 0.65) continue;
    const reqMatch = requirementSimilarity(requestedText, candidate.requirements.map(r => r.text).join(' '));
    if (reqMatch < 0.5) continue;
    const approvedMustHaves = candidate.requirements.filter(r => r.priority === 'Must Have');
    const mustHaveCoverage = approvedMustHaves.length
      ? approvedMustHaves.filter(r => requestedMustHaves.some(req => requirementSimilarity(req.text, r.text) >= 0.65)).length / approvedMustHaves.length
      : 0;
    const score = 0.3 * titleMatch + 0.7 * reqMatch;
    if (mustHaveCoverage < 1 || score < 0.72) continue;
    out.push({jobId: candidate.jobId, title: candidate.roleTitle, seniority: candidate.seniority,
      similarity: Math.round(score * 100), requirements: candidate.requirements});
  }
  return out.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

export function templateKey(orgId, extraction) {
  return roleCacheKey({orgId, title: extraction.roleTitle, seniority: extraction.seniority,
    skills: extraction.requirements.filter(r => r.priority === 'Must Have').map(r => r.text)});
}
