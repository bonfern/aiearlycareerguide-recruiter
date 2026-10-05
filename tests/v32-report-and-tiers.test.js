import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {V2_SIZES,validateFocus,FOCUS_VERSION} from '../lib/focus.js';
import {buildReportV3} from '../lib/report-v3.js';

const approved={roleTitle:'Operations Team Leader',seniority:'Manager',requirements:[
  {text:'Interpret service performance data and identify operational risks',category:'Domain',priority:'Must Have'},
  {text:'Coach team members using evidence from quality reviews',category:'Leadership',priority:'Must Have'},
  {text:'Resolve escalated customer issues using balanced judgement',category:'Behavioural',priority:'Must Have'},
  {text:'Use workforce and reporting systems to manage service delivery',category:'Tools',priority:'Important'}]};
const plan=validateFocus({targetCount:20,groups:[
  {name:'Operational Performance',rationale:'Interpret and improve operational performance',importance:'Critical',questionCount:5,requirementIndices:[0]},
  {name:'Coaching and Quality',rationale:'Apply effective coaching based on evidence',importance:'Critical',questionCount:5,requirementIndices:[1]},
  {name:'Escalation Judgement',rationale:'Resolve complex customer escalations',importance:'Critical',questionCount:5,requirementIndices:[2]},
  {name:'Systems and Workforce Decisions',rationale:'Use systems to make sound operational decisions',importance:'High',questionCount:5,requirementIndices:[3]}
]},approved);
const options=['Review the evidence and compare likely operational impacts','Apply a temporary change while measuring the result','Escalate only after checking ownership and risk','Gather additional data before making a permanent change'];
const questions=Array.from({length:20},(_,i)=>({id:`q-${i+1}`,text:`Scenario ${i+1}: Which response best balances the competing operational constraints?`,topicTitle:`Distinct topic ${i+1}`,
  competencyId:`c${Math.floor(i/5)+1}`,requirementIndex:Math.floor(i/5),type:['Knowledge','Situational judgement','Problem solving','Leadership'][i%4],
  options,correctIndex:0,rationale:'The preferred option uses evidence and evaluates trade-offs before committing to a permanent action.'}));
const assignment={id:'attempt',orgId:'org',jobId:'job',name:'Candidate',email:'candidate@example.com',questionMap:{order:questions.map(q=>q.id)},
  answers:Object.fromEntries(questions.map((q,i)=>[q.id,{index:i<14?0:1,changes:i%7===0?1:0}])),questionMs:Object.fromEntries(questions.map((q,i)=>[q.id,(12+i)*1000])),
  startedAt:100000,deadlineAt:1900000,durationMinutes:30,integrityEvents:[]};

test('assessment tiers carry future credit usage without charging in pilot',()=>{
  assert.deepEqual(V2_SIZES[20],{groups:4,minutes:30,tier:'Essential',credits:1});
  assert.equal(V2_SIZES[30].tier,'Standard');assert.equal(V2_SIZES[30].credits,1.5);
  assert.equal(V2_SIZES[40].tier,'Advanced');assert.equal(V2_SIZES[40].credits,2);
  assert.equal(plan.tier,'Essential');assert.equal(plan.creditCost,1);
});

test('V3.2 report includes richer tested-evidence sections only',()=>{
  const report=buildReportV3(assignment,{title:approved.roleTitle,approvedRequirements:approved},
    {questions,focus:plan,version:1,questionVersion:FOCUS_VERSION,assessmentTier:'Essential',creditCost:1},500000,'submitted',assignment.questionMs);
  assert.equal(report.reportDetailVersion,'3.2');
  assert.equal(report.profile.reportDetailVersion,'3.2');
  assert.equal(report.profile.questionTypePerformance.length,4);
  assert.equal(report.profile.competencyInsights.length,4);
  assert(report.profile.timingProfile.averageActiveSeconds>0);
  assert.match(report.profile.summary,/questions correctly/);
  assert(!/not tested|insufficient evidence|broader test coverage/i.test(report.profile.summary));
  assert(report.profile.interviewValidation.length>=4);
});

test('dropdowns are compact on desktop and assessment tiers are visible',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.match(html,/Essential — 20 questions · ~30 min · 1 credit/);
  assert.match(html,/Standard — 30 questions · ~45 min · 1\.5 credits/);
  assert.match(html,/Advanced — 40 questions · ~60 min · 2 credits/);
  assert.match(css,/select\{width:auto;min-width:180px;max-width:280px/);
  assert.match(css,/\.compact-select\{width:auto;min-width:220px;max-width:320px/);
});

test('report UI contains richer professional sections and standard capitalization',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  for(const heading of ['Candidate Assessment Summary','Performance by Competency','Performance by Question Type','Response Pattern and Timing','Suggested Interview Validation','About This Assessment'])
    assert(app.includes(heading),`${heading} missing`);
  assert(app.includes('Detailed Question Evidence'));
  assert(!app.slice(app.indexOf('function renderV3Report'),app.indexOf('async function openReport')).includes('Broader test coverage'));
});
