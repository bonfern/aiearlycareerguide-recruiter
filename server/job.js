import { requireRecruiter, reject } from './_auth.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({error: 'Method not allowed'});
  const user = await requireRecruiter(req);
  if (user.error) return reject(res, user);
  const id = req.query?.id;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9]{10,40}$/.test(id)) return res.status(400).json({error: 'Invalid job ID'});
  try {
    const snapshot = await user.db.collection('recruiter_jobs').doc(id).get();
    if (!snapshot.exists || snapshot.data().orgId !== user.orgId) return res.status(404).json({error: 'Job not found'});
    const data = snapshot.data();
    return res.status(200).json({job: {
      id: snapshot.id, title: data.title, department: data.department, jdText: data.jdText,
      status: data.status, extraction: data.extraction || null,
      approvedRequirements: data.approvedRequirements || null, extractionSource: data.extractionSource || null,
      assessmentFocusDraft: data.assessmentFocusDraft || null,assessmentFocusApproved: data.assessmentFocusApproved || null,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null
    }});
  } catch (error) { console.error('job API error', error); return res.status(500).json({error: 'Unable to load this job'}); }
}
