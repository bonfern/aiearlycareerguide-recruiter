import { requireRecruiter, reject } from './_auth.js';
import { jdFingerprint } from '../lib/cache.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const user = await requireRecruiter(req);
  if (user.error) return reject(res, user);
  const { db, orgId, uid } = user;
  try {
    if (req.method === 'GET') {
      const snapshot = await db.collection('recruiter_jobs')
        .where('orgId', '==', orgId).limit(100).get();
      const jobs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          status: data.status,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
          candidateCount: data.candidateCount || 0,
          completedCount: data.completedCount || 0
        };
      }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return res.status(200).json({ jobs });
    }
    const { title, department = '', jdText } = req.body || {};
    if (typeof title !== 'string' || title.trim().length < 3 || title.length > 150 ||
        typeof jdText !== 'string' || jdText.trim().length < 50 || jdText.length > 30000 ||
        typeof department !== 'string' || department.length > 100) {
      return res.status(400).json({ error: 'Enter a job title (3–150 characters) and JD (50–30,000 characters).' });
    }
    const doc = db.collection('recruiter_jobs').doc();
    await doc.set({
      orgId, createdByUid: uid,
      title: title.trim(), department: department.trim(), jdText: jdText.trim(),
      jdHash: jdFingerprint(jdText),
      status: 'draft', candidateCount: 0, completedCount: 0,
      createdAt: new Date(), updatedAt: new Date()
    });
    return res.status(201).json({ id: doc.id, title: title.trim(), status: 'draft' });
  } catch (error) {
    console.error('jobs API error:', error);
    return res.status(500).json({ error: 'Unable to process jobs right now.' });
  }
}
