// Firebase browser settings are obtained from our protected application's public config endpoint.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';

const byId = id => document.getElementById(id);
const show = id => byId(id).classList.remove('hidden');
const hide = id => byId(id).classList.add('hidden');
const displayStatus=value=>({draft:'Draft',published:'Published',assessment_draft:'Assessment draft',
  requirements_approved:'Requirements approved',invited:'Invited',started:'In progress',completed:'Completed',
  expired:'Expired',verified:'Verified',time_expired:'Time expired'}[value]||
  String(value||'Unknown').replaceAll('_',' ').replace(/^./,letter=>letter.toUpperCase()));
let auth;
let jobs = [];
let currentJob = null;
let workingRequirements = [];
let currentAssessment = null;
let workingQuestions = [];
let savedSnapshot = "";
let generating = false;
let workingFocus = null;
let focusApproved = false;
let activeRequests=0;
const actionLabels={assessment:'Preparing assessment…',candidate:'Loading candidate data…',focus:'Reviewing critical competencies…',extract:'Extracting job requirements…',
  'generate-questions':'Generating distinct questions and checking quality…',invitations:'Updating candidate invitations…',
  invite:'Sending invitation…',jobs:'Loading jobs…',job:'Saving job details…',report:'Preparing candidate report…',
  'parse-jd':'Reading job description…',requirements:'Saving approved requirements…'};
function processing(visible,message){
  const panel=byId('processing-status');if(!panel)return;
  if(visible){panel.textContent=message||'Processing your request…';panel.classList.remove('hidden');}
  else panel.classList.add('hidden');
}


function notify(text, error = false) {
  const box = byId('message'); box.textContent = text; box.classList.toggle('error', error);
  // Non-scrolling toast: notifications must not drag users away from their work.
  show('message');
}
function clearNotification() { hide('message'); }
function onlyView(view) {
  for (const id of ['login-panel', 'dashboard', 'create-panel', 'job-panel']) hide(id);
  show(view);
  if (view === 'login-panel') hide('logout'); else show('logout');
}
async function api(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in');
  const headers = {Authorization: `Bearer ${await user.getIdToken()}`};
  if (options.body) headers['Content-Type'] = 'application/json';
  const endpoint=url.split('?')[0].split('/').pop();activeRequests++;
  processing(true,actionLabels[endpoint]||'Processing your request…');
  try{
    const response=await fetch(url,{...options,headers:{...headers,...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
    return data;
  }finally{activeRequests=Math.max(0,activeRequests-1);if(!activeRequests)processing(false);}

}
function renderJobs(filter = '') {
  const tbody = byId('jobs-body'); tbody.replaceChildren();
  const visible = jobs.filter(j => j.title.toLowerCase().includes(filter.toLowerCase()));
  for (const job of visible) {
    const tr = document.createElement('tr');
    const title = document.createElement('td'); title.textContent = job.title;
    const status = document.createElement('td'); const tag = document.createElement('span');
    tag.className = 'tag'; tag.textContent = displayStatus(job.status); status.append(tag);
    const candidates = document.createElement('td'); candidates.textContent = String(job.candidateCount);
    const completed = document.createElement('td'); completed.textContent = String(job.completedCount);
    const created = document.createElement('td'); created.textContent = job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-IN') : '—';
    const action = document.createElement('td'); const button = document.createElement('button');
    button.className = 'secondary compact'; button.textContent = job.status === 'draft' ? 'Extract' : 'Open';
    button.addEventListener('click', () => openJob(job.id)); action.append(button);
    tr.append(title, status, candidates, completed, created, action); tbody.append(tr);
  }
  byId('empty-state').textContent = jobs.length === 0
    ? 'No jobs yet. Select “Create job” to begin.' : visible.length === 0 ? 'No matching jobs.' : '';
}
async function refresh() {
  const [me, listing] = await Promise.all([api('/api/me'), api('/api/jobs')]);
  byId('org-name').textContent = me.organizationName; jobs = listing.jobs;
  byId('total-jobs').textContent = String(jobs.length);
  byId('published-jobs').textContent = String(jobs.filter(j => j.status === 'published').length);
  byId('total-candidates').textContent = String(jobs.reduce((sum, job) => sum + job.candidateCount, 0));
  byId('total-completed').textContent = String(jobs.reduce((sum, job) => sum + job.completedCount, 0));
  renderJobs(byId('search').value);
}
async function goDashboard() { onlyView('dashboard'); clearNotification(); try {await refresh();} catch(error) {notify(error.message, true);} }
function renderApproved(approved) {
  hide('extract-actions'); hide('extraction-box'); show('approved-box');
  const list = byId('approved-list'); list.replaceChildren();
  const table = document.createElement('table');
  const heading = document.createElement('tr');
  for (const label of ['Requirement', 'Category', 'Priority']) {const th = document.createElement('th'); th.textContent = label; heading.append(th);}
  table.append(heading);
  for (const item of approved.requirements) {
    const tr = document.createElement('tr');
    for (const value of [item.text, item.category, item.priority]) {const td = document.createElement('td'); td.textContent = value; tr.append(td);}
    table.append(tr);
  }
  list.append(table);
}
async function openJob(id) {
  clearNotification(); onlyView('job-panel');
  hide('extraction-box'); hide('approved-box'); hide('assessment-box'); hide('candidates-box'); hide('report-box'); show('extract-actions');
  byId('requirements-section').open=false;byId('assessment-box').open=false;byId('candidates-box').open=false;
  currentAssessment = null; workingQuestions = []; workingFocus = null; focusApproved = false;
  byId('extract-btn').disabled = true;
  try {
    currentJob = (await api(`/api/job?id=${encodeURIComponent(id)}`)).job;
    byId('detail-title').textContent = currentJob.title;
    byId('detail-status').textContent = `Status: ${displayStatus(currentJob.status)}`;
    byId('detail-jd').textContent = currentJob.jdText;
    if (currentJob.approvedRequirements) {renderApproved(currentJob.approvedRequirements);await loadAssessment();}
    else if (currentJob.extraction) {hide('extract-actions');renderExtraction(currentJob.extraction,currentJob.extractionSource);byId('requirements-section').open=true;}
    else {show('extract-actions');byId('requirements-section').open=true;}
  } catch(error) {notify(error.message, true);}
  finally {byId('extract-btn').disabled = false;}
}
const makeOption = (value, selectedValue) => {
  const o = document.createElement('option'); o.value = value; o.textContent = value; o.selected = value === selectedValue; return o;
};
function drawRequirements() {
  const container = byId('requirements-list'); container.replaceChildren();
  workingRequirements.forEach((req, index) => {
    const row = document.createElement('div'); row.className = 'requirement-row';
    const header = document.createElement('div'); header.className = 'requirement-header';
    const number = document.createElement('strong'); number.textContent = `Requirement ${index + 1}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary compact'; remove.textContent = 'Remove';
    remove.addEventListener('click', () => {workingRequirements.splice(index, 1); drawRequirements();});
    header.append(number, remove);
    const text = document.createElement('textarea'); text.rows = 2; text.maxLength = 220; text.value = req.text;
    text.setAttribute('aria-label', `Requirement ${index + 1} text`);
    text.addEventListener('input', () => {req.text = text.value;});
    const selects = document.createElement('div'); selects.className = 'two-col';
    const cat = document.createElement('select'); cat.setAttribute('aria-label', `Requirement ${index + 1} category`);
    ['Technical','Domain','Behavioural','Leadership','Experience','Qualification','Tools','Other'].forEach(x => cat.append(makeOption(x, req.category)));
    cat.addEventListener('change', () => {req.category = cat.value;});
    const priority = document.createElement('select'); priority.setAttribute('aria-label', `Requirement ${index + 1} priority`);
    ['Must Have','Important','Preferred'].forEach(x => priority.append(makeOption(x, req.priority)));
    priority.addEventListener('change', () => {req.priority = priority.value;});
    selects.append(cat, priority);
    const evidence = document.createElement('p'); evidence.className = 'muted fine'; evidence.textContent = req.evidence ? `JD evidence: ${req.evidence}` : '';
    row.append(header, text, selects, evidence); container.append(row);
  });
}
function renderExtraction(data, source, similar = []) {
  hide('approved-box'); hide('extract-actions'); show('extraction-box');
  byId('extracted-title').value = data.roleTitle || currentJob.title;
  byId('seniority').value = data.seniority || 'Unspecified';
  byId('experience').value = data.experience || '';
  byId('summary').value = data.summary || '';
  workingRequirements = data.requirements.map(r => ({...r}));
  drawRequirements();
  byId('cache-info').textContent = source === 'exact-cache'
    ? 'Cache hit: reused a previous extraction of this exact JD within your organisation, avoiding another AI call.'
    : source === 'new' ? 'New extraction: results saved in your organisation’s cache for reuse with an identical JD.'
    : 'Previously extracted JD: review and approve the requirements below.';
  if (similar.length) {
    const box = byId('similar-roles');
    box.textContent = `Potential approved templates for later assessment generation: ${similar.map(x => `${x.title} (${x.similarity}% text overlap)`).join('; ')}. Review each role's requirements; no questions have been copied.`;
    show('similar-roles');
  } else hide('similar-roles');
}

byId('login-form').addEventListener('submit', async event => {
  event.preventDefault(); clearNotification();
  const button = byId('login-btn'); button.disabled = true;
  try {await signInWithEmailAndPassword(auth, byId('email').value.trim(), byId('password').value); byId('password').value = '';}
  catch(error) {notify(error.code === 'auth/invalid-credential' ? 'Incorrect email or password.' : error.message, true);}
  finally {button.disabled = false;}
});
byId('logout').addEventListener('click', async () => {await signOut(auth); currentJob = null; clearNotification(); onlyView('login-panel');});
byId('new-job-btn').addEventListener('click', () => {clearNotification(); byId('upload-status').textContent = 'PDF, DOCX or TXT up to 2 MB.'; onlyView('create-panel');});
byId('back-btn').addEventListener('click', goDashboard);
byId('cancel-btn').addEventListener('click', goDashboard);
byId('detail-back-btn').addEventListener('click', goDashboard);
byId('search').addEventListener('input', event => renderJobs(event.target.value));
byId('jd-file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) return notify('File must be smaller than 2 MB', true);
  const label = byId('upload-status'); label.textContent = 'Reading document…';
  byId('save-job-btn').disabled = true;
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const {text} = await api('/api/parse-jd', {method: 'POST', body: JSON.stringify({filename: file.name, base64})});
    byId('jd-text').value = text;
    if (!byId('job-title').value.trim()) byId('job-title').value = file.name.replace(/\.(pdf|docx|txt)$/i, '').replace(/[_-]/g,' ').slice(0,150);
    label.textContent = 'Document text extracted. Review it before saving.';
  } catch(error) {label.textContent = 'Document could not be read.'; notify(error.message, true);}
  finally {byId('save-job-btn').disabled = false;}
});
byId('job-form').addEventListener('submit', async event => {
  event.preventDefault(); clearNotification();
  const button = byId('save-job-btn'); button.disabled = true;
  try {
    const {id} = await api('/api/jobs', {method: 'POST', body: JSON.stringify({
      title: byId('job-title').value, department: byId('department').value, jdText: byId('jd-text').value
    })});
    byId('job-form').reset(); await openJob(id);
    notify('JD saved. Now extract the requirements with AI.');
  } catch(error) {notify(error.message, true);}
  finally {button.disabled = false;}
});
byId('extract-btn').addEventListener('click', async () => {
  if (!currentJob) return;
  clearNotification(); const button = byId('extract-btn'); button.disabled = true; button.textContent = 'Extracting…';
  try {
    const result = await api('/api/extract', {method: 'POST', body: JSON.stringify({jobId: currentJob.id})});
    currentJob.extraction = result.extraction; currentJob.extractionSource = result.source;
    byId('requirements-section').open=true;renderExtraction(result.extraction, result.source, result.similar);
    notify(result.source === 'exact-cache' ? 'Requirements loaded from your JD cache.' : 'Requirements extracted. Please review and approve.');
  } catch(error) {notify(error.message, true);}
  finally {button.disabled = false; button.textContent = 'Extract requirements with AI';}
});
byId('add-requirement').addEventListener('click', () => {
  if (workingRequirements.length >= 40) return notify('Maximum 40 requirements', true);
  workingRequirements.push({text: '', category: 'Other', priority: 'Important', evidence: ''}); drawRequirements();
});
byId('requirements-form').addEventListener('submit', async event => {
  event.preventDefault(); clearNotification();
  if (!currentJob) return;
  const button = byId('approve-btn'); button.disabled = true;
  try {
    const approved = {
      roleTitle: byId('extracted-title').value, seniority: byId('seniority').value,
      experience: byId('experience').value, summary: byId('summary').value,
      requirements: workingRequirements
    };
    const result = await api('/api/requirements', {method:'POST', body: JSON.stringify({jobId: currentJob.id, approved})});
    currentJob.approvedRequirements = result.approvedRequirements;
    renderApproved(result.approvedRequirements);
    byId('requirements-section').open=false;byId('assessment-box').open=true;
    await loadAssessment();
    notify('Requirements approved. Propose and confirm the most critical assessment competencies.');
  } catch(error) {notify(error.message, true);}
  finally {button.disabled = false;}
});

// V3 — recruiter-controlled critical competency focus. Published V1/V2 assessments are preserved.
function focusDisplay(){
  if(currentAssessment){hide('assessment-setup');return;}
  show('assessment-setup');
  const approved=currentJob?.assessmentFocusApproved;
  focusApproved=Boolean(approved);
  workingFocus=workingFocus||approved||currentJob?.assessmentFocusDraft||null;
  if(workingFocus){
    byId('question-count').value=String(workingFocus.targetCount);
    show('focus-panel');drawFocus();
  }else hide('focus-panel');
  byId('question-count').disabled=focusApproved;
  byId('propose-focus-btn').disabled=focusApproved;
  byId('approve-focus-btn').disabled=focusApproved;
  if(focusApproved)show('start-assessment-btn');else hide('start-assessment-btn');
}
function drawFocus(){
  const list=byId('focus-list');list.replaceChildren();if(!workingFocus)return;
  const approved=currentJob?.approvedRequirements;
  const allowed=approved.requirements.map((r,i)=>({r,i})).filter(({r})=>!['Experience','Qualification'].includes(r.category));
  workingFocus.groups.forEach((g,i)=>{
    const card=document.createElement('details');card.className='question-card focus-card';card.open=i===0;
    const head=el('summary',`Competency ${i+1}: ${g.name} · ${g.questionCount} questions`);head.className='editor-question-title';card.append(head);
    const inside=el('div',undefined,'editor-question-content');
    const name=el('label','Competency name');const nameInput=qEl(`Competency ${i+1} name`,g.name,0,95);
    nameInput.disabled=focusApproved;nameInput.addEventListener('input',()=>{g.name=nameInput.value;head.textContent=`Competency ${i+1}: ${g.name} · ${g.questionCount} questions`;});
    const rationaleLabel=el('label','Why this matters');const rationale=qEl(`Competency ${i+1} rationale`,g.rationale,2,330);
    rationale.disabled=focusApproved;rationale.addEventListener('input',()=>g.rationale=rationale.value);
    const two=el('div',undefined,'two-col');const countBox=el('div'),impBox=el('div');
    countBox.append(el('label','Questions in this group'));
    const count=el('input');count.type='number';count.min='3';count.max='12';count.value=String(g.questionCount);count.disabled=focusApproved;
    count.addEventListener('input',()=>{g.questionCount=Number(count.value);head.textContent=`Competency ${i+1}: ${g.name} · ${g.questionCount} questions`;updateFocusTotal();});countBox.append(count);
    impBox.append(el('label','Importance'));const imp=selectField(['Critical','High'],g.importance,'Competency importance',v=>g.importance=v);imp.disabled=focusApproved;impBox.append(imp);
    two.append(countBox,impBox);
    const reqLabel=el('p','Link the exact JD requirements that this group will assess:','muted');
    const checklist=el('div',undefined,'focus-requirements');
    allowed.forEach(({r,i:idx})=>{const label=el('label',undefined,'focus-requirement');const box=el('input');box.type='checkbox';box.checked=g.requirementIndices.includes(idx);box.disabled=focusApproved;
      box.addEventListener('change',()=>{if(box.checked){if(!g.requirementIndices.includes(idx))g.requirementIndices.push(idx);}else g.requirementIndices=g.requirementIndices.filter(v=>v!==idx);});
      label.append(box,document.createTextNode(`${r.priority} · ${r.text}`));checklist.append(label);});
    inside.append(name,nameInput,rationaleLabel,rationale,two,reqLabel,checklist);card.append(inside);list.append(card);
  });updateFocusTotal();
}
function updateFocusTotal(){
  if(!workingFocus)return;
  const used=workingFocus.groups.reduce((n,g)=>n+(Number.isFinite(g.questionCount)?g.questionCount:0),0);
  byId('focus-count-note').textContent=`${used} / ${workingFocus.targetCount} questions allocated across ${workingFocus.groups.length} critical competencies. ${used===workingFocus.targetCount?'Ready to approve.':'Adjust the question counts before approval.'}`;
}
byId('question-count').addEventListener('change',()=>{if(workingFocus&&!focusApproved){workingFocus=null;hide('focus-panel');notify('Question count changed. Generate a new competency proposal for this length.');}});
byId('propose-focus-btn').addEventListener('click',async()=>{
  if(!currentJob?.approvedRequirements)return;clearNotification();const b=byId('propose-focus-btn');b.disabled=true;b.textContent='Identifying critical competencies…';
  try{const {plan}=await api('/api/focus',{method:'POST',body:JSON.stringify({jobId:currentJob.id,action:'propose',targetCount:Number(byId('question-count').value)})});
    currentJob.assessmentFocusDraft=plan;currentJob.assessmentFocusApproved=null;workingFocus=plan;focusApproved=false;focusDisplay();notify('Focus proposed. Review groupings and allocation, then approve.');
  }catch(e){notify(e.message,true);}finally{b.disabled=false;b.textContent='1. Propose critical competencies with AI';}
});
byId('approve-focus-btn').addEventListener('click',async()=>{
  if(!workingFocus)return;clearNotification();const b=byId('approve-focus-btn');b.disabled=true;
  try{const {plan}=await api('/api/focus',{method:'POST',body:JSON.stringify({jobId:currentJob.id,action:'approve',plan:workingFocus})});
    currentJob.assessmentFocusApproved=plan;currentJob.assessmentFocusDraft=plan;workingFocus=plan;focusApproved=true;focusDisplay();notify('Critical competencies approved. You can now create the assessment.');
  }catch(e){notify(e.message,true);b.disabled=false;}
});

// Recruiter-only question editor. Never render generated answer keys in a candidate-facing route.
const qTypes = ['Knowledge','Situational judgement','Problem solving','Leadership','Stakeholder management'];
const qEl = (name, value, rows = 0, maxLength = 260) => {
  const element = document.createElement(rows ? 'textarea' : 'input');
  if(rows) element.rows = rows;
  element.maxLength = maxLength;
  element.value = value ?? '';
  element.setAttribute('aria-label', name);
  return element;
};
function selectField(values, selected, label, changed) {
  const s = document.createElement('select'); s.setAttribute('aria-label', label);
  values.forEach(v => s.append(makeOption(v, selected)));
  s.addEventListener('change',() => changed(s.value));
  return s;
}
function markChanged() {byId('publish-btn').disabled = true; byId('publish-btn').title='Save your edits before publishing';}
function drawQuestions() {
  const container=byId('questions-list'); container.replaceChildren();
  if(workingQuestions.length!==currentAssessment.targetCount) return;
  const published=currentAssessment.status==='published';
  const focus=currentAssessment.focus;
  workingQuestions.forEach((q,i)=>{
    const card=document.createElement('details'); card.className='question-card editor-question';
    card.open=i===0&&!published;
    const heading=document.createElement('summary'); heading.className='editor-question-title'; heading.textContent=`Question ${i+1} · ${q.text.slice(0,90)}${q.text.length>90?'…':''}`;
    const tag=document.createElement('span');tag.className='tag';tag.textContent=q.source==='exact-cache'?'Exact cache':q.source==='similar-cache'?'Similar role':'New';
    heading.append(tag);card.append(heading);
    const editor=document.createElement('div');editor.className='editor-question-content';
    const prompt=qEl(`Question ${i+1}`,q.text,3,650);prompt.disabled=published;
    prompt.addEventListener('input',()=>{q.text=prompt.value;markChanged();});editor.append(prompt);
    const meta=document.createElement('div');meta.className='two-col';
    const requirement=document.createElement('div');const reqLabel=document.createElement('label');reqLabel.textContent='Mapped JD requirement';
    const reqOptions=currentJob.approvedRequirements.requirements.map((r,index)=>`${index+1}. ${r.text}`);
    const reqSelect=selectField(reqOptions,reqOptions[q.requirementIndex],`Requirement for question ${i+1}`,value=>{
      q.requirementIndex=reqOptions.indexOf(value);markChanged();});reqSelect.disabled=published;requirement.append(reqLabel,reqSelect);
    const typeBox=document.createElement('div');const typeLabel=document.createElement('label');typeLabel.textContent='Question type';
    const typeSelect=selectField(qTypes,q.type,`Question type ${i+1}`,value=>{q.type=value;markChanged();});typeSelect.disabled=published;typeBox.append(typeLabel,typeSelect);meta.append(requirement,typeBox);editor.append(meta);
    const grid=document.createElement('div');grid.className='options-grid';
    q.options.forEach((opt,j)=>{
      const cell=document.createElement('div');const label=document.createElement('label');label.textContent=`Option ${'ABCD'[j]}`;
      const input=qEl(`Question ${i+1}, option ${'ABCD'[j]}`,opt,2,260);input.disabled=published;
      input.addEventListener('input',()=>{q.options[j]=input.value;markChanged();});cell.append(label,input);grid.append(cell);
    });editor.append(grid);
    const answer=document.createElement('label');answer.textContent='Best answer';editor.append(answer);
    const answerSelect=selectField(['A','B','C','D'],'ABCD'[q.correctIndex],`Best answer for question ${i+1}`,value=>{q.correctIndex='ABCD'.indexOf(value);markChanged();});
    answerSelect.disabled=published;editor.append(answerSelect);
    const why=document.createElement('label');why.textContent='Why this is the best answer (recruiter only)';editor.append(why);
    const rationale=qEl(`Explanation for question ${i+1}`,q.rationale,3,700);rationale.disabled=published;
    rationale.addEventListener('input',()=>{q.rationale=rationale.value;markChanged();});editor.append(rationale);
    card.append(editor);container.append(card);
  });
  if(!published) show('assessment-actions');
}
function assessmentDisplay() {
  if(!currentAssessment) {show('assessment-setup');hide('assessment-workspace');byId('assessment-status').textContent='Not started';focusDisplay();return;}
  hide('assessment-setup');show('assessment-workspace');
  const a=currentAssessment;
  byId('assessment-status').textContent=displayStatus(a.status);
  byId('generation-info').textContent=`${workingQuestions.length} of ${a.targetCount} questions prepared. ${a.reusedCount||0} approved questions reused. Each question targets a distinct scenario.${a.status==='published'?' Assessment published and locked.':''}`;
  if(a.status==='published') {hide('generation-controls');hide('assessment-actions');drawQuestions();return;}
  if(workingQuestions.length<a.targetCount) {
    show('generation-controls');hide('assessment-actions');
    const btn=byId('generate-btn');btn.disabled=generating;btn.textContent=generating?'Generating questions…':workingQuestions.length?'Continue generation':'Generate questions';
    byId('questions-list').replaceChildren();
    return;
  }
  hide('generation-controls');drawQuestions();
  byId('publish-btn').disabled=JSON.stringify(workingQuestions)!==savedSnapshot;
}
async function loadAssessment() {
  show('assessment-box');
  const result=await api(`/api/assessment?jobId=${encodeURIComponent(currentJob.id)}`);
  currentAssessment=result.assessment;
  workingQuestions=(currentAssessment?.questions||[]).map(q=>({...q,options:[...q.options]}));
  savedSnapshot=JSON.stringify(workingQuestions);
  assessmentDisplay();
  if (currentAssessment?.status === 'published') {await loadCandidates();byId('candidates-box').open=true;}
  else {hide('candidates-box');byId('assessment-box').open=true;}
}
byId('start-assessment-btn').addEventListener('click',async()=>{
  if(!currentJob?.approvedRequirements)return;
  clearNotification();const btn=byId('start-assessment-btn');btn.disabled=true;
  try{
    const result=await api('/api/assessment',{method:'POST',body:JSON.stringify({action:'start',jobId:currentJob.id,targetCount:Number(byId('question-count').value)})});
    byId('assessment-box').open=true;currentAssessment=result.assessment;workingQuestions=(result.assessment.questions||[]).map(q=>({...q,options:[...q.options]}));
    savedSnapshot=JSON.stringify(workingQuestions);assessmentDisplay();
    notify('Assessment draft created. Select Generate questions to begin.');
  }catch(error){notify(error.message,true);}finally{btn.disabled=false;}
});
byId('generate-btn').addEventListener('click',async()=>{
  if(generating||!currentAssessment)return;
  generating=true;clearNotification();assessmentDisplay();
  try{
    while(workingQuestions.length<currentAssessment.targetCount){
      // One AI request per serverless call; retry only a failed quality check, not
      // authentication, quota or model errors. Previously saved batches remain intact.
      let result;
      for(let retry=0;retry<3;retry++){
        try{
          result=await api('/api/generate-questions',{method:'POST',body:JSON.stringify({jobId:currentJob.id})});
          break;
        }catch(error){
          const qualityError=/question quality check|question blueprint|repeats an assessment topic|repeats a scenario/i.test(error.message);
          if(!qualityError||retry===2)throw error;
          byId('generation-info').textContent=`Revising questions that failed the quality check (attempt ${retry+2} of 3)…`;
        }
      }
      workingQuestions=result.questions.map(q=>({...q,options:[...q.options]}));
      currentAssessment.questions=result.questions;currentAssessment.reusedCount=result.reusedCount;
      savedSnapshot=JSON.stringify(workingQuestions);assessmentDisplay();
      if(result.progressMessage){byId('generation-info').textContent=result.progressMessage;}
      if(result.done)break;
    }
    notify('Assessment questions are ready. Review and save any edits before publishing.');
  }catch(error){notify(`Generation paused: ${error.message} You can continue without losing completed batches.`,true);}
  finally{generating=false;assessmentDisplay();}
});
byId('save-questions-btn').addEventListener('click',async()=>{
  clearNotification();const btn=byId('save-questions-btn');btn.disabled=true;
  try{
    const result=await api('/api/assessment',{method:'POST',body:JSON.stringify({action:'save',jobId:currentJob.id,questions:workingQuestions})});
    workingQuestions=result.assessment.questions.map(q=>({...q,options:[...q.options]}));
    savedSnapshot=JSON.stringify(workingQuestions);assessmentDisplay();notify('Edits saved. You may now publish.');
  }catch(error){notify(error.message,true);}finally{btn.disabled=false;}
});
byId('publish-btn').addEventListener('click',async()=>{
  if(!currentAssessment || currentAssessment.status!=='draft')return;
  if(JSON.stringify(workingQuestions)!==savedSnapshot)return notify('Save your edits before publishing.',true);
  if(!window.confirm('Publish and lock this assessment? You cannot edit it after publishing.'))return;
  clearNotification();const btn=byId('publish-btn');btn.disabled=true;
  try{
    await api('/api/assessment',{method:'POST',body:JSON.stringify({action:'publish',jobId:currentJob.id})});
    await loadAssessment();byId('assessment-box').open=false;byId('candidates-box').open=true;notify('Assessment published. You can now configure duration and invite pilot candidates below.');
  }catch(error){notify(error.message,true);btn.disabled=false;}
});


// STEP 4 — candidate invitations and evidence reporting, restricted to the signed-in recruiter's organisation.
let invitations=[];
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(className)node.className=className;return node;};
async function loadCandidates(){
  if(!currentJob||currentAssessment?.status!=='published')return hide('candidates-box');
  const result=await api(`/api/invitations?jobId=${encodeURIComponent(currentJob.id)}`);
  invitations=result.invitations;show('candidates-box');
  byId('candidate-total').textContent=`${invitations.length} candidates`;
  byId('assessment-duration').value=result.durationMinutes||({15:25,20:30,25:40,30:45,40:60}[currentAssessment.targetCount]||40);
  const locked=invitations.length>0;byId('assessment-duration').disabled=locked;byId('save-duration-btn').disabled=locked;
  byId('invite-btn').disabled=!result.canInvite;
  byId('candidate-empty').textContent=invitations.length?'':result.pilotMode?'No invitations yet.':'Invitations disabled until credits are enabled.';
  const body=byId('candidate-table');body.replaceChildren();
  invitations.forEach(item=>{
    const tr=el('tr');
    const name=el('td');name.append(el('strong',item.name),el('div',item.email,'muted fine'));
    const status=el('td',displayStatus(item.status));
    const delivery=el('td',item.deliveryStatus);
    const added=el('td',new Date(item.invitedAt).toLocaleDateString('en-IN'));
    const actions=el('td');const row=el('div',undefined,'actions compact-actions');
    if(item.status==='completed'){
      const button=el('button','View report','secondary compact');button.type='button';
      button.addEventListener('click',()=>openReport(item.id));row.append(button);
    } else if(item.status!=='expired'){
      const copy=el('button','Copy link','secondary compact');copy.type='button';
      copy.addEventListener('click',async()=>{try{const result=await api('/api/invitations',{method:'POST',body:JSON.stringify({jobId:currentJob.id,action:'link',invitationId:item.id})});
        await navigator.clipboard.writeText(result.link);notify('Unique invitation link copied. Send it only to the intended candidate.');}catch(error){notify(error.message,true);}});
      const resend=el('button','Resend email','secondary compact');resend.type='button';
      resend.addEventListener('click',async()=>{resend.disabled=true;try{await api('/api/invitations',{method:'POST',body:JSON.stringify({jobId:currentJob.id,action:'resend',invitationId:item.id})});
        notify('Invitation email sent.');await loadCandidates();}catch(error){notify(error.message,true);}finally{resend.disabled=false;}});
      row.append(copy,resend);
    }
    const del=el('button','Delete','secondary compact');del.type='button';
    del.addEventListener('click',async()=>{
      if(!window.confirm(`Permanently delete ${item.name}'s invitation, answers, integrity events and report? This cannot be undone.`))return;
      del.disabled=true;try{await api('/api/invitations',{method:'POST',body:JSON.stringify({jobId:currentJob.id,action:'delete',invitationId:item.id})});
        hide('report-box');await loadCandidates();notify('Candidate data permanently deleted.');}
      catch(error){notify(error.message,true);del.disabled=false;}
    });
    row.append(del);
    actions.append(row);tr.append(name,status,delivery,added,actions);body.append(tr);
  });
}
byId('save-duration-btn').addEventListener('click',async()=>{
  const minutes=Number(byId('assessment-duration').value);
  if(!Number.isInteger(minutes)||minutes<10||minutes>120)return notify('Choose a duration from 10 to 120 minutes.',true);
  const button=byId('save-duration-btn');button.disabled=true;
  try{await api('/api/assessment',{method:'POST',body:JSON.stringify({jobId:currentJob.id,action:'duration',durationMinutes:minutes})});
    notify(`Assessment duration saved: ${minutes} minutes.`);}catch(error){notify(error.message,true);}finally{button.disabled=false;}
});
byId('invite-form').addEventListener('submit',async event=>{
  event.preventDefault();clearNotification();const button=byId('invite-btn');button.disabled=true;
  try{const result=await api('/api/invitations',{method:'POST',body:JSON.stringify({jobId:currentJob.id,action:'create',
    name:byId('candidate-name').value,email:byId('candidate-email').value})});
    byId('invitation-link').value=result.link;byId('invitation-note').textContent=result.note;
    show('invitation-result');byId('invite-form').reset();await loadCandidates();notify('Candidate invitation created.');
  }catch(error){notify(error.message,true);}finally{if(invitations.length<5)button.disabled=false;}
});
byId('copy-invite-btn').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(byId('invitation-link').value);notify('Link copied.');}catch(error){notify(error.message,true);}});
byId('report-close-btn').addEventListener('click',()=>hide('report-box'));
byId('report-print-btn').addEventListener('click',()=>{document.querySelectorAll('#report-content details').forEach(d=>d.open=true);requestAnimationFrame(()=>window.print());});
function reportLine(parent,label,value){const p=el('p');p.append(el('strong',`${label}: `),document.createTextNode(String(value??'—')));parent.append(p);}
function renderEvidenceQuestions(parent,r){
  const appendix=el('details',undefined,'report-appendix');appendix.id='report-appendix';
  appendix.append(el('summary',`Full question-level evidence · ${r.details.length} questions`));
  const body=el('div',undefined,'report-appendix-content');
  r.details.forEach(q=>{
    const card=el('div',undefined,'question-card report-question report-compact');
    card.append(el('h4',`Q${q.order}. ${q.question}`));
    const line=el('p',`${q.competency} · ${q.type} · ${q.timeSeconds}s estimated active time · ${q.changes} answer changes`,'muted');card.append(line);
    const options=el('ol');options.type='A';q.options.forEach((text,index)=>{
      const li=el('li',text);if(index===q.correctIndex)li.classList.add('correct-option');
      if(index===q.selectedIndex)li.classList.add('chosen-option');options.append(li);});card.append(options);
    reportLine(card,'Candidate selected',q.selectedIndex===null?'Not answered':`Option ${'ABCD'[q.selectedIndex]} — ${q.options[q.selectedIndex]}`);
    reportLine(card,'Correct / preferred',`Option ${'ABCD'[q.correctIndex]} — ${q.options[q.correctIndex]}`);
    reportLine(card,'Evaluation',q.isCorrect===null?'Not attempted':q.isCorrect?'Correct':'Incorrect');
    reportLine(card,'Reason',q.rationale);body.append(card);
  });appendix.append(body);parent.append(appendix);
}
function renderV2Report(parent,r){
  const profile=r.profile||{},summary=el('section',undefined,'report-executive');
  summary.append(el('h3','Candidate assessment profile'),el('p',profile.summary||'No profile generated.'));
  summary.append(el('p',profile.eligibilityNote||'Screening questions cannot verify work experience.','muted'));
  if(profile.source)summary.append(el('p',`Narrative: ${profile.source}`,'muted fine'));
  const highlights=el('div',undefined,'report-highlights');
  for(const [heading,items] of [['Demonstrated strengths',profile.strengths],['Areas for further validation',profile.gaps]]){
    const section=el('section',undefined,'report-highlight');section.append(el('h4',heading));
    const list=el('ul');(items?.length?items:['No distinct areas identified from this assessment.']).forEach(x=>list.append(el('li',x)));
    section.append(list);highlights.append(section);
  }summary.append(highlights);parent.append(summary);
  const competencies=el('section',undefined,'report-executive');competencies.append(el('h3','Critical competency profile'));
  competencies.append(el('p','These scores describe performance on sampled questions, not verified real-world proficiency. Competencies were selected and approved before the assessment.','muted'));
  r.competencies.forEach(c=>{
    const row=el('div',undefined,'report-competency');
    const title=el('div',undefined,'report-competency-header');title.append(el('strong',c.name),el('span',`${c.correct}/${c.total} · ${c.score??'—'}%`));row.append(title);
    const track=el('div',undefined,'report-progress');const fill=el('div',undefined,'report-progress-fill');fill.style.width=`${c.score||0}%`;track.append(fill);row.append(track);
    row.append(el('p',`${c.finding} · ${c.evidenceDepth}. ${c.importance} priority.`,'muted'));competencies.append(row);
  });parent.append(competencies);
  const validation=el('section',undefined,'report-executive');validation.append(el('h3','Suggested interview validation'));
  if(profile.interviewValidation?.length){const list=el('ol');profile.interviewValidation.forEach(v=>{
    const li=el('li');li.append(el('strong',`${v.competency}: `),document.createTextNode(v.focus));list.append(li);});validation.append(list);
  }else validation.append(el('p','No specific weakness-triggered questions identified. Recruiter may still validate actual experience.'));
  if(profile.eligibilityChecks?.length){validation.append(el('h4','Eligibility requirements to verify independently'));
    const list=el('ul');profile.eligibilityChecks.forEach(v=>list.append(el('li',v)));validation.append(list);}
  if(profile.notTestedMustHaves?.length){validation.append(el('h4','Important JD requirements not tested'));
    const list=el('ul');profile.notTestedMustHaves.forEach(v=>list.append(el('li',v)));validation.append(list);}
  parent.append(validation);
  const timing=el('section',undefined,'report-executive');timing.append(el('h3','Timing and browser activity'));
  reportLine(timing,'Average elapsed time per question',`${Math.round(r.elapsedSeconds/r.total)}s`);
  reportLine(timing,'Tab-hidden events',r.integrity.tabSwitches);
  reportLine(timing,'Window-blur events',r.integrity.windowBlurEvents);
  timing.append(el('p',r.integrity.timingNote,'muted'));
  const events=el('details');events.append(el('summary','View full browser event timeline'));
  const eventsList=el('ul');(r.integrity.events||[]).forEach(e=>eventsList.append(el('li',`${new Date(e.at).toLocaleString('en-IN')}: ${e.type.replaceAll('_',' ')} (question ${e.questionIndex+1})`)));
  events.append(eventsList);timing.append(events);parent.append(timing);
  renderEvidenceQuestions(parent,r);
  const caveats=el('div',undefined,'callout');r.limitations.forEach(x=>caveats.append(el('p',x)));parent.append(caveats);
}
function renderV3Report(parent,r){
  const profile=r.profile||{};
  const executive=el('section',undefined,'report-executive');
  executive.append(el('h3','Candidate assessment summary'),el('p',profile.summary||'Assessment summary unavailable.'));
  const highlights=el('div',undefined,'report-highlights');
  for(const [title,items] of [['What the responses showed',profile.strengths],['Areas to explore in the interview',profile.weaknesses]]){
    if(!items?.length)continue;
    const box=el('section',undefined,'report-highlight');box.append(el('h4',title));
    const list=el('ul');items.forEach(item=>{
      const li=el('li');li.textContent=`${item.statement}${item.questionNumbers?.length?` (Questions ${item.questionNumbers.join(', ')})`:''}`;
      list.append(li);
    });box.append(list);highlights.append(box);
  }
  executive.append(highlights);parent.append(executive);
  const groups=el('section',undefined,'report-executive');groups.append(el('h3','Performance by competency'));
  r.competencies.filter(c=>c.total>0).forEach(c=>{
    const row=el('div',undefined,'report-competency');
    const title=el('div',undefined,'report-competency-header');title.append(el('strong',c.name),el('span',`${c.correct}/${c.total} · ${c.score}%`));row.append(title);
    const track=el('div',undefined,'report-progress'),fill=el('div',undefined,'report-progress-fill');fill.style.width=`${c.score}%`;track.append(fill);row.append(track);
    const relevant=r.details.filter(q=>q.competency===c.name);
    const right=relevant.filter(q=>q.isCorrect).length;
    const level=c.score>=80?'High score':c.score>=60?'Mixed results':'Requires further exploration';
    row.append(el('p',`${level} · ${right} correct, ${relevant.length-right} missed`, 'muted'));
    groups.append(row);
  });groups.append(el('p','These scores describe answers to the tested questions, not demonstrated workplace ability.','muted fine'));parent.append(groups);
  const validation=el('section',undefined,'report-executive');validation.append(el('h3','Suggested interview validation'));
  const list=el('ol',undefined,'interview-validation');
  (profile.interviewValidation||[]).forEach(v=>{
    const item=el('li');item.append(el('strong',v.competency),el('p',v.question),el('p',`What to look for: ${v.lookFor}`,'muted fine'));
    list.append(item);
  });
  if(!list.children.length)validation.append(el('p','Ask the candidate to explain how they would apply their answers to real workplace situations.'));
  else validation.append(list);
  parent.append(validation);
  const timing=el('section',undefined,'report-executive');timing.append(el('h3','Assessment time and browser activity'));
  reportLine(timing,'Average time per question',`${Math.round(r.elapsedSeconds/Math.max(1,r.total))} seconds`);
  reportLine(timing,'Sustained tab changes',r.integrity.confirmedTabChanges||0);
  timing.append(el('p',r.integrity.description,'muted fine'));
  if(r.integrity.events?.length){const events=el('details');events.append(el('summary','View recorded tab changes'));
    const eventList=el('ul');r.integrity.events.forEach(e=>eventList.append(el('li',`${e.seconds}s away from assessment · Question ${(e.questionIndex||0)+1}`)));
    events.append(eventList);timing.append(events);
  }
  parent.append(timing);
  renderEvidenceQuestions(parent,r);
  const note=el('section',undefined,'report-disclaimer');note.append(el('h3','About this assessment'));
  (r.limitations||[]).forEach(x=>note.append(el('p',x)));parent.append(note);
}
async function openReport(id){
  hide('report-box');clearNotification();
  try{
    const {report:r}=await api(`/api/report?invitationId=${encodeURIComponent(id)}`);
    byId('report-title').textContent=`${r.candidateName} · ${r.jobTitle}`;
    const content=byId('report-content');content.replaceChildren();
    const intro=el('div',undefined,'report-intro');intro.append(el('p','Assessment evidence, not an automated hiring decision.','muted'));
    const summary=el('div',undefined,'report-metrics');
    const metrics=r.reportVersion===3?[['Score',`${r.score}% (${r.correct}/${r.total})`],['Questions answered',`${r.attempted}/${r.total}`],['Time taken',`${Math.floor(r.elapsedSeconds/60)}m ${r.elapsedSeconds%60}s`]]:
      [['Score',`${r.score}% (${r.correct}/${r.total})`],['Attempted',`${r.attempted}/${r.total}`],
      ['Time',`${Math.floor(r.elapsedSeconds/60)}m ${r.elapsedSeconds%60}s`],['Outcome',r.finishReason.replaceAll('_',' ')]];
    for(const [label,value] of metrics){
      const box=el('div',undefined,'report-metric');box.append(el('span',label),el('strong',value));summary.append(box);}
    intro.append(summary);if(r.reportVersion!==3)reportLine(intro,'Assessment version',r.assessmentVersion);
    content.append(intro);
    if(r.reportVersion===3){renderV3Report(content,r);}else if(r.reportVersion===2){renderV2Report(content,r);}else{
    content.append(el('h3','Legacy competency evidence'));
    const table=el('table');const head=el('tr');['JD requirement','Correct / asked','Rating'].forEach(x=>head.append(el('th',x)));table.append(head);
    r.competencies.forEach(c=>{const row=el('tr');row.append(el('td',c.requirement),el('td',`${c.correct}/${c.total}`),el('td',c.level));table.append(row);});content.append(table);
    content.append(el('h3','Question-level evidence'));
    r.details.forEach(q=>{
      const card=el('div',undefined,'question-card report-question');card.append(el('h4',`Question ${q.order}: ${q.question}`));
      reportLine(card,'Competency',q.competency);reportLine(card,'Type',q.type);
      const options=el('ol');options.type='A';q.options.forEach((text,index)=>{
        const li=el('li',text);if(index===q.correctIndex)li.classList.add('correct-option');
        if(index===q.selectedIndex)li.classList.add('chosen-option');options.append(li);});card.append(options);
      reportLine(card,'Candidate selected',q.selectedIndex===null?'Not answered':`Option ${'ABCD'[q.selectedIndex]} — ${q.options[q.selectedIndex]}`);
      reportLine(card,'Correct / preferred',`Option ${'ABCD'[q.correctIndex]} — ${q.options[q.correctIndex]}`);
      reportLine(card,'Evaluation',q.isCorrect===null?'Not attempted':q.isCorrect?'Correct':'Incorrect');
      reportLine(card,'Explanation',q.rationale);reportLine(card,'Estimated active time',`${q.timeSeconds}s`);
      reportLine(card,'Answer changes',q.changes);content.append(card);
    });
    content.append(el('h3','Browser integrity log'));
    reportLine(content,'Logged events',r.integrity.eventCount);
    const info=el('div',undefined,'callout');
    for(const [name,count] of Object.entries(r.integrity.counts||{}))reportLine(info,name.replaceAll('_',' '),count);
    if(!r.integrity.eventCount)info.append(el('p','No browser events logged. This does not guarantee independent work.'));
    const events=el('details');events.append(el('summary','View event timeline'));
    const list=el('ul');(r.integrity.events||[]).forEach(e=>list.append(el('li',`${new Date(e.at).toLocaleString('en-IN')}: ${e.type.replaceAll('_',' ')} (question ${e.questionIndex+1})`)));
    events.append(list);info.append(events);content.append(info);
    const caveats=el('div',undefined,'callout');r.limitations.forEach(x=>caveats.append(el('p',x)));
    content.append(caveats);
    }
    show('report-box');
    // Opening a report is explicit navigation; unlike ordinary actions, reveal its header.
    byId('report-box').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(error){notify(error.message,true);}
}

try {
  const response = await fetch('/api/public-config'); const config = await response.json();
  if (!response.ok) throw new Error(config.error || 'Firebase configuration unavailable');
  auth = getAuth(initializeApp(config));
  onAuthStateChanged(auth, async user => {
    clearNotification();
    if (!user) return onlyView('login-panel');
    try {await refresh(); onlyView('dashboard');}
    catch(error) {await signOut(auth); onlyView('login-panel'); notify(error.message, true);}
  });
} catch(error) {onlyView('login-panel'); byId('login-btn').disabled = true; notify(`App configuration error: ${error.message}`, true);}
