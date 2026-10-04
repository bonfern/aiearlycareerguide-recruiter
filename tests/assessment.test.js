import test from 'node:test';
import assert from 'node:assert/strict';
import {assessmentSignature, cleanQuestions, reusableQuestions, nextRequirements} from '../lib/assessment.js';
const req = (text,category='Technical',priority='Must Have')=>({text,category,priority,evidence:''});
const approved={roleTitle:'Senior Finance Analyst',seniority:'Senior',experience:'5-8 years',summary:'',requirements:[
  req('Financial modelling and scenario analysis'),req('Forecasting and budgeting','Domain'),req('Power BI','Tools','Important')]};
const item=(index=0)=>({id:'q-test-001',text:'When the forecast diverges from actual spending, what is the most defensible first action?',
  options:['Reconcile the data and investigate key drivers','Change the forecast to match actuals','Ignore the variance','Escalate without reviewing underlying data'],
  correctIndex:0,requirementIndex:index,type:'Problem solving',rationale:'Validate the underlying data and then investigate variance drivers.',source:'ai'});

test('exact signatures isolate organizations and changed requirements',()=>{
  const a=assessmentSignature('ORG-A',approved);
  assert.notEqual(a,assessmentSignature('ORG-B',approved));
  assert.notEqual(a,assessmentSignature('ORG-A',{...approved,requirements:[req('Financial forecasting')]}));
  assert.equal(a,assessmentSignature('ORG-A',{...approved,requirements:[approved.requirements[2],approved.requirements[0],approved.requirements[1]]}));
});
test('published exact template reuses all with remapped requirements',()=>{
  const changedOrder={...approved,requirements:[approved.requirements[2],approved.requirements[0],approved.requirements[1]]};
  const template={orgId:'ORG-A',roleTitle:approved.roleTitle,seniority:'Senior',requirements:approved.requirements,
    signature:assessmentSignature('ORG-A',approved),questions:Array.from({length:15},(_,i)=>({...item(i%3),id:`q-${i}-test`,text:`${item().text} Scenario ${i+1}?`}))};
  const result=reusableQuestions(changedOrder,[template],15,'ORG-A');
  assert.equal(result.source,'exact-cache');assert.equal(result.questions.length,15);
  assert.equal(result.questions[0].requirementIndex,1);
  assert.equal(result.questions[2].requirementIndex,0);
  assert.notEqual(result.questions[0].id,template.questions[0].id);
});
test('different organizations never share template questions',()=>{
  const template={orgId:'ORG-B',roleTitle:approved.roleTitle,seniority:'Senior',requirements:approved.requirements,
    signature:assessmentSignature('ORG-B',approved),questions:[item()]};
  assert.equal(reusableQuestions(approved,[template],15,'ORG-A').questions.length,0);
});
test('similar role reuses no more than 60% and rejects different seniority or missing must haves',()=>{
  const template={orgId:'ORG-A',roleTitle:'Senior Finance Analyst',seniority:'Senior',requirements:approved.requirements,
    signature:'other',questions:Array.from({length:18},(_,i)=>({...item(i%3),text:`${item().text} Distinct scenario ${i}?`}))};
  const similar=reusableQuestions(approved,[template],15,'ORG-A');
  assert.equal(similar.source,'similar-cache');assert.equal(similar.questions.length,9);
  assert.equal(reusableQuestions(approved,[{...template,seniority:'Entry'}],15,'ORG-A').questions.length,0);
  assert.equal(reusableQuestions({...approved,requirements:[req('Statutory financial reporting')]},[template],15,'ORG-A').questions.length,0);
});
test('question editing validation rejects duplicate options and invalid mapped requirement',()=>{
  assert.equal(cleanQuestions([item()],approved).length,1);
  assert.throws(()=>cleanQuestions([{...item(),options:['A','A','B','C']}],approved),/four different/);
  assert.throws(()=>cleanQuestions([{...item(),requirementIndex:99}],approved),/JD requirement/);
  assert.throws(()=>cleanQuestions([item(),item()],approved),/Duplicate/);
});
test('question allocation favors underrepresented must-haves',()=>{
  const indices=nextRequirements(approved,[item(0),item(0),item(0)],6);
  assert.equal(indices.length,6);
  assert.equal(indices[0],1);
});
