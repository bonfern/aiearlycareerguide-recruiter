import {requireRecruiter, reject} from './_auth.js';
import {assessmentSignature, cleanQuestions, SIZES, QUESTION_VERSION} from '../lib/assessment.js';
import {durationFor,validDuration} from '../lib/candidate.js';
import {FOCUS_VERSION,focusSignature,validateQuestionCoverage,V2_SIZES} from '../lib/focus.js';

const validId = id => typeof id === 'string' && /^[a-zA-Z0-9]{10,40}$/.test(id);
const view = snap => snap.exists ? {id: snap.id, ...snap.data(), generationLock: undefined,
  createdAt: snap.data().createdAt?.toDate?.()?.toISOString?.() || null,
  publishedAt: snap.data().publishedAt?.toDate?.()?.toISOString?.() || null} : null;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({error:'Method not allowed'});
  const user = await requireRecruiter(req);
  if (user.error) return reject(res, user);
  const jobId = req.method === 'GET' ? req.query?.jobId : req.body?.jobId;
  if (!validId(jobId)) return res.status(400).json({error:'Invalid job ID'});
  const jobRef = user.db.collection('recruiter_jobs').doc(jobId);
  const ref = user.db.collection('recruiter_assessments').doc(jobId);
  try {
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists || jobSnap.data().orgId !== user.orgId) return res.status(404).json({error:'Job not found'});
    if (req.method === 'GET') {
      const snap = await ref.get();
      if (snap.exists && snap.data().orgId !== user.orgId) return res.status(404).json({error:'Assessment not found'});
      return res.status(200).json({assessment:view(snap)});
    }
    if (!jobSnap.data().approvedRequirements) return res.status(409).json({error:'Approve requirements before generating questions'});
    const action = req.body?.action;
    if (action === 'start') {
      const targetCount = Number(req.body.targetCount);
      if (!V2_SIZES[targetCount]) return res.status(400).json({error:'Choose 20, 30 or 40 questions'});
      const result = await user.db.runTransaction(async tx => {
        const [latestJob, current] = await Promise.all([tx.get(jobRef), tx.get(ref)]);
        if (!latestJob.exists || latestJob.data().orgId !== user.orgId) throw Object.assign(new Error('Job not found'),{status:404});
        if (!latestJob.data().approvedRequirements) throw Object.assign(new Error('Requirements must be approved first'),{status:409});
        const focus=latestJob.data().assessmentFocusApproved;
        if (!focus || focus.version!==FOCUS_VERSION || focus.targetCount!==targetCount) throw Object.assign(new Error('Approve the critical competency focus for this assessment length first'),{status:409});
        if (current.exists) return view(current); // Explicitly prevent overwriting previously generated/published questions.
        const value = {orgId:user.orgId, jobId, targetCount, status:'draft', version:1, questions:[], cacheInitialized:false,
          generatedCount:0, reusedCount:0, questionVersion:FOCUS_VERSION,focus:latestJob.data().assessmentFocusApproved, durationMinutes:V2_SIZES[targetCount].minutes,createdAt:new Date(), updatedAt:new Date()};
        tx.create(ref,value); tx.update(jobRef,{status:'assessment_draft',updatedAt:new Date()});
        return {...value, id:jobId};
      });
      return res.status(200).json({assessment:result});
    }
    if (action === 'save') {
      const asmtForValidation=await ref.get();
      if(!asmtForValidation.exists)return res.status(404).json({error:'Assessment not found'});
      const focus=asmtForValidation.data().questionVersion===FOCUS_VERSION?asmtForValidation.data().focus:null;
      let questions;try{questions=cleanQuestions(req.body.questions,jobSnap.data().approvedRequirements,{focus});
        if(focus)validateQuestionCoverage(questions,focus);}catch(error){return res.status(400).json({error:error.message});}
      const result = await user.db.runTransaction(async tx => {
        const [job, snap] = await Promise.all([tx.get(jobRef), tx.get(ref)]);
        if (!job.exists || job.data().orgId !== user.orgId || !snap.exists || snap.data().orgId !== user.orgId)
          throw Object.assign(new Error('Job or assessment not found'), {status:404});
        if (snap.data().status !== 'draft') throw Object.assign(new Error('Published assessments are locked'), {status:409});
        if (snap.data().generationLock?.until > Date.now()) throw Object.assign(new Error('Wait for question generation to finish'), {status:409});
        if (questions.length !== snap.data().targetCount) throw Object.assign(new Error('Complete generation before saving edits'), {status:400});
        tx.update(ref, {questions, updatedAt:new Date()});
        return {ok:true, assessment:{...view(snap),questions}};
      });
      return res.status(200).json(result);
    }
    if (action === 'duration') {
      const minutes=Number(req.body.durationMinutes);
      if(!validDuration(minutes))return res.status(400).json({error:'Duration must be 10–120 minutes'});
      await user.db.runTransaction(async tx=>{
        const [job,snap]=await Promise.all([tx.get(jobRef),tx.get(ref)]);
        if(!job.exists||job.data().orgId!==user.orgId||!snap.exists||snap.data().orgId!==user.orgId||snap.data().status!=='published')
          throw Object.assign(new Error('Publish the assessment first'),{status:409});
        if((job.data().candidateCount||0)>0)throw Object.assign(new Error('Cannot change duration after inviting candidates'),{status:409});
        tx.update(ref,{durationMinutes:minutes,updatedAt:new Date()});
      });
      return res.status(200).json({durationMinutes:minutes});
    }
    if (action === 'publish') {
      const result = await user.db.runTransaction(async tx => {
        const [job, assessment] = await Promise.all([tx.get(jobRef),tx.get(ref)]);
        if (!job.exists || job.data().orgId !== user.orgId || !assessment.exists || assessment.data().orgId !== user.orgId) throw Object.assign(new Error('Job or assessment not found'),{status:404});
        const data = assessment.data();
        if (data.status !== 'draft' || data.generationLock?.until > Date.now()) throw Object.assign(new Error('Assessment cannot be published right now'),{status:409});
        const focus=data.questionVersion===FOCUS_VERSION?data.focus:null;
        const questions = cleanQuestions(data.questions,job.data().approvedRequirements,{focus});
        if(focus)validateQuestionCoverage(questions,focus);
        if (questions.length !== data.targetCount) throw Object.assign(new Error('Generate all questions before publishing'),{status:409});
        const signature = focus?focusSignature(user.orgId,job.data().approvedRequirements,focus):assessmentSignature(user.orgId,job.data().approvedRequirements);
        const cache = user.db.collection('published_question_templates').doc();
        const approved = job.data().approvedRequirements;
        const durationMinutes=durationFor(data);
        tx.update(ref,{status:'published',durationMinutes,publishedAt:new Date(),updatedAt:new Date()});
        tx.update(jobRef,{status:'published',updatedAt:new Date()});
        tx.create(cache,{orgId:user.orgId,sourceJobId:jobId,signature,roleTitle:approved.roleTitle,seniority:approved.seniority,
          requirements:approved.requirements,questions,questionVersion:data.questionVersion||QUESTION_VERSION,
          ...(focus?{focus}:{}),createdAt:new Date()});
        return {ok:true, status:'published'};
      });
      return res.status(200).json(result);
    }
    return res.status(400).json({error:'Unknown action'});
  } catch(error) {
    console.error('assessment API:',error.message);
    return res.status(error.status || 500).json({error:error.status ? error.message : 'Unable to process assessment. Please retry.'});
  }
}
