import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFocus,focusSignature,nextAssignments,compatibleCachedQuestions,FOCUS_VERSION,validateQuestionCoverage,FOCUS_V2} from '../lib/focus.js';
import {cleanQuestions} from '../lib/assessment.js';
import {buildReport} from '../lib/candidate.js';
const approved={roleTitle:'Commercial Searcher',seniority:'Mid',experience:'2–5 years',summary:'Commercial title search',requirements:[
 {text:'Verify commercial property records and ownership chains',category:'Domain',priority:'Must Have'},
 {text:'Analyze title defects and commercial real estate risks',category:'Technical',priority:'Must Have'},
 {text:'Prepare clear and compliant title reports',category:'Domain',priority:'Must Have'},
 {text:'Apply prioritization and confidentiality in complex work',category:'Behavioural',priority:'Important'},
 {text:'2–5 years of commercial real estate title search experience',category:'Experience',priority:'Must Have'}]};
const groups=['Record verification','Title risks and defects','Reporting and compliance','Applied professional judgement'].map((name,i)=>({
 name,rationale:`Critical applied skills in ${name}`,importance:i<3?'Critical':'High',questionCount:5,requirementIndices:[i]}));
const plan=validateFocus({targetCount:20,groups},approved);
const q=(id,comp,req)=>({id:`question-${id}`,text:`On this commercial search case ${id}, which is the best action to take?`,
 options:['Check verified sources first','Ignore material risks','Assume the records are accurate','Proceed without cross-checking'],
 correctIndex:0,requirementIndex:req,competencyId:comp,type:'Problem solving',rationale:'Independent verification is essential before recording a conclusion.',source:'ai'});
const questions=Array.from({length:20},(_,i)=>q(i+1,`c${Math.floor(i/5)+1}`,Math.floor(i/5)));
test('V2 focus requires 20 questions, four groups and must-have skills are tracked',()=>{
 assert.equal(plan.version,FOCUS_VERSION);assert.equal(plan.groups.length,4);
 assert.deepEqual(plan.notTestedMustHaveIndices,[]); // Eligibility-only experience is deliberately excluded from testable items.
 assert.throws(()=>validateFocus({targetCount:15,groups},approved),/20, 30 or 40/);
 assert.throws(()=>validateFocus({targetCount:20,groups:[...groups.slice(0,3),{...groups[3],questionCount:4}]},approved),/exactly 20/);
 assert.throws(()=>validateFocus({targetCount:20,groups:groups.map((g,i)=>i===3?{...g,requirementIndices:[4]}:g)},approved),/testable approved requirement/);
});
test('V2 allocation fills approved groups and never tests eligibility requirements',()=>{
 const assignments=nextAssignments(approved,plan,[],20);
 assert.equal(assignments.length,20);
 for(let i=1;i<=4;i++)assert.equal(assignments.filter(a=>a.competencyId===`c${i}`).length,5);
 assert(!assignments.some(a=>a.requirementIndex===4));
 assert.equal(validateQuestionCoverage(questions,plan),true);
 assert.throws(()=>validateQuestionCoverage(questions.slice(1),plan),/20 questions/);
});
test('V2 question editor validates group mapping and duplicates',()=>{
 assert.equal(cleanQuestions(questions,approved,{focus:plan}).length,20);
 assert.throws(()=>cleanQuestions([{...questions[0],competencyId:'c2'}],approved,{focus:plan}),/within its approved competency/);
});
test('V2 cache isolates organisations, ignores V1 cache and reuses exact focus',()=>{
 const signature=focusSignature('org-1',approved,plan);
 const template={orgId:'org-1',questionVersion:FOCUS_VERSION,signature,roleTitle:approved.roleTitle,seniority:approved.seniority,
  focus:plan,requirements:approved.requirements,questions};
 assert.equal(compatibleCachedQuestions(approved,plan,[template],'org-1').reused,20);
 assert.equal(compatibleCachedQuestions(approved,plan,[template],'org-2').reused,0);
 assert.equal(compatibleCachedQuestions(approved,plan,[{...template,questionVersion:'choice-v1'}],'org-1').reused,0);
});
test('V2 evidence report groups all questions, shows profile and keeps full answer key',()=>{
 const at=Date.UTC(2026,9,4,10,0,0);
 const answers=Object.fromEntries(questions.map((q,i)=>[q.id,{index:i<8?0:1,changes:0,firstAnsweredAt:at+i*15000,lastAnsweredAt:at+i*15000+2000}]));
 const assignment={id:'attempt-1',orgId:'org-1',jobId:'job-1',name:'Test Candidate',email:'example@example.com',status:'started',
  questionMap:{order:questions.map(q=>q.id),options:Object.fromEntries(questions.map(q=>[q.id,[0,1,2,3]]))},
  answers,questionMs:{},startedAt:at,deadlineAt:at+30*60000,currentIndex:19,activeSince:at+240000,isForeground:true,
  durationMinutes:30,integrityEvents:[{type:'tab_hidden',at:at+10000,questionIndex:0},{type:'tab_visible',at:at+15000,questionIndex:0}]};
 const report=buildReport(assignment,{title:approved.roleTitle,approvedRequirements:approved},{questions,focus:plan,version:1,questionVersion:FOCUS_V2},at+300000);
 assert.equal(report.reportVersion,2);assert.equal(report.competencies.length,4);
 assert.equal(report.score,40);assert.equal(report.correct,8);assert.equal(report.details.length,20);
 assert.equal(report.competencies[0].score,100);assert.equal(report.competencies[2].score,0);
 assert.match(report.profile.summary,/screening assessment/);assert(report.profile.gaps.length>0);
 assert.equal(report.details[0].correctIndex,0);assert.equal(report.details[9].selectedIndex,1);
 assert.equal(report.integrity.tabSwitches,1);assert.match(report.limitations.join(' '),/not proof/);
});
