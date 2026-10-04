import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_MINUTES,validDuration,signCandidateSession,verifyCandidateSession,otpDigest,checkOtp,
  buildQuestionMap,sanitizeAssessment,accrueTime,buildReport,EVENT_TYPES,MAX_EVENTS,shuffle} from '../lib/candidate.js';

const secret='test-secret-with-at-least-thirty-two-characters-123';
const approved={roleTitle:'Operations Analyst',requirements:[
  {text:'Data analysis',category:'Technical',priority:'Must Have'},
  {text:'Stakeholder engagement',category:'Behavioural',priority:'Important'},
  {text:'Process improvement',category:'Domain',priority:'Must Have'}]};
const questions=Array.from({length:9},(_,i)=>({id:`question-${i+1}`,text:`For operations scenario ${i+1}, what should the analyst do first?`,
  options:['Verify the data','Ignore the issue','Make assumptions','Escalate without checking'],correctIndex:0,
  requirementIndex:i%3,type:'Problem solving',rationale:'Checking the source is essential to diagnosis.'}));
const assessment={version:1,questionVersion:'choice-v1',targetCount:9,durationMinutes:25,questions};
const at=Date.UTC(2026,9,4,6,0,0);
const answerMap=Object.fromEntries(questions.map((q,i)=>[q.id,{index:i===1?3:0,changes:i===1?1:0,firstAnsweredAt:at+6000,lastAnsweredAt:at+8000}]));
const assignment={id:'assignment-1',orgId:'ORG-ONE',jobId:'job-one',name:'A Candidate',email:'candidate@example.com',
  status:'started',questionMap:{order:questions.map(q=>q.id),options:Object.fromEntries(questions.map(q=>[q.id,[2,0,3,1]]))},
  answers:answerMap,questionMs:{},startedAt:at,deadlineAt:at+25*60000,currentIndex:1,activeSince:at+4000,isForeground:true,
  durationMinutes:25,integrityEvents:[{type:'tab_hidden',at:at+12000,questionIndex:1},{type:'tab_visible',at:at+16000,questionIndex:1}]};

test('default time scales with question count; only valid custom duration accepted',()=>{
  assert.deepEqual(DEFAULT_MINUTES,{15:25,20:30,25:40,30:45,40:60});
  assert.equal(validDuration(10),true);assert.equal(validDuration(120),true);
  assert.equal(validDuration(9),false);assert.equal(validDuration(121),false);assert.equal(validDuration(20.5),false);
});
test('OTP is invitation-specific, expires after ten minutes, and locks after five failed attempts',()=>{
  const code='016204',d={id:'assignment-1',otpDigest:otpDigest('assignment-1',code,secret),otpExpiresAt:at+600000,otpAttempts:0};
  assert.equal(checkOtp(d,code,secret,at),true);
  assert.equal(checkOtp(d,'000000',secret,at),false);
  assert.equal(checkOtp({...d,id:'other'},code,secret,at),false);
  assert.equal(checkOtp({...d,otpAttempts:5},code,secret,at),false);
  assert.equal(checkOtp(d,code,secret,at+600001),false);
});
test('candidate session is authenticated, time-limited, and rejects modification',()=>{
  const token=signCandidateSession('assignment-1','random-session-nonce',secret,3600,at);
  assert.deepEqual(verifyCandidateSession(token,secret,at+100),{id:'assignment-1',nonce:'random-session-nonce',exp:at+3600000});
  assert.equal(verifyCandidateSession(token,secret,at+3600001),null);
  assert.equal(verifyCandidateSession(token.slice(0,-4)+'xxxx',secret,at+100),null);
  assert.equal(verifyCandidateSession(token,'wrong-credential',at+100),null);
});
test('question and option order are permutations with no answer key in candidate response',()=>{
  assert.deepEqual(shuffle([1,2,3],()=>0),[2,3,1]);
  const map=buildQuestionMap(questions);
  assert.deepEqual(map.order.toSorted(),questions.map(q=>q.id).toSorted());
  for(const q of questions)assert.deepEqual(map.options[q.id].toSorted(),[0,1,2,3]);
  const response=sanitizeAssessment(assignment,assessment,at+5000);
  assert.equal(response.questions[0].options[1],'Verify the data');
  assert.equal(response.questions[0].selected,1);
  assert.equal('correctIndex' in response.questions[0],false);
  assert.equal('rationale' in response.questions[0],false);
});
test('timings accrue only in foreground and never beyond server deadline',()=>{
  const result=accrueTime(assignment,at+10000);
  assert.equal(result['question-2'],6000);
  const hidden=accrueTime({...assignment,isForeground:false},at+10000);
  assert.equal(hidden['question-2'],undefined);
  const deadline=accrueTime({...assignment,deadlineAt:at+7000},at+100000);
  assert.equal(deadline['question-2'],3000);
});
test('report includes full question evidence, score, competency uncertainty, timings and integrity indicators',()=>{
  const r=buildReport(assignment,{title:'Operations Analyst',approvedRequirements:approved},assessment,at+10000);
  assert.equal(r.correct,8);assert.equal(r.total,9);assert.equal(r.attempted,9);assert.equal(r.score,89);
  assert.equal(r.details[1].selectedIndex,3);assert.equal(r.details[1].correctIndex,0);
  assert.equal(r.details[1].changes,1);assert.equal(r.details[1].timeSeconds,6);
  assert.equal(r.competencies[1].correct,2);assert.equal(r.competencies[1].total,3);
  assert.equal(r.competencies[1].level,'Developing evidence');
  assert.equal(r.integrity.counts.tab_hidden,1);assert.equal(r.integrity.counts.tab_visible,1);
  assert.match(r.limitations[0],/not proof/i);
});
test('few items on a competency result in insufficient evidence, not false certainty',()=>{
  const r=buildReport({...assignment,questionMap:{order:questions.slice(0,2).map(q=>q.id),options:assignment.questionMap.options}},
    {title:'Operations Analyst',approvedRequirements:approved},{...assessment,questions:questions.slice(0,2)},at+10000);
  assert.equal(r.competencies[0].level,'Insufficient evidence');
  assert.equal(r.competencies[1].level,'Insufficient evidence');
});
test('browser activity allowlist and bounded event history prevent arbitrary event types',()=>{
  assert(EVENT_TYPES.has('tab_hidden'));assert(!EVENT_TYPES.has('webcam_photo'));
  assert.equal(MAX_EVENTS,150);
});
