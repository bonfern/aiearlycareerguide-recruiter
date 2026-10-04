import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {QUESTION_VERSION} from '../lib/assessment.js';
import {FOCUS_VERSION,FOCUS_V2,validateFocus,validateQuestionCoverage} from '../lib/focus.js';
import {questionIssues,auditAssessment,validateBlueprint} from '../lib/quality.js';
import {buildReport} from '../lib/candidate.js';
import {visibleIntegrity,summarizeEvidence} from '../lib/report-v3.js';
const approved={roleTitle:'Call Centre Team Leader',seniority:'Manager',requirements:[
  {text:'Improve call-centre performance against SLAs and customer experience metrics',category:'Domain',priority:'Must Have'},
  {text:'Coach agents and lead quality assurance',category:'Leadership',priority:'Must Have'},
  {text:'Handle complex customer escalations',category:'Behavioural',priority:'Important'},
  {text:'Use call centre analytics and workforce systems',category:'Tools',priority:'Must Have'},
  {text:'Demonstrate clear verbal communication',category:'Behavioural',priority:'Important'},
  {text:'Three years of managerial experience',category:'Experience',priority:'Must Have'}]};
const names=['Operations & performance management','Agent coaching & quality','Escalation decisions','Data interpretation'];
const plan=validateFocus({targetCount:20,groups:names.map((name,i)=>({name,rationale:`Apply ${name} in complex settings`,importance:'Critical',questionCount:5,requirementIndices:[i]}))},approved);
const goodOptions=[
  'Review the service data by interval and identify when capacity diverges from demand',
  'Add limited peak-hour coverage while collecting additional evidence about call mix',
  'Test whether the quality checklist is increasing handling time for complex enquiries',
  'Investigate agent-level performance with a sample of atypical call recordings'
];
const q=(id,c,req,selected=0)=>({id:`question-${id}`,text:`Given operational constraint ${id}, which intervention should you prioritize after analysing the available service data?`,
  topicTitle:`Distinct objective number ${id}`,difficulty:'Challenging',options:goodOptions.map(x=>`${x} (${id})`),
  correctIndex:0,requirementIndex:req,competencyId:c,type:'Problem solving',rationale:'The preferred approach targets the root cause while retaining appropriate service safeguards.',source:'ai'});
const questions=Array.from({length:20},(_,i)=>q(i+1,`c${Math.floor(i/5)+1}`,Math.floor(i/5)));
// Deliberately remove templated wording in report fixtures so quality checks are tested independently.
const assignment=(correctCount=20,events=[])=>({id:'attempt-v3',orgId:'org-1',jobId:'job-1',name:'Test Person',email:'test@example.com',
  questionMap:{order:questions.map(q=>q.id),options:Object.fromEntries(questions.map(q=>[q.id,[0,1,2,3]]))},
  answers:Object.fromEntries(questions.map((q,i)=>[q.id,{index:i<correctCount?0:1,changes:0}])),questionMs:{},
  startedAt:100000,deadlineAt:1900000,currentIndex:19,activeSince:220000,isForeground:true,durationMinutes:30,integrityEvents:events});
test('V3 focus raises minimum length to 20 and excludes eligibility-only requirements',()=>{
  assert.equal(plan.version,FOCUS_VERSION);assert.notEqual(FOCUS_V2,FOCUS_VERSION);
  assert.equal(plan.targetCount,20);assert.deepEqual(plan.notTestedMustHaveIndices,[]);
  assert.equal(validateQuestionCoverage(questions,plan),true);
});
test('blueprint rejects repeated topics and repeated scenarios across role competencies',()=>{
  const slots=questions.map(q=>({competencyId:q.competencyId,requirementIndex:q.requirementIndex,
    topicTitle:q.topicTitle,scenario:`${['Analyze schedule coverage after unforeseen absence','Interpret regional customer satisfaction anomalies','Investigate overnight technical routing disruptions','Estimate training impact on average handling','Prioritize quality audits after new compliance rule','Evaluate contested performance coaching evidence','Balance agent wellbeing against peak volumes','Compare alternative escalation ownership models','Diagnose inconsistent quality score calibration','Select mitigation for holiday demand volatility','Resolve duplicate case records in CRM','Plan recovery from deferred service backlog','Assess rising transfer rate across teams','Evaluate operational impact of system migration','Compare supplier handoff timing constraints','Identify poor sampling in quality dashboards','Manage sudden attrition in specialist queue','Investigate abandoned contacts during outage','Choose safe rollout for revised call scripts','Respond to conflicting service and cost targets'][Number(q.id.split('-')[1])-1]} with documented competing priorities`,
    decisionTarget:`Compare distinct remedies for specific scenario ${q.id}`,difficulty:'Challenging'}));
  assert.equal(validateBlueprint(slots,plan).length,20);
  const duplicate=slots.map(x=>({...x}));duplicate[7].topicTitle=duplicate[6].topicTitle;
  assert.throws(()=>validateBlueprint(duplicate,plan),/repeats an assessment topic/);
});
test('quality checker catches shift-swap repeats and obvious distractors',()=>{
  const first={id:'q-1',topicTitle:'Evaluate shift swap coverage',text:'A staff member asks to swap their shift due to a family commitment. Which action is best?',
    correctIndex:1,options:[...goodOptions]};
  const second={id:'q-2',topicTitle:'Evaluate shift swap coverage',text:'An employee wants to swap shifts due to a personal commitment. What would you do first?',
    correctIndex:0,options:[...goodOptions]};
  const issues=questionIssues(second,[first]);assert(issues.some(x=>/Repeated assessment topic/.test(x)));
  const bad={id:'q-3',topicTitle:'Unrelated',text:'How should you resolve the problem?',correctIndex:0,
    options:['Review the constraints and assess impact','Ignore the issue','Always refuse the request','Do nothing']};
  assert(questionIssues(bad,[]).some(x=>/implausible/.test(x)));
  assert(auditAssessment([first,second]).length>0);
  const misleading={id:'q-4',topicTitle:'Metric question',text:'Which metric measures first call resolution?',options:[...goodOptions],correctIndex:0};
  assert(questionIssues(misleading,[],{name:'Communication and conflict resolution'}).some(x=>/does not by itself/.test(x)));
});
test('V3 reports do not invent communication skill or claim real-world experience',()=>{
  const report=buildReport(assignment(),{title:approved.roleTitle,approvedRequirements:approved},
    {questions,focus:plan,version:1,questionVersion:FOCUS_VERSION},300000);
  assert.equal(report.reportVersion,3);assert.equal(report.score,100);assert.equal(report.correct,20);
  assert(!/strong communication|comprehensive skill|software proficiency|verified experience/i.test(report.profile.summary));
  assert(report.profile.interviewValidation.length>=4);
  assert(!Object.hasOwn(report.profile,'eligibilityChecks'));
  assert(!Object.hasOwn(report.profile,'notTestedMustHaves'));
  assert(report.details.every(q=>q.options.length===4&&q.timeSeconds>=0));
});
test('a single tab blur or server delay does not create an integrity flag',()=>{
  assert.equal(visibleIntegrity([{type:'window_blur',at:100000},{type:'window_focus',at:120000}]).confirmedTabChanges,0);
  assert.equal(visibleIntegrity([{type:'tab_hidden',at:100000},{type:'tab_visible',at:106000}]).confirmedTabChanges,0);
  assert.equal(visibleIntegrity([{type:'sustained_tab_change',at:100000,durationSeconds:18}]).confirmedTabChanges,1);
});
test('recruiter PDF starts with official logo and omits workflow chrome in print',()=>{
  const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const styles=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert(index.includes('class="report-brand"'));assert(index.includes('assets/brand-logo.png'));
  assert(styles.includes('#job-panel>.section-head,#requirements-section'));
  assert(app.includes("if(r.reportVersion===3){renderV3Report(content,r)"));
  assert(app.includes('function renderV3Report'));
  assert(!app.slice(app.indexOf('function renderV3Report'),app.indexOf('async function openReport')).includes('eligibilityChecks'));
});
test('one Vercel function on Hobby, other handlers outside API directory',()=>{
  assert.deepEqual(readdirSync(new URL('../api/',import.meta.url)).filter(x=>x.endsWith('.js')),['router.js']);
  assert(existsSync(new URL('../server/generate-questions.js',import.meta.url)));
});
test('old V2 report builder stays available for historical assessments',()=>{
  const report=buildReport(assignment(),{title:approved.roleTitle,approvedRequirements:approved},
    {questions,focus:plan,version:1,questionVersion:FOCUS_V2},300000);
  assert.equal(report.reportVersion,2);
});

test('paraphrased shift swaps are caught even if titles and most words differ',()=>{
  const prior={id:'q-7',topicTitle:'Maintain fair staffing',text:'A new employee requests a shift swap because of a family commitment. Choose the next action.',options:goodOptions,correctIndex:0};
  const repeated={id:'q-8',topicTitle:'Manage operational continuity',text:'A colleague needs to exchange shifts following a personal scheduling conflict. What should the supervisor prioritize?',options:goodOptions,correctIndex:0};
  assert(questionIssues(repeated,[prior]).some(x=>/Repeated shift swap scenario/.test(x)));
});
test('a single cartoonishly bad answer option is rejected',()=>{
  const question={id:'q-99',text:'Call volume increased by forty percent while satisfaction declined. Which response should be prioritised?',correctIndex:0,
    options:[goodOptions[0],goodOptions[1],goodOptions[2],'Ignore the increased demand']};
  assert(questionIssues(question,[]).some(x=>/obviously implausible/.test(x)));
});
test('generator displays retry progress after a rejected question batch',()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.match(app,/Revising questions that failed the quality check/);
  assert.match(app,/retry<3/);
});
