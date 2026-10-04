import {candidateSession,errorResponse,requestFailure,finalizeAttempt} from './_candidate.js';
import {buildQuestionMap,sanitizeAssessment,accrueTime,EVENT_TYPES,MAX_EVENTS} from '../lib/candidate.js';

const response=(res,assignment,assessment)=>res.status(200).json({assessment:sanitizeAssessment(assignment,assessment)});
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  try{
    const session=await candidateSession(req);
    if(!session)return res.status(401).json({error:'Session expired. Verify your email again using your invitation link.'});
    const {db,ref}=session;
    const assessmentRef=db.collection('recruiter_assessments').doc(session.data.jobId);
    const assessmentSnap=await assessmentRef.get();
    if(!assessmentSnap.exists||assessmentSnap.data().orgId!==session.data.orgId||assessmentSnap.data().status!=='published')
      return res.status(404).json({error:'Assessment unavailable'});
    const assessment=assessmentSnap.data();
    if(req.method==='GET'){
      let assignment={...((await ref.get()).data()),id:ref.id};
      if(assignment.status==='started'&&Date.now()>=assignment.deadlineAt){await finalizeAttempt(db,ref,'timeout');assignment={...((await ref.get()).data()),id:ref.id};}
      return response(res,assignment,assessment);
    }
    const action=req.body?.action;
    if(action==='submit'){
      const complete=await finalizeAttempt(db,ref,'submitted');
      if(complete.status==='verified')return res.status(409).json({error:'Start the assessment before submitting'});
      return res.status(200).json({status:complete.status});
    }
    if(action==='start'){
      const snap=await db.runTransaction(async tx=>{
        const doc=await tx.get(ref),d=doc.data();
        if(!d||d.sessionNonce!==session.data.sessionNonce)throw requestFailure('Your session has expired',401);
        if(d.status==='completed')return {...d,id:ref.id};
        if(d.status==='started')return {...d,id:ref.id};
        if(d.status!=='verified'||d.expiresAt<Date.now())throw requestFailure('Verify your email before starting',403);
        const at=Date.now(),questionMap=buildQuestionMap(assessment.questions);
        const changes={status:'started',startedAt:at,deadlineAt:at+d.durationMinutes*60000,
          questionMap,currentIndex:0,activeSince:at,isForeground:true,updatedAt:new Date()};
        tx.update(ref,changes);return {...d,...changes,id:ref.id};
      });
      return response(res,snap,assessment);
    }
    if(!['answer','navigate','event'].includes(action))return res.status(400).json({error:'Unknown action'});
    const updated=await db.runTransaction(async tx=>{
      const doc=await tx.get(ref),d=doc.data(),at=Date.now();
      if(!d||d.sessionNonce!==session.data.sessionNonce)throw requestFailure('Your session has expired',401);
      if(d.status==='completed')return {...d,id:ref.id};
      if(d.status!=='started')throw requestFailure('Start your assessment first',409);
      if(at>=d.deadlineAt)return {...d,id:ref.id,timedOut:true};
      const questionMs=accrueTime(d,at),changes={questionMs,activeSince:d.isForeground?at:null,updatedAt:new Date()};
      if(action==='answer'){
        const questionId=req.body.questionId,selected=Number(req.body.selected);
        if(!d.questionMap?.order?.includes(questionId)||!Number.isInteger(selected)||selected<0||selected>3)
          throw requestFailure('Invalid answer',400);
        const original=d.questionMap.options[questionId][selected];
        if(!Number.isInteger(original)||original<0||original>3)throw requestFailure('Invalid answer option',400);
        const answers={...(d.answers||{})},prev=answers[questionId];
        answers[questionId]={index:original,changes:(prev?.changes||0)+(prev&&prev.index!==original?1:0),
          firstAnsweredAt:prev?.firstAnsweredAt||at,lastAnsweredAt:at};changes.answers=answers;
      }
      if(action==='navigate'){
        const index=Number(req.body.index);
        if(!Number.isInteger(index)||index<0||index>=d.questionMap.order.length)throw requestFailure('Invalid question position',400);
        changes.currentIndex=index;
      }
      if(action==='event'){
        const type=String(req.body.type||'');if(!EVENT_TYPES.has(type))throw requestFailure('Unsupported browser event',400);
        const events=d.integrityEvents||[];
        if(events.length<MAX_EVENTS)changes.integrityEvents=[...events,{type,at,questionIndex:d.currentIndex||0}];
        if(['tab_hidden','idle_start','offline'].includes(type)){
          changes.isForeground=false;changes.activeSince=null;
        }else if(['tab_visible','idle_end','online'].includes(type)){
          changes.isForeground=true;changes.activeSince=at;
        }
      }
      tx.update(ref,changes);return {...d,...changes,id:ref.id};
    });
    if(updated.timedOut){await finalizeAttempt(db,ref,'timeout');const doc=await ref.get();return response(res,{...doc.data(),id:ref.id},assessment);}
    return response(res,updated,assessment);
  }catch(error){return errorResponse(res,error);}
}
