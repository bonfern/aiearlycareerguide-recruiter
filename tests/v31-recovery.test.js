import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {testableIndices,isTestableSkill,validateFocus,nextAssignments} from '../lib/focus.js';
import {validateBlueprintBatch,validateBlueprint} from '../lib/quality.js';
const approved={roleTitle:'Team Leader',seniority:'Manager',requirements:[
 {text:'Minimum 5 years of experience leading teams',category:'Technical',priority:'Must Have'},
 {text:'Bachelor degree in business administration',category:'Behavioural',priority:'Must Have'},
 {text:'Manage complex service-level performance trade-offs',category:'Domain',priority:'Must Have'},
 {text:'Interpret call centre analytics and staffing forecasts',category:'Technical',priority:'Must Have'},
 {text:'Coach underperforming colleagues with tailored improvement plans',category:'Leadership',priority:'Important'},
 {text:'Apply conflict-resolution judgement to difficult customer situations',category:'Behavioural',priority:'Important'},
 {text:'7 years of prior employment',category:'Other',priority:'Must Have'}]};
const groups=['Operations analysis','Staffing analytics','Coaching interventions','Escalation decisions'].map((name,i)=>({name,
 rationale:`Evaluate distinct decisions in ${name}`,importance:'Critical',questionCount:5,requirementIndices:[i+2]}));
const focus=validateFocus({targetCount:20,groups},approved);
test('qualifications and tenure are excluded even when AI mislabels categories',()=>{
 assert.deepEqual(testableIndices(approved),[2,3,4,5]);
 for(const item of [approved.requirements[0],approved.requirements[1],approved.requirements[6],
   {category:'Technical',text:'2–5 years of relevant experience'}])assert.equal(isTestableSkill(item),false);
 assert.throws(()=>validateFocus({targetCount:20,groups:groups.map((g,i)=>i===0?{...g,requirementIndices:[0]}:g)},approved),/testable approved requirement/);
 assert.throws(()=>validateFocus({targetCount:20,groups:groups.map((g,i)=>i===0?{...g,name:'Educational qualifications'}:g)},approved),/not education or years/);
});
test('planning one competency at a time preserves distinct partial groups',()=>{
 const slots=nextAssignments(approved,focus,[],20);
 assert.equal(slots.length,20);
 assert(slots.every(slot=>slot.requirementIndex>=2&&slot.requirementIndex<=5));
 const uniqueSituations=['Review interval staffing demand after a system outage','Investigate newly observed abandonment in regional queues','Compare forecast error following seasonal volume spikes','Prioritise backlog recovery under temporary headcount restrictions','Examine outlier calls after policy revisions','Interpret inconsistent dashboard data across sites','Assess scheduling tradeoffs under rapid channel migration','Compare workforce forecast scenarios for an upcoming launch','Diagnose training gaps using quality sampling data','Evaluate handling-time drivers in complex products','Provide feedback after an unsuccessful coaching meeting','Design an improvement plan for recurring process mistakes','Analyse reasons a previous quality intervention failed','Decide when a probationary support intervention must change','Determine how to assess sustained coaching progress','Triage an escalated customer case involving multiple owners','Choose actions when a complex billing correction crosses teams','Resolve conflicting customer and regulatory obligations','Identify handoff gaps after a product support incident','Design a resolution path for complaints with incomplete facts'];
 let partial=[];let cursor=0;
 for(const group of focus.groups){
   const batch=slots.filter(slot=>slot.competencyId===group.id).map((slot,i)=>({...slot,
     topicTitle:`${group.name} unique topic ${i+1}`,scenario:`${uniqueSituations[cursor+i]} with realistic competing constraints`,
     decisionTarget:`Decide the most suitable action for ${uniqueSituations[cursor+i]}`,difficulty:'Challenging'}));
   partial=validateBlueprintBatch(partial,batch,focus);cursor+=batch.length;
 }
 assert.equal(partial.length,20);
 assert.equal(validateBlueprint(partial,focus).length,20);
 assert.throws(()=>validateBlueprintBatch(partial.slice(0,-1),[partial[0]],focus),/Too many scenarios|repeats/);
});
test('generator has a short timeout, durable planning state, and smaller AI batches',()=>{
 const server=readFileSync(new URL('../server/generate-questions.js',import.meta.url),'utf8');
 const client=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const markup=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(server,/const BATCH=3/);assert.match(server,/35000/);assert.match(server,/blueprintDraft/);
 assert.match(server,/generationLock:null/);assert.match(server,/gpt-5\.6-terra/);
 assert.match(client,/reset-draft-btn/);assert.match(markup,/reset-draft-btn/);
 assert.deepEqual(readdirSync(new URL('../api/',import.meta.url)).filter(x=>x.endsWith('.js')),['router.js']);
});
