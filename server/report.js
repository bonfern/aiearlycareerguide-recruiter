import {requireRecruiter,reject} from './_auth.js';
import {finalizeAttempt} from './_candidate.js';
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
    const doc=await user.db.collection('recruiter_reports').doc(id).get();
    if(!doc.exists||doc.data().orgId!==user.orgId)return res.status(404).json({error:'The candidate has not completed this assessment yet'});
    return res.status(200).json({report:doc.data()});
  }catch(error){console.error('report API error',error.message);return res.status(500).json({error:'Unable to open the assessment report'});}
}
