// Firebase browser settings are obtained from our protected application's public config endpoint.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';

const byId = id => document.getElementById(id);
const show = id => byId(id).classList.remove('hidden');
const hide = id => byId(id).classList.add('hidden');
let auth;
let jobs = [];
let currentJob = null;
let workingRequirements = [];
let currentAssessment = null;
let workingQuestions = [];
let savedSnapshot = "";
let generating = false;

function notify(text, error = false) {
  const box = byId('message'); box.textContent = text; box.classList.toggle('error', error);
  show('message'); box.scrollIntoView({behavior: 'smooth', block: 'nearest'});
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
  const response = await fetch(url, {...options, headers: {...headers, ...(options.headers || {})}});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function renderJobs(filter = '') {
  const tbody = byId('jobs-body'); tbody.replaceChildren();
  const visible = jobs.filter(j => j.title.toLowerCase().includes(filter.toLowerCase()));
  for (const job of visible) {
    const tr = document.createElement('tr');
    const title = document.createElement('td'); title.textContent = job.title;
    const status = document.createElement('td'); const tag = document.createElement('span');
    tag.className = 'tag'; tag.textContent = job.status.replaceAll('_', ' '); status.append(tag);
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
  hide('extraction-box'); hide('approved-box'); hide('assessment-box'); show('extract-actions');
  currentAssessment = null; workingQuestions = [];
  byId('extract-btn').disabled = true;
  try {
    currentJob = (await api(`/api/job?id=${encodeURIComponent(id)}`)).job;
    byId('detail-title').textContent = currentJob.title;
    byId('detail-status').textContent = `Status: ${currentJob.status.replaceAll('_',' ')}`;
    byId('detail-jd').textContent = currentJob.jdText;
    if (currentJob.approvedRequirements) { renderApproved(currentJob.approvedRequirements); await loadAssessment(); }
    else if (currentJob.extraction) {hide('extract-actions'); renderExtraction(currentJob.extraction, currentJob.extractionSource);}
    else show('extract-actions');
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
    renderExtraction(result.extraction, result.source, result.similar);
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
    await loadAssessment();
    notify('Requirements approved. Select the assessment length to generate your questions.');
  } catch(error) {notify(error.message, true);}
  finally {button.disabled = false;}
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
  workingQuestions.forEach((q,i)=>{
    const card=document.createElement('div'); card.className='question-card';
    const heading=document.createElement('h3'); heading.textContent=`Question ${i+1}`;
    const tag=document.createElement('span');tag.className='tag';tag.textContent=q.source==='exact-cache'?'Exact cache':q.source==='similar-cache'?'Similar role':'New';
    heading.append(tag);card.append(heading);
    const prompt=qEl(`Question ${i+1}`,q.text,3,650);prompt.disabled=published;
    prompt.addEventListener('input',()=>{q.text=prompt.value;markChanged();});card.append(prompt);
    const meta=document.createElement('div');meta.className='two-col';
    const requirement=document.createElement('div');const reqLabel=document.createElement('label');reqLabel.textContent='Mapped JD requirement';
    const reqOptions=currentJob.approvedRequirements.requirements.map((r,index)=>`${index+1}. ${r.text}`);
    const reqSelect=selectField(reqOptions,reqOptions[q.requirementIndex],`Requirement for question ${i+1}`,value=>{
      q.requirementIndex=reqOptions.indexOf(value);markChanged();});reqSelect.disabled=published;requirement.append(reqLabel,reqSelect);
    const typeBox=document.createElement('div');const typeLabel=document.createElement('label');typeLabel.textContent='Question type';
    const typeSelect=selectField(qTypes,q.type,`Question type ${i+1}`,value=>{q.type=value;markChanged();});typeSelect.disabled=published;typeBox.append(typeLabel,typeSelect);meta.append(requirement,typeBox);card.append(meta);
    const grid=document.createElement('div');grid.className='options-grid';
    q.options.forEach((opt,j)=>{
      const cell=document.createElement('div');const label=document.createElement('label');label.textContent=`Option ${'ABCD'[j]}`;
      const input=qEl(`Question ${i+1}, option ${'ABCD'[j]}`,opt,2,260);input.disabled=published;
      input.addEventListener('input',()=>{q.options[j]=input.value;markChanged();});cell.append(label,input);grid.append(cell);
    });card.append(grid);
    const answer=document.createElement('label');answer.textContent='Best answer';card.append(answer);
    const answerSelect=selectField(['A','B','C','D'],'ABCD'[q.correctIndex],`Best answer for question ${i+1}`,value=>{q.correctIndex='ABCD'.indexOf(value);markChanged();});
    answerSelect.disabled=published;card.append(answerSelect);
    const why=document.createElement('label');why.textContent='Why this is the best answer (recruiter only)';card.append(why);
    const rationale=qEl(`Explanation for question ${i+1}`,q.rationale,3,700);rationale.disabled=published;
    rationale.addEventListener('input',()=>{q.rationale=rationale.value;markChanged();});card.append(rationale);
    container.append(card);
  });
  if(!published) show('assessment-actions');
}
function assessmentDisplay() {
  if(!currentAssessment) {show('assessment-setup');hide('assessment-workspace');byId('assessment-status').textContent='Not started';return;}
  hide('assessment-setup');show('assessment-workspace');
  const a=currentAssessment;
  byId('assessment-status').textContent=a.status;
  byId('generation-info').textContent=`${workingQuestions.length} of ${a.targetCount} questions prepared. ${a.reusedCount||0} reused from your organisation’s published question cache.${a.status==='published'?' Assessment published and locked.':''}`;
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
}
byId('start-assessment-btn').addEventListener('click',async()=>{
  if(!currentJob?.approvedRequirements)return;
  clearNotification();const btn=byId('start-assessment-btn');btn.disabled=true;
  try{
    const result=await api('/api/assessment',{method:'POST',body:JSON.stringify({action:'start',jobId:currentJob.id,targetCount:Number(byId('question-count').value)})});
    currentAssessment=result.assessment;workingQuestions=(result.assessment.questions||[]).map(q=>({...q,options:[...q.options]}));
    savedSnapshot=JSON.stringify(workingQuestions);assessmentDisplay();
    notify('Assessment draft created. Select Generate questions to begin.');
  }catch(error){notify(error.message,true);}finally{btn.disabled=false;}
});
byId('generate-btn').addEventListener('click',async()=>{
  if(generating||!currentAssessment)return;
  generating=true;clearNotification();assessmentDisplay();
  try{
    while(workingQuestions.length<currentAssessment.targetCount){
      const result=await api('/api/generate-questions',{method:'POST',body:JSON.stringify({jobId:currentJob.id})});
      workingQuestions=result.questions.map(q=>({...q,options:[...q.options]}));
      currentAssessment.questions=result.questions;currentAssessment.reusedCount=result.reusedCount;
      savedSnapshot=JSON.stringify(workingQuestions);assessmentDisplay();
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
    await loadAssessment();notify('Assessment published. Approved questions are now eligible for reuse in similar roles. Candidate invitations come in Step 4.');
  }catch(error){notify(error.message,true);btn.disabled=false;}
});

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
