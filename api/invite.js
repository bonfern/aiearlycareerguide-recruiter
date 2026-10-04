import {randomInt} from 'node:crypto';
import {firebaseAdmin} from './_firebase.js';
import {otpDigest,checkOtp,sha256,randomToken,signCandidateSession} from '../lib/candidate.js';
import {lookupInvite,safeHtml,sendEmail,errorResponse,requestFailure} from './_candidate.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const token=req.body?.invite,action=req.body?.action;
  try{
    const found=await lookupInvite(token);if(!found)return res.status(404).json({error:'Invalid invitation link'});
    const {ref}=found,{db}=firebaseAdmin();const item=found.data,now=Date.now();
    const job=await db.collection('recruiter_jobs').doc(item.jobId).get();
    if(!job.exists||job.data().orgId!==item.orgId)return res.status(404).json({error:'Assessment unavailable'});
    if(action==='details'){
      return res.status(200).json({role:job.data().title,durationMinutes:item.durationMinutes,
        expiresAt:item.expiresAt,emailHint:item.email.replace(/^(.{1,2}).*(@.*)$/,'$1***$2'),
        status:item.status==='completed'?'completed':item.expiresAt<now?'expired':'available'});
    }
    if(item.expiresAt<now)return res.status(410).json({error:'This invitation has expired. Contact the recruiter.'});
    if(item.status==='completed')return res.status(409).json({error:'This assessment is already completed'});
    if(action==='send-code'){
      if(!process.env.RESEND_API_KEY||!process.env.RECRUITER_FROM_EMAIL||!process.env.CANDIDATE_SESSION_SECRET)
        return res.status(503).json({error:'Email verification is not yet configured'});
      const code=String(randomInt(0,1000000)).padStart(6,'0');
      // Transactional rate limiting per invitation: at most 5 codes, 60s cooldown, max 5 guesses per code.
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);const d=snap.data(),at=Date.now();
        if(!d||d.status==='completed'||d.expiresAt<at)throw requestFailure('Invitation expired or completed',410);
        if((d.otpSendCount||0)>=5)throw requestFailure('Too many verification requests. Contact the recruiter.',429);
        if((d.lastOtpSentAt||0)+60000>at)throw requestFailure('Please wait 60 seconds before requesting another code.',429);
        tx.update(ref,{otpDigest:otpDigest(ref.id,code,process.env.CANDIDATE_SESSION_SECRET),otpExpiresAt:at+600000,
          otpAttempts:0,otpSendCount:(d.otpSendCount||0)+1,lastOtpSentAt:at});
      });
      await sendEmail(item.email,'Your Recruiter Assessment verification code',
        `<p>Hello ${safeHtml(item.name)},</p><p>Your one-time code is <strong style="font-size:22px;letter-spacing:4px">${code}</strong>.</p><p>It expires in 10 minutes. Never share this code.</p>`);
      return res.status(200).json({ok:true,message:'Verification code sent to the registered email.'});
    }
    if(action==='verify'){
      const code=req.body?.code;
      const nonce=randomToken(),nonceDigest=sha256(nonce);
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref),d=snap.data();
        if(!d||d.status==='completed'||d.expiresAt<Date.now())throw requestFailure('Invitation unavailable',410);
        if(!checkOtp({...d,id:ref.id},code,process.env.CANDIDATE_SESSION_SECRET)){
          if(d.otpAttempts>=4)tx.update(ref,{otpDigest:null,otpAttempts:5});
          else tx.update(ref,{otpAttempts:(d.otpAttempts||0)+1});
          return;
        }
        tx.update(ref,{sessionNonce:nonceDigest,verifiedAt:Date.now(),otpDigest:null,otpAttempts:0,
          status:d.status==='started'?'started':'verified'});
      });
      const updated=await ref.get();
      if(updated.data().sessionNonce!==nonceDigest)return res.status(401).json({error:'Incorrect or expired code. Check your email.'});
      return res.status(200).json({session:signCandidateSession(ref.id,nonce,process.env.CANDIDATE_SESSION_SECRET),
        status:updated.data().status});
    }
    return res.status(400).json({error:'Unknown action'});
  }catch(error){return errorResponse(res,error);}
}
