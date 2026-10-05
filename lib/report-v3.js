/**
 * V3.2 deterministic evidence report.
 * All performance statements derive only from recorded assessment questions and responses.
 */
const formatQuestion=q=>String(q.question||'').replace(/[?\s]+$/,'').trim();
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const short=value=>{const t=clean(value);return t.length>118?`${t.slice(0,115).trim()}…`:t;};
const round=n=>Number.isFinite(n)?Math.round(n):0;
const median=values=>{if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:Math.round((a[m-1]+a[m])/2);};
const isInterviewSkill=r=>{
  if(!r||['Experience','Qualification'].includes(r.category))return false;
  return !/\b(?:years?\s+(?:of\s+)?experience|degree|diploma|graduat(?:e|ion)|education|bachelor|master|high school|employment history|prior employment|certification possession)\b/i.test(r.text||'');
};

function typePerformance(details=[]){
  const map=new Map();
  for(const q of details){
    const key=clean(q.type)||'Other';
    const item=map.get(key)||{type:key,correct:0,attempted:0,total:0,score:0};
    item.total++;if(q.selectedIndex!==null)item.attempted++;if(q.isCorrect)item.correct++;map.set(key,item);
  }
  return [...map.values()].map(x=>({...x,score:x.total?round(100*x.correct/x.total):0}))
    .sort((a,b)=>b.total-a.total||b.score-a.score||a.type.localeCompare(b.type));
}
function timingProfile(details=[],elapsedSeconds=0){
  const active=details.map(q=>Number(q.timeSeconds)||0).filter(x=>x>=0);
  const positive=active.filter(x=>x>0);
  const fastest=positive.length?Math.min(...positive):0,slowest=positive.length?Math.max(...positive):0;
  const answerChanges=details.reduce((n,q)=>n+(Number(q.changes)||0),0);
  const quickResponses=positive.filter(x=>x<=10).length;
  return {elapsedSeconds,averageElapsedSeconds:details.length?round(elapsedSeconds/details.length):0,
    averageActiveSeconds:positive.length?round(positive.reduce((a,b)=>a+b,0)/positive.length):0,
    medianActiveSeconds:median(positive),fastestActiveSeconds:fastest,slowestActiveSeconds:slowest,
    quickResponses,answerChanges};
}
function competencyInsights(groups=[],details=[]){
  return groups.filter(g=>g.total).map(g=>{
    const relevant=details.filter(q=>q.competency===g.name);
    const correctQs=relevant.filter(q=>q.isCorrect),missedQs=relevant.filter(q=>q.isCorrect===false);
    const topics=[...new Set(relevant.map(q=>short(q.topicTitle||formatQuestion(q))).filter(Boolean))].slice(0,3);
    const correctExamples=correctQs.slice(0,2).map(q=>({question:q.order,topic:short(q.topicTitle||formatQuestion(q))}));
    const missedExamples=missedQs.slice(0,2).map(q=>({question:q.order,topic:short(q.topicTitle||formatQuestion(q))}));
    return {id:g.id,name:g.name,importance:g.importance,correct:g.correct,total:g.total,score:g.score,
      topics,correctExamples,missedExamples};
  });
}
function buildSummary(report,types,timing){
  const groups=[...(report.competencies||[])].filter(g=>g.total).sort((a,b)=>b.score-a.score||b.total-a.total);
  const high=groups.filter(g=>g.score>=70).slice(0,2),low=groups.filter(g=>g.score<70).sort((a,b)=>a.score-b.score).slice(0,2);
  const first=`The candidate answered ${report.correct} of ${report.total} questions correctly (${report.score}%) across the competencies selected for this assessment.`;
  const second=high.length?`The highest observed scores were in ${high.map(g=>`${g.name} (${g.correct}/${g.total})`).join(' and ')}.`:
    'No tested competency reached the 70% higher-score threshold in this assessment.';
  const third=low.length?`The areas with the most missed questions were ${low.map(g=>`${g.name} (${g.correct}/${g.total})`).join(' and ')}, which should be explored further in the interview.`:
    'No tested competency fell below 70%; the interview should therefore focus on the depth and real-world application of the selected answers.';
  const sorted=[...types].sort((a,b)=>b.score-a.score||b.total-a.total);
  const fourth=sorted.length>1?`By question type, the highest score was ${sorted[0].type} (${sorted[0].correct}/${sorted[0].total}) and the lowest was ${sorted.at(-1).type} (${sorted.at(-1).correct}/${sorted.at(-1).total}).`:
    sorted.length?`The assessment used ${sorted[0].type} questions, with ${sorted[0].correct} of ${sorted[0].total} answered correctly.`:'';
  const fifth=`The assessment was completed in ${Math.floor(timing.elapsedSeconds/60)}m ${timing.elapsedSeconds%60}s; timing is included as context and is not treated as proof of competence or misconduct.`;
  return [first,second,third,fourth,fifth].filter(Boolean).join(' ');
}

export function summarizeEvidence(groups,details,approved,correct,total,elapsedSeconds=0){
  const base={competencies:groups,details,correct,total,score:total?round(100*correct/total):0};
  const types=typePerformance(details),timing=timingProfile(details,elapsedSeconds),insights=competencyInsights(groups,details);
  const ranked=[...groups].filter(g=>g.total).sort((a,b)=>b.score-a.score||b.total-a.total);
  const high=ranked.filter(g=>g.score>=70).slice(0,2),low=ranked.filter(g=>g.score<70).sort((a,b)=>a.score-b.score).slice(0,2);
  const strengths=high.map(g=>{const examples=details.filter(q=>q.competency===g.name&&q.isCorrect).slice(0,2);
    return {competency:g.name,statement:`${g.correct} of ${g.total} tested questions were answered correctly in ${g.name}.`,questionNumbers:examples.map(q=>q.order)};});
  const weaknesses=low.map(g=>{const examples=details.filter(q=>q.competency===g.name&&q.isCorrect===false).slice(0,2);
    return {competency:g.name,statement:`${g.total-g.correct} of ${g.total} tested questions were missed in ${g.name}.`,questionNumbers:examples.map(q=>q.order)};});
  const validations=[];
  for(const q of details.filter(q=>q.isCorrect===false).slice(0,5)){
    if(validations.some(v=>v.competency===q.competency))continue;
    validations.push({competency:q.competency,basis:`Assessment response · Q${q.order}`,
      question:`Walk through how you would handle this situation in practice: ${formatQuestion(q)}`,
      lookFor:`Ask the candidate to compare realistic alternatives, explain trade-offs and justify the final decision. The assessment's preferred response was: ${q.options[q.correctIndex]}.`});
  }
  for(const g of high){if(validations.length>=6)break;
    const example=details.find(q=>q.competency===g.name&&q.isCorrect);
    if(!example||validations.some(v=>v.competency===g.name))continue;
    validations.push({competency:g.name,basis:`Depth check · Q${example.order}`,
      question:`Describe a difficult real example involving ${g.name.toLowerCase()} where the obvious first approach did not work. What did you change and why?`,
      lookFor:'A specific example, constraints, alternative options, measurable outcomes and lessons learned. A correct choice-based answer alone does not establish practical proficiency.'});
  }
  const covered=new Set(groups.flatMap(g=>g.requirementIndices||[]));
  const extra=(approved.requirements||[]).map((r,i)=>({r,i})).filter(({r,i})=>!covered.has(i)&&isInterviewSkill(r)&&['Must Have','Important'].includes(r.priority));
  for(const {r} of extra){if(validations.length>=7)break;
    validations.push({competency:'Additional Interview Focus',basis:'Role requirement',
      question:/communication|conflict|negotiation|stakeholder/i.test(r.text)?`Use a short role-play or behavioural example to explore: ${r.text}`:
        /software|tools|system|reporting|data/i.test(r.text)?`Use a practical walkthrough or sample task to explore: ${r.text}`:
        `Ask for a specific workplace example demonstrating: ${r.text}`,
      lookFor:'Look for concrete evidence, the candidate’s own actions, constraints, decisions, outcomes and lessons learned. Do not treat the absence of assessment evidence as a negative finding.'});
  }
  for(const g of ranked){if(validations.length>=7)break;if(validations.some(v=>v.competency===g.name))continue;
    validations.push({competency:g.name,basis:'Practical follow-up',
      question:`Describe a demanding real example involving ${g.name.toLowerCase()}. What options did you consider, what did you choose, and what was the outcome?`,
      lookFor:'Specific actions, supporting data, trade-offs, measurable outcomes and learning.'});
  }
  return {reportDetailVersion:'3.2',summary:buildSummary(base,types,timing),strengths,weaknesses,
    competencyInsights:insights,questionTypePerformance:types,timingProfile:timing,
    interviewValidation:validations.slice(0,7)};
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

export function enrichReportV3(report){
  if(!report||report.reportVersion!==3)return report;
  const elapsed=Number(report.elapsedSeconds)||0;
  const profile=summarizeEvidence(report.competencies||[],report.details||[],{requirements:[]},report.correct||0,report.total||0,elapsed);
  // Preserve previously generated interview additions when they exist, while enriching all deterministic sections.
  if(report.profile?.interviewValidation?.length)profile.interviewValidation=report.profile.interviewValidation;
  return {...report,profile};
}

export function buildReportV3(assignment,job,assessment,at,finishReason,questionMs){
  const byId=new Map(assessment.questions.map(q=>[q.id,q]));const groupMap=new Map(assessment.focus.groups.map(g=>[g.id,{id:g.id,name:g.name,importance:g.importance,
    requirementIndices:g.requirementIndices,correct:0,attempted:0,total:0,score:null}]));
  let correct=0,attempted=0;
  const details=(assignment.questionMap?.order||assessment.questions.map(q=>q.id)).map((id,index)=>{
    const q=byId.get(id);if(!q)return null;
    const answer=assignment.answers?.[id],hit=Boolean(answer&&answer.index===q.correctIndex),group=groupMap.get(q.competencyId);
    if(answer)attempted++;if(hit)correct++;if(group){group.total++;if(answer)group.attempted++;if(hit)group.correct++;}
    return {order:index+1,id:q.id,question:q.text,topicTitle:q.topicTitle||'',competency:group?.name||'Assessment Question',type:q.type,
      options:q.options,correctIndex:q.correctIndex,selectedIndex:answer?.index??null,isCorrect:answer?hit:null,
      rationale:q.rationale,changes:answer?.changes||0,timeSeconds:Math.round((questionMs[id]||0)/1000)};
  }).filter(Boolean);
  const competencies=[...groupMap.values()].map(g=>({...g,score:g.total?Math.round(g.correct*100/g.total):null}));
  const elapsed=assignment.startedAt?Math.max(0,Math.round((Math.min(at,assignment.deadlineAt)-assignment.startedAt)/1000)):0;
  const profile=summarizeEvidence(competencies,details,job.approvedRequirements,correct,details.length,elapsed);
  const integrity=visibleIntegrity(assignment.integrityEvents||[]);
  return {reportVersion:3,reportDetailVersion:'3.2',assignmentId:assignment.id,orgId:assignment.orgId,jobId:assignment.jobId,
    candidateName:assignment.name,candidateEmail:assignment.email,jobTitle:job.title,
    assessmentTier:assessment.assessmentTier||assessment.focus?.tier||null,creditCost:assessment.creditCost||assessment.focus?.creditCost||null,
    assessmentVersion:assessment.version||1,questionVersion:assessment.questionVersion,
    generatedAt:new Date(at).toISOString(),startedAt:assignment.startedAt,completedAt:at,finishReason,durationMinutes:assignment.durationMinutes,
    elapsedSeconds:elapsed,correct,attempted,total:details.length,score:details.length?Math.round(correct*100/details.length):0,
    competencies,details,profile,integrity,limitations:[
      'This report describes performance on the questions presented. It does not establish workplace performance, communication delivery, qualifications or prior experience.',
      'Timing and browser activity are contextual signals only. They are not proof of competence or misconduct, and use of other devices cannot be monitored.',
      'Assessment findings support a structured interview; the recruiter makes all hiring decisions.']};
}
