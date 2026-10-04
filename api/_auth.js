import { firebaseAdmin } from './_firebase.js';

/** A verified Firebase ID token is not enough: the user must belong to a recruiter org. */
export async function requireRecruiter(req) {
  const header = req.headers.authorization ?? '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { error: 'Sign in is required', status: 401 };
  try {
    const { auth, db } = firebaseAdmin();
    const decoded = await auth.verifyIdToken(token, true);
    const doc = await db.collection('recruiter_members').doc(decoded.uid).get();
    if (!doc.exists || doc.data().status !== 'active') {
      return { error: 'This account has not been given recruiter access', status: 403 };
    }
    const member = doc.data();
    return { uid: decoded.uid, email: decoded.email, orgId: member.orgId, role: member.role, db };
  } catch {
    return { error: 'Your session has expired or is invalid', status: 401 };
  }
}

export function reject(res, failure) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(failure.status).json({ error: failure.error });
}
