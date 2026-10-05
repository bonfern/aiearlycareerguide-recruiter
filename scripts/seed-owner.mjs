import { firebaseAdmin } from '../server/_firebase.js';

const email = process.env.OWNER_EMAIL?.trim();
const name = process.env.ORGANIZATION_NAME?.trim() || 'Recruiter Team';
if (!email) throw new Error('OWNER_EMAIL is required in .env.local');
const { auth, db } = firebaseAdmin();
const user = await auth.getUserByEmail(email); // Create user in NEW Firebase Auth console first.
const existing = await db.collection('recruiter_members').doc(user.uid).get();
if (existing.exists) {
  console.log('Owner membership already exists. No changes made.');
  process.exit(0);
}
const org = db.collection('recruiter_organizations').doc();
const batch = db.batch();
batch.set(org, { name, status: 'active', creditBalanceUnits: 0, creditReservedUnits: 0, createdAt: new Date(), createdByUid: user.uid });
batch.set(db.collection('recruiter_members').doc(user.uid), {
  orgId: org.id, email: user.email, role: 'owner', status: 'active', createdAt: new Date()
});
await batch.commit();
console.log(`Created organization "${name}" and owner membership for ${email}.`);
