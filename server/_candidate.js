import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {firebaseAdmin} from './_firebase.js';
import {sha256,verifyCandidateSession,buildReport} from '../lib/candidate.js';

const key = () => {
  const secret=process.env.CANDIDATE_SESSION_SECRET;
  if(!secret || secret.length<32) throw new Error('CANDIDATE_SESSION_SECRET must be configured (32+ characters)');
  return createHash('sha256').update(secret).digest();
};
export function encryptInvite(token){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);
  const bytes=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),bytes.toString('base64url')].join('.');}
export function decryptInvite(packed){const [iv,tag,body]=String(packed).split('.');
  const dec=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64url'));
  dec.setAuthTag(Buffer.from(tag,'base64url'));
  return Buffer.concat([dec.update(Buffer.from(body,'base64url')),dec.final()]).toString('utf8');}
export function inviteUrl(token){const base=process.env.RECRUITER_BASE_URL||'https://recruiter.aiearlycareerguide.com';
  if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base))throw new Error('Invalid RECRUITER_BASE_URL');
  return `${base}/candidate.html?invite=${encodeURIComponent(token)}`;}
export async function sendEmail(to,subject,html){const sender=process.env.RECRUITER_FROM_EMAIL;
  if(!process.env.RESEND_API_KEY || !sender) throw new Error('RESEND_API_KEY and RECRUITER_FROM_EMAIL are required');
  const base=process.env.RECRUITER_BASE_URL||'https://recruiter.aiearlycareerguide.com';
  const brandLogo=/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)?`${base}/assets/brand-logo.png`:'https://recruiter.aiearlycareerguide.com/assets/brand-logo.png';
  const brandedHtml=`<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#102448;line-height:1.65">
    <div style="border-bottom:1px solid #dfe8ed;padding:12px 0 18px"><img src="${brandLogo}" width="218" alt="AI Early Career Guide" style="display:block;width:218px;max-width:100%;height:auto"/>
    <p style="font-size:13px;color:#167c83;margin:7px 0 0;font-weight:700">Recruiter Assessment</p></div>
    <div style="padding:15px 0">${html}</div>
    <div style="border-top:1px solid #dfe8ed;margin-top:15px;padding:14px 0;color:#627489;font-size:12px">AI Early Career Guide · Explore Today. Brighter Tomorrows.</div></div>`;
  const result=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:sender,to:[to],subject,html:brandedHtml})});
  if(!result.ok){console.error('Resend delivery returned status',result.status);throw new Error('Email delivery failed. Verify the sender domain and Resend configuration.');}
  return result.json();}
export const safeHtml = value => String(value).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function errorResponse(res,error){console.error('candidate/invitation API:',error.message);return res.status(error.status||500).json({error:error.status?error.message:'Unable to process request. Please retry.'});}
export function requestFailure(message,status){return Object.assign(new Error(message),{status});}
export const validId=id=>typeof id==='string' && /^[a-zA-Z0-9]{10,40}$/.test(id);
export async function lookupInvite(token){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{35,100}$/.test(token))return null;
  const {db}=firebaseAdmin();const id=sha256(token);
  const doc=await db.collection('recruiter_invitations').doc(id).get();
  return doc.exists?{ref:doc.ref,data:{...doc.data(),id}}:null;
}
export async function candidateSession(req){
  const token=req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const session=verifyCandidateSession(token,process.env.CANDIDATE_SESSION_SECRET);
  if(!session)return null;
  const {db}=firebaseAdmin();const ref=db.collection('recruiter_invitations').doc(session.id);const snap=await ref.get();
  if(!snap.exists||snap.data().sessionNonce!==sha256(session.nonce))return null;
  return {ref,data:{...snap.data(),id:snap.id},db};
}
/** Complete overdue attempts transactionally. Called on candidate activity and recruiter list/report access. */
export async function finalizeAttempt(db,ref,reason='submitted',now=Date.now()) {
  return db.runTransaction(async tx=>{
    const doc=await tx.get(ref);
    if(!doc.exists)return {status:'missing'};
    const item={...doc.data(),id:doc.id};
    if(item.status==='completed')return {status:'completed'};
    if(item.status!=='started')return {status:item.status};
    const expired=now>=item.deadlineAt;
    if(!expired&&reason==='timeout')return {status:'started'};
    const job=db.collection('recruiter_jobs').doc(item.jobId);
    const assessment=db.collection('recruiter_assessments').doc(item.jobId);
    const report=db.collection('recruiter_reports').doc(item.id);
    const [jobSnap,assessmentSnap,reportSnap]=await Promise.all([tx.get(job),tx.get(assessment),tx.get(report)]);
    if(!jobSnap.exists||!assessmentSnap.exists||jobSnap.data().orgId!==item.orgId||assessmentSnap.data().orgId!==item.orgId)
      throw requestFailure('Assessment no longer available',409);
    if(reportSnap.exists)return {status:'completed'};
    const at=Math.min(now,item.deadlineAt);
    const reportData=buildReport(item,jobSnap.data(),assessmentSnap.data(),at,expired?'time_expired':reason);
    tx.create(report,reportData);
    tx.update(ref,{status:'completed',completedAt:at,finishReason:reportData.finishReason,questionMs:Object.fromEntries(reportData.details.map(d=>[d.id,d.timeSeconds*1000])),activeSince:null,isForeground:false,updatedAt:new Date()});
    tx.update(job,{completedCount:(jobSnap.data().completedCount||0)+1,updatedAt:new Date()});
    return {status:'completed',report:reportData};
  });
}
