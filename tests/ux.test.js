import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const candidate=read('candidate.js'),client=read('candidate.html'),recruiter=read('index.html'),dashboard=read('app.js');
test('official site logo is present on both pages and PDF report',()=>{
  assert.ok(existsSync(new URL('../assets/brand-logo.png',import.meta.url)));
  assert.ok(recruiter.includes('/assets/brand-logo.png'));
  assert.ok(client.includes('/assets/brand-logo.png'));
  assert.ok(recruiter.includes('class="report-brand"'));
});
test('candidate navigation awaits a pending answer save',()=>{
  assert.match(candidate,/if\(pendingAnswerSave\)await pendingAnswerSave/);
  assert.match(candidate,/pendingAnswerSave=request/);
  assert.doesNotMatch(candidate,/if\(!model\|\|busy\|\|next===index/);
});
test('submit appears only on last question and next hides',()=>{
  assert.match(candidate,/candidate-next'\)\.classList\.toggle\('hidden',index===questions\.length-1\)/);
  assert.match(candidate,/candidate-submit'\)\.classList\.toggle\('hidden',index!==questions\.length-1\)/);
});
test('test view remains mounted during question navigation and fullscreen is not forced',()=>{
  assert.match(candidate,/if\(byId\('candidate-test'\)\.classList\.contains\('hidden'\)\)view/);
  assert.doesNotMatch(candidate,/requestFullscreen\(/);
  assert.ok(!client.includes('fullscreen-opt-in'));
});
test('recruiter jobs, requirements, question bank and candidates can collapse',()=>{
  for(const id of ['requirements-section','assessment-box','candidates-box']){
    assert.ok(recruiter.includes(`<details id="${id}"`));
  }
  assert.ok(recruiter.includes('class="card dashboard-jobs"'));
  assert.match(dashboard,/const card=document\.createElement\('details'\)/);
  assert.doesNotMatch(dashboard,/box\.scrollIntoView/);
});
