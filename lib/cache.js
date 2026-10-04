import { createHash } from 'node:crypto';

/** Exact-JD lookup for later AI phases. Never hash candidate answers or PII. */
export function normalizeJD(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function jdFingerprint(text) {
  if (!normalizeJD(text)) throw new Error('JD text is required');
  return createHash('sha256').update(normalizeJD(text)).digest('hex');
}

/** Stable organization-scoped role key; semantic matching is a later phase. */
export function roleCacheKey({ orgId, title, seniority = '', skills = [] }) {
  if (!orgId || !title) throw new Error('Organization and title are required');
  const canonical = [
    String(orgId).trim(),
    String(title).trim().toLowerCase().replace(/\s+/g, ' '),
    String(seniority).trim().toLowerCase(),
    [...new Set(skills.map(s => String(s).trim().toLowerCase()).filter(Boolean))].sort().join('|')
  ].join('::');
  return createHash('sha256').update(canonical).digest('hex');
}
