import {requireRecruiter,reject} from './_auth.js';
import {finalizeAttempt} from './_candidate.js';
import {polishProfile} from './_profile.js';
import {enrichReportV3} from '../lib/report-v3.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const user=await requireRecruiter(req);if(user.error)return reject(res,user);
  const id=req.query?.invitationId;
  if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))return res.status(400).json({error:'Invalid invitation ID'});
  try{
    const ref=user.db.collection('recruiter_invitations').doc(id),invite=await ref.get();
    if(!invite.exists||invite.data().orgId!==user.orgId)return res.status(404).json({error:'Candidate not found'});
    if(invite.data().status==='started'&&Date.now()>=invite.data().deadlineAt)await finalizeAttempt(user.db,ref,'timeout');
    const reportRef=user.db.collection('recruiter_reports').doc(id);
    const doc=await reportRef.get();
    if(!doc.exists||doc.data().orgId!==user.orgId)return res.status(404).json({error:'The candidate has not completed this assessment yet'});
    let report=doc.data();
    if(report.reportVersion===3) report=enrichReportV3(report);
    if(report.reportVersion===2 && report.profile?.source==='Rule-based interpretation of actual responses' && process.env.OPENAI_API_KEY){
      const updated=await polishProfile(report);
      if(updated){
        // Avoid repeated narrative generation on subsequent report views. Hard scores remain untouched.
        try{await user.db.runTransaction(async tx=>{const latest=await tx.get(reportRef);
          if(latest.exists && latest.data().orgId===user.orgId && latest.data().profile?.source==='Rule-based interpretation of actual responses')
            tx.update(reportRef,{profile:updated});
        });report={...report,profile:updated};}
        catch(e){console.error('Profile cache update failed:',e.message); /* Still serve the original report. */}
      }
    }
    return res.status(200).json({report});
  }catch(error){console.error('report API error',error.message);return res.status(500).json({error:'Unable to open the assessment report'});}
}
