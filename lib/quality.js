/** V3 quality controls: inspect the complete assessment, not isolated batches. */
export const QUALITY_VERSION='assessment-quality-v3';
const stop=new Set('a an the and or of to for with in on at by from into as is are your their this that which what when how best most first should would do you team agent customer manager call center it its about after before during due using effectively approach action correct option following'.split(' '));
const words=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!stop.has(w));
const terms=s=>new Set(words(s));
// Detect narrow repeated workplace scenarios even where a model paraphrases the wording.
// A general theme such as coaching is intentionally not banned: diagnosis, feedback and
// progress review can test distinct decisions. Repeating the same shift-swap or customer-
// escalation decision, however, adds little evidence to a short assessment.
export function repeatedScenarioFamily(text=''){
  const s=String(text).toLowerCase();
  if(/(?:shift.{0,30}(?:swap|change|exchange)|(?:swap|exchange).{0,30}shift|schedule.{0,25}swap)/.test(s))return 'shift swap';
  if(/(?:customer.{0,35}(?:complaint|escalat)|(?:complaint|escalat).{0,35}customer)/.test(s)&&
     /(?:take ownership|escalat|resolve|transfer|handle)/.test(s))return 'customer escalation';
  if(/(?:call.{0,15}(?:recording|monitoring)|crm.{0,30}coaching|software.{0,35}coaching)/.test(s)&&
     /(?:coach|feedback|agent.{0,20}performance)/.test(s))return 'coaching software feature';
  return null;
}
export function overlap(a,b){const x=terms(a),y=terms(b);if(!x.size||!y.size)return 0;const same=[...x].filter(w=>y.has(w)).length;return same/Math.min(x.size,y.size);}
export function questionIssues(candidate,prior=[],group=null){
  const issues=[];
  const title=String(candidate.topicTitle||'').trim().toLowerCase();
  for(const old of prior){
    if(old.id&&old.id===candidate.id)continue;
    if(title&&old.topicTitle&&title===String(old.topicTitle).trim().toLowerCase())issues.push('Repeated assessment topic');
    if(overlap(candidate.text,old.text)>=0.72)issues.push('Similar wording or scenario to another question');
    const candidateFamily=repeatedScenarioFamily(candidate.text),priorFamily=repeatedScenarioFamily(old.text);
    if(candidateFamily&&candidateFamily===priorFamily)issues.push(`Repeated ${candidateFamily} scenario`);
  }
  // Catch common but materially misleading group mappings from earlier versions.
  const name=String(group?.name||'').toLowerCase(),question=String(candidate.text||'').toLowerCase();
  if(/communication|conflict resolution/.test(name)&&
    /\b(aht|fcr|metric|average handle time|first call resolution|abandonment rate)\b/.test(question)&&
    !/communicat|discuss|respond|explain|present|message|conversation|feedback|de.escalat/.test(question))
    issues.push('Operational-metrics knowledge does not by itself test communication delivery');
  if(/software|system proficiency|tool proficiency/.test(name)&&
    /shift swap|shift change|coaching session|underperforming agent/.test(question)&&
    !/software|system|crm|dashboard|analytics|recording|application|platform/.test(question))
    issues.push('The scenario does not test software or systems knowledge');
  const options=candidate.options||[];
  if(options.length===4){
    const bad=options.filter(o=>/\b(ignore|never|always|randomly|do nothing|hope it|automatically approve all|regardless of|without considering|without checking|avoid giving feedback|only highlight mistakes|publicly criticize)\b/i.test(o));
    if(bad.length>=1)issues.push('An answer choice is obviously implausible');
    const lengths=options.map(x=>words(x).length),best=lengths[Number(candidate.correctIndex)];
    if(best>=10&&best>Math.max(...lengths.filter((_,i)=>i!==candidate.correctIndex))*1.9)
      issues.push('Correct answer is noticeably longer than the alternatives');
    if(options.some((x,i)=>options.some((y,j)=>i!==j&&overlap(x,y)>0.92)))issues.push('Answer choices are too similar');
  }
  return [...new Set(issues)];
}
export function auditAssessment(questions,focus=null){
  const problems=[];
  questions.forEach((q,i)=>{
    const prior=questions.slice(0,i);
    const group=focus?.groups?.find(g=>g.id===q.competencyId);
    const issues=questionIssues(q,prior,group);
    if(issues.length)problems.push({question:i+1,issues});
  });
  return problems;
}
export function validateBlueprint(slots,focus){
  if(!Array.isArray(slots)||slots.length!==focus.targetCount)throw new Error('Question plan is incomplete; retry planning');
  const topics=new Set();const result=[];
  const planned=Object.fromEntries(focus.groups.map(g=>[g.id,0]));
  for(const slot of slots){
    const group=focus.groups.find(g=>g.id===slot.competencyId);
    if(!group||!group.requirementIndices.includes(slot.requirementIndex))throw new Error('Question plan contains an invalid competency mapping');
    const topic=String(slot.topicTitle||'').trim().slice(0,100),scenario=String(slot.scenario||'').trim().slice(0,230),decision=String(slot.decisionTarget||'').trim().slice(0,220);
    if(topic.length<10||scenario.length<20||decision.length<15)throw new Error('Question plan is insufficiently specific');
    const key=topic.toLowerCase().replace(/[^a-z0-9]/g,'');if(topics.has(key))throw new Error('Question plan repeats an assessment topic');topics.add(key);
    if(result.some(previous=>previous.competencyId===slot.competencyId&&overlap(previous.scenario,scenario)>=0.74))throw new Error('Question plan repeats a scenario within a competency');
    const difficulty=['Moderate','Challenging','Advanced'].includes(slot.difficulty)?slot.difficulty:'Challenging';
    planned[group.id]++;result.push({competencyId:group.id,requirementIndex:slot.requirementIndex,topicTitle:topic,scenario,decisionTarget:decision,difficulty});
  }
  if(focus.groups.some(g=>planned[g.id]!==g.questionCount))throw new Error('Question plan does not match the approved competency allocation');
  return result;
}
