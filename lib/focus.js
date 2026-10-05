import {createHash} from 'node:crypto';
import {requirementSimilarity} from './extraction.js';

export const FOCUS_VERSION='critical-competencies-v3';
export const FOCUS_V2='critical-competencies-v2';
export const isFocusedVersion=value=>[FOCUS_VERSION,FOCUS_V2].includes(value);
export const V2_SIZES=Object.freeze({
  20:{groups:4,minutes:30,tier:'Essential',credits:1},
  30:{groups:5,minutes:45,tier:'Standard',credits:1.5},
  40:{groups:6,minutes:60,tier:'Advanced',credits:2}
});
const text=(value,max=250)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const norm=value=>text(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// Test only demonstrable skills. Years of experience and educational credentials are
// eligibility checks even when AI accidentally files them as Technical or Behavioural.
export function isTestableSkill(requirement){
  const category=String(requirement?.category||'').trim();
  if(!['Technical','Domain','Behavioural','Leadership','Tools','Other'].includes(category))return false;
  const value=String(requirement?.text||'').toLowerCase().replace(/\s+/g,' ').trim();
  if(!value)return false;
  const eligibility=/\b(?:\d+\s*(?:(?:-|–|to|\+)\s*\d+\s*)?years?|years?\s+of\s+(?:work|relevant|professional|industry|leadership|management|prior|hands-on)?\s*experience|minimum\s+experience|prior\s+employment|employment\s+history|previous\s+employment|previously\s+worked|work\s+authorization|visa\s+status|bachelor'?s?|master'?s?|ph\.?d\.?|degree|diploma|graduat(?:e|ion)|education|educational\s+qualification|high\s+school|college\s+degree|university\s+degree|certificat(?:e|ion|ions)|certification\s+required)\b/i;
  if(eligibility.test(value))return false;
  if(category==='Other'&&!/\b(?:analy[sz]|develop|manage|design|interpret|communicat|negotiat|problem.solv|lead|coach|stakeholder|software|tools?|process|data|program|technical|compliance|customer|operations|research|planning|critical thinking)\b/i.test(value))return false;
  return true;
}
export const testableIndices=approved=>approved.requirements.map((r,i)=>({r,i})).filter(({r})=>isTestableSkill(r)).map(({i})=>i);
export function validateFocus(raw,approved){
  const targetCount=Number(raw?.targetCount),config=V2_SIZES[targetCount];
  if(!config)throw new Error('Select 20, 30 or 40 questions');
  if(!Array.isArray(raw.groups)||raw.groups.length!==config.groups)throw new Error(`Select exactly ${config.groups} critical competency groups for ${targetCount} questions`);
  const allowed=new Set(testableIndices(approved));
  if(!allowed.size)throw new Error('This JD contains no testable skills. Review the approved requirements.');
  const seenNames=new Set();let total=0;
  const groups=raw.groups.map((g,i)=>{
    const name=text(g?.name,95),rationale=text(g?.rationale,330),questionCount=Number(g?.questionCount);
    if(!Array.isArray(g?.requirementIndices))throw new Error(`Competency ${i+1}: select approved requirements`);
    const indices=[...new Set(g.requirementIndices)];
    if(name.length<5||seenNames.has(norm(name)))throw new Error(`Competency ${i+1}: enter a unique descriptive name`);
    if(/\b(?:years?\s+(?:of\s+)?experience|experience\s+in\s+years|educational?\s+qualifications?|education|degree|diploma|graduation|certification\s+possession|employment\s+history|work\s+tenure)\b/i.test(name+' '+rationale))
      throw new Error(`Competency ${i+1}: test technical or behavioural skills, not education or years of experience`);
    seenNames.add(norm(name));
    if(!Number.isInteger(questionCount)||questionCount<3||questionCount>12)throw new Error(`Competency ${i+1}: use 3–12 questions`);
    if(!indices.length||indices.length>8||indices.some(x=>!Number.isInteger(x)||!allowed.has(x)))throw new Error(`Competency ${i+1}: link at least one testable approved requirement`);
    total+=questionCount;
    return {id:`c${i+1}`,name,rationale,questionCount,requirementIndices:indices,
      importance:['Critical','High'].includes(g?.importance)?g.importance:'High'};
  });
  if(total!==targetCount)throw new Error(`Allocate exactly ${targetCount} questions; currently ${total}`);
  const covered=new Set(groups.flatMap(g=>g.requirementIndices));
  const critical=testableIndices(approved).filter(i=>approved.requirements[i].priority==='Must Have');
  // Some JDs contain more must-haves than a focused assessment can test; mark uncovered ones in the report instead.
  return {version:FOCUS_VERSION,targetCount,defaultMinutes:config.minutes,tier:config.tier,creditCost:config.credits,groups,
    testedRequirementIndices:[...covered],notTestedMustHaveIndices:critical.filter(i=>!covered.has(i))};
}
export function defaultFocus(targetCount,approved,groupIdeas){
  const config=V2_SIZES[targetCount];if(!config)throw new Error('Invalid assessment length');
  const allowed=testableIndices(approved);
  if(!allowed.length)throw new Error('Add a testable role requirement before creating an assessment');
  const groups=groupIdeas.slice(0,config.groups).map((idea,i)=>({
    name:text(idea.name,95),rationale:text(idea.rationale,330),importance:idea.importance,
    requirementIndices:[...new Set((idea.requirementIndices||[]).filter(x=>allowed.includes(x)))],
    questionCount:Math.floor(targetCount/config.groups)+(i<targetCount%config.groups?1:0)}));
  // Reject incomplete AI output instead of filling gaps with unrelated competencies.
  return validateFocus({targetCount,groups},approved);
}
export function focusSignature(orgId,approved,focus){
  if(!orgId||!isFocusedVersion(focus?.version))throw new Error('Invalid focus signature');
  const data=[focus.version,orgId,norm(approved.roleTitle),approved.seniority,focus.targetCount,
    ...focus.groups.map(g=>[norm(g.name),g.questionCount,g.requirementIndices.map(i=>norm(approved.requirements[i]?.text)).sort().join('|')].join(':'))];
  return createHash('sha256').update(data.join('::')).digest('hex');
}
export function nextAssignments(approved,focus,questions,amount){
  const current=Object.fromEntries(focus.groups.map(g=>[g.id,questions.filter(q=>q.competencyId===g.id).length]));
  const output=[];
  for(let n=0;n<amount;n++){
    const candidates=focus.groups.filter(g=>current[g.id]<g.questionCount);
    if(!candidates.length)break;
    candidates.sort((a,b)=>current[a.id]/a.questionCount-current[b.id]/b.questionCount||
      (a.importance==='Critical'?-1:1)-(b.importance==='Critical'?-1:1));
    const g=candidates[0];
    const reqCounts=g.requirementIndices.map(i=>questions.concat(output).filter(q=>q.requirementIndex===i).length);
    const minimum=Math.min(...reqCounts);
    const index=g.requirementIndices[reqCounts.indexOf(minimum)];
    output.push({competencyId:g.id,requirementIndex:index});current[g.id]++;
  }
  return output;
}
export function validateQuestionCoverage(questions,focus){
  if(questions.length!==focus.targetCount)throw new Error(`Assessment must contain ${focus.targetCount} questions`);
  for(const g of focus.groups){
    const chosen=questions.filter(q=>q.competencyId===g.id);
    if(chosen.length!==g.questionCount)throw new Error(`${g.name} needs ${g.questionCount} questions; currently ${chosen.length}`);
    if(chosen.some(q=>!g.requirementIndices.includes(q.requirementIndex)))throw new Error(`${g.name} contains a question mapped to an unrelated requirement`);
  }
  return true;
}
export function compatibleCachedQuestions(approved,focus,templates,orgId){
  const signature=focusSignature(orgId,approved,focus);
  let exact=templates.find(t=>t.orgId===orgId&&t.questionVersion===FOCUS_VERSION&&t.signature===signature&&
    t.focus?.groups?.length===focus.groups.length&&t.questions?.length===focus.targetCount);
  const result=[];const used=new Set();
  for(const tmpl of exact?[exact]:templates){
    if(tmpl.orgId!==orgId||tmpl.questionVersion!==FOCUS_VERSION||tmpl.seniority!==approved.seniority||!tmpl.focus?.groups||!tmpl.requirements)continue;
    if(!exact&&requirementSimilarity(tmpl.roleTitle,approved.roleTitle)<0.8)continue;
    for(const q of tmpl.questions||[]){
      if(result.length >= (exact?focus.targetCount:Math.floor(focus.targetCount*0.6)))break;
      const oldGroup=tmpl.focus.groups.find(g=>g.id===q.competencyId);
      const group=focus.groups.find(g=>oldGroup&&norm(g.name)===norm(oldGroup.name));
      if(!group||result.filter(item=>item.competencyId===group.id).length>=group.questionCount)continue;
      const oldReq=tmpl.requirements[q.requirementIndex];if(!oldReq)continue;
      const newIndex=group.requirementIndices.find(i=>approved.requirements[i].category===oldReq.category&&
        requirementSimilarity(approved.requirements[i].text,oldReq.text)>=0.85);
      if(newIndex===undefined||used.has(norm(q.text)))continue;
      used.add(norm(q.text));result.push({...q,competencyId:group.id,requirementIndex:newIndex,source:exact?'exact-cache':'similar-cache'});
    }
    if(exact||result.length>=Math.floor(focus.targetCount*0.6))break;
  }
  return {questions:result,source:exact?'exact-cache':result.length?'similar-cache':'new',reused:result.length};
}
