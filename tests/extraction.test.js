import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanExtraction, validateRecruiterRequirements, findSimilarApprovedRoles, requirementSimilarity, templateKey} from '../lib/extraction.js';

const base = {roleTitle:'Senior Finance Analyst', seniority:'Senior', experience:'5+ years', summary:'Finance analysis',
  requirements:[
    {text:'Advanced financial modelling', category:'Technical', priority:'Must Have', evidence:'Financial modelling required'},
    {text:'Power BI reporting', category:'Tools', priority:'Must Have', evidence:'Power BI required'},
    {text:'Business partnering', category:'Behavioural', priority:'Important', evidence:'Partner with sales'}
  ]};
test('cleans extraction and discards duplicate requirements', () => {
  const data = cleanExtraction({...base, requirements:[...base.requirements, {...base.requirements[0]}]});
  assert.equal(data.requirements.length,3);
});
test('rejects invalid and duplicate approved requirements', () => {
  assert.throws(() => validateRecruiterRequirements({...base, requirements: []}), /1–40/);
  assert.throws(() => validateRecruiterRequirements({...base, requirements: [base.requirements[0],base.requirements[0]]}), /duplicate/);
});
test('suggests same-seniority similar org-vetted template but excludes mismatched seniority', () => {
  const candidates = [{jobId:'a', ...base},{jobId:'b',...base,seniority:'Entry'}];
  const matches = findSimilarApprovedRoles(base,candidates,'new');
  assert.equal(matches.length,1); assert.equal(matches[0].jobId,'a');
});
test('does not suggest template with incompatible must-haves', () => {
  const incoming = {...base, requirements:base.requirements.filter(r => r.text !== 'Power BI reporting')};
  assert.equal(findSimilarApprovedRoles(incoming,[{jobId:'a',...base}],'new').length,0);
});
test('similarity operates on normalized words', () => {
  assert.equal(requirementSimilarity('Finance, Reporting!', 'finance reporting'),1);
  assert.notEqual(templateKey('org-a',base),templateKey('org-b',base));
});
