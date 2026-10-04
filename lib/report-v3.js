/** Deterministic V3 report: scores and claims derive solely from recorded answers. */
const formatQuestion=q=>String(q.question||'').replace(/[?\s]+$/,'').trim();
const unique=x=>[...new Set(x.filter(Boolean))];
function verbFor(name){return /communication|conflict|leadership|coaching|negotiation|stakeholder/i.test(name)?
  'selected appropriate approaches in questions about':'answered questions about';}
export function summarizeEvidence(groups,details,approved,correct,total){
  const ranked=[...groups].filter(g=>g.total).sort((a,b)=>b.score-a.score||b.total-a.total);
  const high=ranked.filter(g=>g.score>=70).slice(0,2),low=ranked.filter(g=>g.score<70).sort((a,b)=>a.score-b.score).slice(0,2);
  const first=`The candidate answered ${correct} of ${total} questions correctly (${total?Math.round(100*correct/total):0}%).`;
  const positives=high.map(g=>`${g.name} (${g.correct}/${g.total})`),gaps=low.map(g=>`${g.name} (${g.correct}/${g.total})`);
  const second=positives.length?`Higher scores were recorded for ${positives.join(' and ')}.`:'No competency group reached 70% in this assessment.';
  const third=gaps.length?`Responses suggest that ${gaps.join(' and ')} should be explored further during the interview.`:
    'The interview should use more demanding examples to explore the depth of the approaches selected.';
  const summary=`${first} ${second} ${third} These results describe performance on the questions presented, not demonstrated workplace performance.`;
  const strengths=high.map(g=>{const examples=details.filter(q=>q.competency===g.name&&q.isCorrect).slice(0,2);
    return {competency:g.name,statement:`Correct responses in ${g.correct} of ${g.total} questions on ${g.name}.`,questionNumbers:examples.map(q=>q.order)};});
  const weaknesses=low.map(g=>{const examples=details.filter(q=>q.competency===g.name&&q.isCorrect===false).slice(0,2);
    return {competency:g.name,statement:`${g.total-g.correct} of ${g.total} questions in this group were not answered correctly.`,questionNumbers:examples.map(q=>q.order)};});
  const validations=[];
  for(const q of details.filter(q=>q.isCorrect===false).slice(0,4)){
    if(validations.some(v=>v.competency===q.competency))continue;
    validations.push({competency:q.competency,basis:`Assessment response · Q${q.order}`,
      question:`Walk through your approach to this situation: ${formatQuestion(q)}`,
      lookFor:`Ask the candidate to compare alternative approaches and explain the practical trade-offs. The assessment's preferred response: ${q.options[q.correctIndex]}.`});
  }
  for(const g of high){if(validations.length>=5)break;
    const example=details.find(q=>q.competency===g.name&&q.isCorrect);
    if(!example||validations.some(v=>v.competency===g.name))continue;
    validations.push({competency:g.name,basis:`Extend a correct response · Q${example.order}`,
      question:`Give a more difficult workplace example of ${g.name.toLowerCase()} where your first approach did not work. What would you change?`,
      lookFor:'Ask for a concrete example, constraints, alternatives, outcome measures and lessons learned. A correct MCQ answer alone does not confirm practical experience.'});
  }
  // Extend the interview even after a perfect score: correct MCQs do not demonstrate execution.
  for(const g of groups.filter(g=>g.total).sort((a,b)=>b.total-a.total)){
    if(validations.length>=5)break;
    if(validations.some(v=>v.competency===g.name))continue;
    validations.push({competency:g.name,basis:'Practical follow-up',
      question:`Describe a demanding real example involving ${g.name.toLowerCase()}. Explain the options you considered, why you selected one, and what the outcome was.`,
      lookFor:'Specific examples, supporting data, constraints, trade-offs, measurable outcomes and lessons learned.'});
  }
  // Other JD criteria may be suggested for interview, but never presented as proven strengths or weaknesses.
  const coverage=new Set(groups.flatMap(g=>g.requirementIndices||[]));
  const extra=(approved.requirements||[]).map((r,i)=>({r,i})).filter(({r,i})=>!coverage.has(i)&&['Must Have','Important'].includes(r.priority));
  for(const {r} of extra.slice(0,2))validations.push({competency:r.text,basis:'Additional role requirement',
    question:/experience|years|qualification|degree/i.test(r.text)?`Ask for specific examples or documentation supporting: ${r.text}`:
      /communication|conflict|negotiation|stakeholder/i.test(r.text)?`Use a short role-play to explore: ${r.text}`:
      /software|tools|system|reporting/i.test(r.text)?`Use a practical walkthrough or sample task to explore: ${r.text}`:
      `Use a practical example or structured interview question to explore: ${r.text}`,
    lookFor:'Gather specific, verifiable examples. This requirement was not measured by the choice-based assessment.'});
  return {summary,strengths,weaknesses,interviewValidation:validations.slice(0,7)};
}
export function visibleIntegrity(events=[]){
  // Focus events alone are noisy: only confirmed tab-hidden episodes lasting >=10 seconds are included.
  const confirmed=[];let hidden=null;
  for(const event of [...events].sort((a,b)=>a.at-b.at)){
    if(event.type==='sustained_tab_change'&&event.durationSeconds>=10&&event.durationSeconds<86400){
      confirmed.push({type:'Sustained tab change',at:event.at,seconds:event.durationSeconds,questionIndex:event.questionIndex});continue;}
    if(event.type==='tab_hidden'&&hidden===null)hidden=event;
    if(event.type==='tab_visible'&&hidden!==null){const seconds=Math.round((event.at-hidden.at)/1000);
      if(seconds>=10&&seconds<86400)confirmed.push({type:'Confirmed tab change',at:hidden.at,seconds,questionIndex:hidden.questionIndex});
      hidden=null;
    }
  }
  return {confirmedTabChanges:confirmed.length,events:confirmed,description:confirmed.length?
    `${confirmed.length} sustained tab change${confirmed.length===1?'':'s'} reported by the browser. This alone does not establish misconduct.`:
    'No sustained tab changes recorded. Browser monitoring cannot detect the use of other devices.'};
}
export function buildReportV3(assignment,job,assessment,at,finishReason,questionMs){
  const byId=new Map(assessment.questions.map(q=>[q.id,q]));const groupMap=new Map(assessment.focus.groups.map(g=>[g.id,{id:g.id,name:g.name,importance:g.importance,
    requirementIndices:g.requirementIndices,correct:0,attempted:0,total:0,score:null}]));
  let correct=0,attempted=0;
  const details=(assignment.questionMap?.order||assessment.questions.map(q=>q.id)).map((id,index)=>{
    const q=byId.get(id);if(!q)return null;
    const answer=assignment.answers?.[id],hit=Boolean(answer&&answer.index===q.correctIndex),group=groupMap.get(q.competencyId);
    if(answer)attempted++;if(hit)correct++;if(group){group.total++;if(answer)group.attempted++;if(hit)group.correct++;}
    return {order:index+1,id:q.id,question:q.text,competency:group?.name||'Assessment question',type:q.type,
      options:q.options,correctIndex:q.correctIndex,selectedIndex:answer?.index??null,isCorrect:answer?hit:null,
      rationale:q.rationale,changes:answer?.changes||0,timeSeconds:Math.round((questionMs[id]||0)/1000)};
  }).filter(Boolean);
  const competencies=[...groupMap.values()].map(g=>({...g,score:g.total?Math.round(g.correct*100/g.total):null}));
  const profile=summarizeEvidence(competencies,details,job.approvedRequirements,correct,details.length);
  const integrity=visibleIntegrity(assignment.integrityEvents||[]);
  const elapsed=assignment.startedAt?Math.max(0,Math.round((Math.min(at,assignment.deadlineAt)-assignment.startedAt)/1000)):0;
  return {reportVersion:3,assignmentId:assignment.id,orgId:assignment.orgId,jobId:assignment.jobId,
    candidateName:assignment.name,candidateEmail:assignment.email,jobTitle:job.title,
    assessmentVersion:assessment.version||1,questionVersion:assessment.questionVersion,
    generatedAt:new Date(at).toISOString(),startedAt:assignment.startedAt,completedAt:at,finishReason,durationMinutes:assignment.durationMinutes,
    elapsedSeconds:elapsed,correct,attempted,total:details.length,score:details.length?Math.round(correct*100/details.length):0,
    competencies,details,profile,integrity,limitations:[
      'This report describes answers to a limited number of questions. It does not establish workplace performance, communication delivery, qualifications or experience.',
      'Timing is estimated. Browser activity is not proof of misconduct, and other devices cannot be monitored.',
      'Assessment findings support a structured interview; the recruiter makes all hiring decisions.']};
}
