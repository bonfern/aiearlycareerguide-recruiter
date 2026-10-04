import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';

export const DEFAULT_MINUTES = Object.freeze({15:25, 25:40, 40:60});
export const MAX_EVENTS = 150;
export const EVENT_TYPES = new Set(['tab_hidden','tab_visible','window_blur','window_focus','fullscreen_exit','fullscreen_unavailable','copy','paste','offline','online','idle_start','idle_end']);
export const sha256 = value => createHash('sha256').update(String(value)).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export const validEmail = value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length <= 254;
export const durationFor = assessment => Number(assessment.durationMinutes) || DEFAULT_MINUTES[assessment.targetCount] || 40;
export const validDuration = minutes => Number.isInteger(minutes) && minutes >= 10 && minutes <= 120;

export function signCandidateSession(id, nonce, secret, ttlSec = 12 * 3600, at = Date.now()) {
  if (!secret || secret.length < 32) throw new Error('CANDIDATE_SESSION_SECRET must be at least 32 characters');
  const data = Buffer.from(JSON.stringify({id, nonce, exp:at + ttlSec * 1000})).toString('base64url');
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}
export function verifyCandidateSession(token, secret, at = Date.now()) {
  if (!secret || typeof token !== 'string' || token.length > 1024) return null;
  const [data, mac, extra] = token.split('.');
  if (!data || !mac || extra) return null;
  const expected = createHmac('sha256', secret).update(data).digest();
  let got;
  try {got = Buffer.from(mac,'base64url');} catch {return null;}
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {const payload = JSON.parse(Buffer.from(data,'base64url').toString());
    if (typeof payload.id !== 'string' || typeof payload.nonce !== 'string' || !Number.isSafeInteger(payload.exp) || payload.exp <= at) return null;
    return payload;
  } catch {return null;}
}
export function otpDigest(invitationId, code, secret) {
  return createHmac('sha256',secret).update(`${invitationId}:${code}`).digest('hex');
}
export function checkOtp(candidate, code, secret, at = Date.now()) {
  if (!/^\d{6}$/.test(String(code||'')) || !candidate?.otpDigest || candidate.otpExpiresAt <= at || candidate.otpAttempts >= 5) return false;
  const actual = Buffer.from(otpDigest(candidate.id,code,secret),'hex');
  const expected = Buffer.from(candidate.otpDigest,'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function shuffle(items, random = n => randomBytes(4).readUInt32BE(0) % n) {
  const out=[...items];
  for(let i=out.length-1;i>0;i--){const j=random(i+1);[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
export function buildQuestionMap(questions) {
  const order = shuffle(questions.map(q=>q.id));
  const options = Object.fromEntries(questions.map(q=>[q.id,shuffle([0,1,2,3])]));
  return {order,options};
}
export function sanitizeAssessment(assignment, assessment, at = Date.now()) {
  const byId = new Map(assessment.questions.map(q=>[q.id,q]));
  const order = assignment.questionMap?.order || [];
  const questions = order.map(id=>{
    const q=byId.get(id); if(!q)return null;
    const permutation=assignment.questionMap.options[id];
    const answer=assignment.answers?.[id];
    return {id:q.id,text:q.text,type:q.type,options:permutation.map(i=>q.options[i]),
      selected:answer ? permutation.indexOf(answer.index) : null,changes:answer?.changes||0};
  }).filter(Boolean);
  return {status:assignment.status,questions,startedAt:assignment.startedAt||null,deadlineAt:assignment.deadlineAt||null,
    remainingSeconds:assignment.deadlineAt ? Math.max(0,Math.ceil((assignment.deadlineAt-at)/1000)) : null,
    serverTime:at,currentIndex:assignment.currentIndex||0,durationMinutes:assignment.durationMinutes,
    completedAt:assignment.completedAt||null,finishReason:assignment.finishReason||null};
}
export function accrueTime(data, at = Date.now()) {
  const questionMs={...(data.questionMs||{})};
  if(data.status==='started' && data.isForeground && Number.isFinite(data.activeSince) && data.questionMap?.order?.[data.currentIndex] ){
    const until=Math.min(at,data.deadlineAt||at);
    const elapsed=Math.max(0,until-data.activeSince);
    const id=data.questionMap.order[data.currentIndex];
    questionMs[id]=(questionMs[id]||0)+elapsed;
  }
  return questionMs;
}
export function buildReport(assignment, job, assessment, at = Date.now(), finishReason='submitted') {
  const questionMs=accrueTime(assignment,at);
  const questions=assessment.questions;
  const byId=new Map(questions.map(q=>[q.id,q]));
  const competencies=job.approvedRequirements.requirements.map((r,index)=>({index,requirement:r.text,category:r.category,priority:r.priority,attempted:0,correct:0,total:0,score:null,level:'Insufficient evidence'}));
  let correct=0,attempted=0;
  const details=(assignment.questionMap?.order||questions.map(q=>q.id)).map((id,orderIndex)=>{
    const q=byId.get(id); if(!q)return null;
    const answer=assignment.answers?.[id];
    const score=Boolean(answer && answer.index===q.correctIndex); const competency=competencies[q.requirementIndex];
    if(competency){competency.total++;if(answer) competency.attempted++;if(score)competency.correct++;}
    if(answer)attempted++;if(score)correct++;
    return {order:orderIndex+1,id:q.id,question:q.text,type:q.type,competency:competency?.requirement||'Unmapped',
      options:q.options,correctIndex:q.correctIndex,selectedIndex:answer?.index??null,isCorrect:answer?score:null,
      rationale:q.rationale,changes:answer?.changes||0,timeSeconds:Math.round((questionMs[id]||0)/1000),
      firstAnsweredAt:answer?.firstAnsweredAt||null,lastAnsweredAt:answer?.lastAnsweredAt||null};
  }).filter(Boolean);
  for(const c of competencies){
    if(c.total)c.score=Math.round((c.correct/c.total)*100);
    if(c.total<3) c.level='Insufficient evidence';
    else if(c.score>=80)c.level='Strong evidence';
    else if(c.score>=50)c.level='Developing evidence';
    else c.level='Needs validation';
  }
  const events=assignment.integrityEvents||[];
  return {assignmentId:assignment.id,orgId:assignment.orgId,jobId:assignment.jobId,
    candidateName:assignment.name,candidateEmail:assignment.email,jobTitle:job.title,
    assessmentVersion:assessment.version||1,questionVersion:assessment.questionVersion,
    generatedAt:new Date(at).toISOString(),startedAt:assignment.startedAt,completedAt:at,finishReason,
    durationMinutes:assignment.durationMinutes,elapsedSeconds:assignment.startedAt?Math.round((Math.min(at,assignment.deadlineAt)-assignment.startedAt)/1000):0,
    correct,attempted,total:questions.length,score:questions.length?Math.round(100*correct/questions.length):0,
    competencies,details,integrity:{events,eventCount:events.length,counts:events.reduce((acc,e)=>{acc[e.type]=(acc[e.type]||0)+1;return acc;},{})},
    limitations:['Browser events are signals, not proof of misconduct. Other devices cannot be monitored.',
      'Per-question time is an estimate based on server timestamps and reported foreground activity.',
      'Competency ratings with fewer than three questions have insufficient evidence.',
      'This is screening evidence, not an automatic hiring decision.']};
}
