import { requireRecruiter, reject } from './_auth.js';
import { validateRecruiterRequirements, templateKey } from '../lib/extraction.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});
  const user = await requireRecruiter(req);
  if (user.error) return reject(res, user);
  const {jobId} = req.body || {};
  if (typeof jobId !== 'string' || !/^[a-zA-Z0-9]{10,40}$/.test(jobId)) return res.status(400).json({error: 'Invalid job ID'});
  let approved;
  try { approved = validateRecruiterRequirements(req.body?.approved); }
  catch (error) { return res.status(400).json({error: error.message}); }
  try {
    const jobRef = user.db.collection('recruiter_jobs').doc(jobId);
    const job = await jobRef.get();
    if (!job.exists || job.data().orgId !== user.orgId) return res.status(404).json({error: 'Job not found'});
    if (!job.data().extraction) return res.status(409).json({error: 'Extract the JD before approving requirements'});
    if (job.data().approvedRequirements) return res.status(409).json({error: 'Requirements have already been approved'});
    const templateRef = user.db.collection('approved_role_templates').doc();
    const now = new Date();
    const batch = user.db.batch();
    batch.update(jobRef, {approvedRequirements: approved, status: 'requirements_approved', updatedAt: now});
    batch.set(templateRef, {orgId: user.orgId, jobId, roleTitle: approved.roleTitle,
      seniority: approved.seniority, requirements: approved.requirements,
      templateKey: templateKey(user.orgId, approved), createdAt: now, version: 1});
    await batch.commit();
    return res.status(200).json({ok: true, jobId, approvedRequirements: approved});
  } catch (error) { console.error('Approve requirements failed', error); return res.status(500).json({error: 'Unable to approve requirements'}); }
}
