import { requireRecruiter, reject } from './_auth.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireRecruiter(req);
  if (user.error) return reject(res, user);
  const orgDoc = await user.db.collection('recruiter_organizations').doc(user.orgId).get();
  return res.status(200).json({
    email: user.email,
    role: user.role,
    organizationName: orgDoc.data()?.name || 'Recruiter Team'
  });
}
