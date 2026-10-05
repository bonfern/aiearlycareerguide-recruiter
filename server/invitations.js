import {requireRecruiter,reject} from './_auth.js';
import {randomToken,sha256,validEmail,durationFor} from '../lib/candidate.js';
import {availableUnits,unitsToCredits} from '../lib/commerce.js';
import {encryptInvite,decryptInvite,inviteUrl,sendEmail,safeHtml,validId,errorResponse,requestFailure,finalizeAttempt} from './_candidate.js';
import {releaseReservation,reserveCredits,reservationForAssessment} from './_credits.js';

const display = item => ({id:item.id,name:item.name,email:item.email,status:item.status,
  invitedAt:item.invitedAt||null,startedAt:item.startedAt||null,completedAt:item.completedAt||null,
  finishReason:item.finishReason||null,deliveryStatus:item.deliveryStatus||'pending',creditStatus:item.creditStatus||null,
  creditCostCredits:item.creditCostCredits||null});
const inviteMessage = (name,title,link,duration) => `<p>Hello ${safeHtml(name)},</p><p>You have been invited to complete a role-specific assessment for <strong>${safeHtml(title)}</strong>.</p><p>Estimated maximum duration: ${duration} minutes. Your unique invitation expires in seven days. You will verify your email using a one-time code before starting.</p><p><a href="${safeHtml(link)}">Open your secure assessment</a></p><p>This is a timed assessment. The timer continues during network interruptions. Sustained tab switching may be recorded and disclosed in the recruiter report; no webcam recording is used.</p><p>If you did not expect this invitation, ignore this email.</p>`;
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  const user=await requireRecruiter(req);if(user.error)return reject(res,user);
  const jobId=req.method==='GET'?req.query.jobId:req.body?.jobId;
  if(!validId(jobId))return res.status(400).json({error:'Invalid job ID'});
  const jobRef=user.db.collection('recruiter_jobs').doc(jobId),assessmentRef=user.db.collection('recruiter_assessments').doc(jobId),orgRef=user.db.collection('recruiter_organizations').doc(user.orgId);
  try{
    const job=await jobRef.get();if(!job.exists||job.data().orgId!==user.orgId)return res.status(404).json({error:'Job not found'});
    const pilotMode=process.env.RECRUITER_PILOT_MODE==='true';
    if(req.method==='GET'){
      const snap=await user.db.collection('recruiter_invitations').where('jobId','==',jobId).limit(100).get();
      const items=[];
      for(const doc of snap.docs){if(doc.data().orgId!==user.orgId)continue;
        let item={...doc.data(),id:doc.id};
        if(item.status==='started'&&Date.now()>=item.deadlineAt){await finalizeAttempt(user.db,doc.ref,'timeout');item={...((await doc.ref.get()).data()),id:doc.id};}
        if(item.status!=='started'&&item.status!=='completed'&&item.expiresAt<Date.now()){
          if(item.creditStatus==='reserved')await releaseReservation(user.db,doc.ref,'invitation_expired');
          else await doc.ref.update({status:'expired',updatedAt:new Date()});
          item={...((await doc.ref.get()).data()),id:doc.id};
        }
        items.push(display(item));}
      items.sort((a,b)=>String(b.invitedAt).localeCompare(String(a.invitedAt)));
      const [a,org]=await Promise.all([assessmentRef.get(),orgRef.get()]);let canInvite=false,creditCostCredits=null,availableCredits=org.exists?unitsToCredits(availableUnits(org.data())):0;
      if(a.exists&&a.data()?.status==='published'){
        if(pilotMode)canInvite=items.length<5;
        else{const cost=reservationForAssessment(a.data());creditCostCredits=cost.credits;canInvite=availableUnits(org.data())>=cost.units;}
      }
      return res.status(200).json({invitations:items,durationMinutes:a.exists?durationFor(a.data()):null,pilotMode,canInvite,creditCostCredits,availableCredits});
    }
    const action=req.body?.action;
    if(action==='create'){
      if(!process.env.RESEND_API_KEY||!process.env.RECRUITER_FROM_EMAIL||!process.env.CANDIDATE_SESSION_SECRET)
        return res.status(503).json({error:'Configure RESEND_API_KEY, RECRUITER_FROM_EMAIL and CANDIDATE_SESSION_SECRET in Vercel first.'});
      const name=String(req.body?.name||'').trim().slice(0,120),email=String(req.body?.email||'').trim().toLowerCase();
      if(name.length<2||!validEmail(email))return res.status(400).json({error:'Enter a valid candidate name and email'});
      const prior=await user.db.collection('recruiter_invitations').where('jobId','==',jobId).limit(100).get();
      if(prior.docs.some(d=>d.data().orgId===user.orgId&&d.data().email===email))return res.status(409).json({error:'This email has already been invited for this JD'});
      const token=randomToken(),id=sha256(token),ref=user.db.collection('recruiter_invitations').doc(id);
      const result=await user.db.runTransaction(async tx=>{
        const [latestJob,assessment,org]=await Promise.all([tx.get(jobRef),tx.get(assessmentRef),tx.get(orgRef)]);
        if(!latestJob.exists||latestJob.data().orgId!==user.orgId||!assessment.exists||assessment.data().orgId!==user.orgId||assessment.data().status!=='published')
          throw requestFailure('Publish your assessment before inviting candidates',409);
        if(!org.exists)throw requestFailure('Organisation not found',404);
        if(pilotMode&&(latestJob.data().candidateCount||0)>=5)throw requestFailure('Pilot limit: five invitations per JD.',409);
        const minutes=durationFor(assessment.data());let creditReservationUnits=0,creditCostCredits=0,creditStatus='pilot';
        if(!pilotMode){const reservation=await reserveCredits(tx,user.db,user.orgId,assessment.data(),org);creditReservationUnits=reservation.units;creditCostCredits=reservation.credits;creditStatus='reserved';}
        const item={orgId:user.orgId,jobId,name,email,tokenCipher:encryptInvite(token),status:'invited',deliveryStatus:'pending',pilotInvite:pilotMode,
          creditReservationUnits,creditCostCredits,creditStatus,durationMinutes:minutes,invitedAt:Date.now(),expiresAt:Date.now()+7*86400000,
          otpAttempts:0,otpSendCount:0,answers:{},questionMs:{},integrityEvents:[],createdByUid:user.uid,createdAt:new Date()};
        tx.create(ref,item);tx.update(jobRef,{candidateCount:(latestJob.data().candidateCount||0)+1,updatedAt:new Date()});return item;
      });
      const link=inviteUrl(token);let deliveryStatus='sent';
      try{await sendEmail(email,`Assessment invitation: ${job.data().title}`,inviteMessage(name,job.data().title,link,result.durationMinutes));}
      catch(error){console.error('Invitation mail failed:',error.message);deliveryStatus='failed';}
      await ref.update({deliveryStatus,deliveryUpdatedAt:new Date()});
      return res.status(201).json({invitation:display({...result,id,deliveryStatus}),link,
        note:deliveryStatus==='failed'?'Email could not be delivered. You can copy the link; OTP delivery must be configured before the candidate starts.':pilotMode?'Invitation emailed. Pilot mode does not consume credits.':`${result.creditCostCredits} credit${result.creditCostCredits===1?'':'s'} reserved. Credits are consumed only when the candidate starts.`});
    }
    if(action==='delete'){
      if(user.role!=='owner')return res.status(403).json({error:'Only an organisation owner can permanently delete candidate records'});
      const id=req.body?.invitationId;if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))return res.status(400).json({error:'Invalid invitation'});
      const ref=user.db.collection('recruiter_invitations').doc(id),reportRef=user.db.collection('recruiter_reports').doc(id);
      await user.db.runTransaction(async tx=>{
        const [candidate,latestJob,org]=await Promise.all([tx.get(ref),tx.get(jobRef),tx.get(orgRef)]);
        if(!candidate.exists||candidate.data().orgId!==user.orgId||candidate.data().jobId!==jobId)throw requestFailure('Candidate not found',404);
        if(!latestJob.exists||latestJob.data().orgId!==user.orgId)throw requestFailure('Job not found',404);
        const d=candidate.data(),units=d.creditStatus==='reserved'?(Number(d.creditReservationUnits)||0):0;
        if(units&&org.exists)tx.update(orgRef,{creditReservedUnits:Math.max(0,(Number(org.data().creditReservedUnits)||0)-units),updatedAt:new Date()});
        tx.delete(ref);tx.delete(reportRef);tx.update(jobRef,{candidateCount:Math.max(0,(latestJob.data().candidateCount||0)-1),
          completedCount:Math.max(0,(latestJob.data().completedCount||0)-(d.status==='completed'?1:0)),updatedAt:new Date()});
      });
      return res.status(200).json({ok:true});
    }
    if(action==='resend'||action==='link'){
      const id=req.body?.invitationId;if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))return res.status(400).json({error:'Invalid invitation'});
      const ref=user.db.collection('recruiter_invitations').doc(id),snap=await ref.get();
      if(!snap.exists||snap.data().orgId!==user.orgId||snap.data().jobId!==jobId)return res.status(404).json({error:'Invitation not found'});
      const item=snap.data();if(item.expiresAt<Date.now()||item.status==='completed')return res.status(409).json({error:'Invitation has expired or completed'});
      const link=inviteUrl(decryptInvite(item.tokenCipher));if(action==='link')return res.status(200).json({link});
      await sendEmail(item.email,`Assessment invitation: ${job.data().title}`,inviteMessage(item.name,job.data().title,link,item.durationMinutes));
      await ref.update({deliveryStatus:'sent',deliveryUpdatedAt:new Date()});return res.status(200).json({ok:true});
    }
    return res.status(400).json({error:'Unknown action'});
  }catch(error){return errorResponse(res,error);}
}
