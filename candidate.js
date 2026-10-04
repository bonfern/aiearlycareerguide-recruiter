const byId=id=>document.getElementById(id);
const show=id=>byId(id).classList.remove('hidden');
const hide=id=>byId(id).classList.add('hidden');
const views=['candidate-loading','candidate-verify','candidate-ready','candidate-test','candidate-done'];
const view=id=>{views.forEach(hide);show(id);};
const invite=new URL(location.href).searchParams.get('invite');
const storeKey=`recruiter-assessment-session:${invite}`;
let session=sessionStorage.getItem(storeKey),model=null,index=0,deadline=0,serverOffset=0,busy=false,finished=false;
let role='',duration=0,tick=null,idle=false,idleTimeout=null,events=[],flushing=false,enteredFullscreen=false;
const errorText=(error)=>error instanceof Error?error.message:String(error);
function notify(text,isError=true){const box=byId('candidate-message');box.textContent=text;box.classList.toggle('error',isError);show('candidate-message');}
function clearMessage(){hide('candidate-message');}
async function send(url,body,authenticated=false,{keepalive=false}={}){
  const headers={'Content-Type':'application/json'};
  if(authenticated){if(!session)throw new Error('Verify your email again.');headers.Authorization=`Bearer ${session}`;}
  const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store',keepalive});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||'Request failed. Check your internet connection.');
  return data;
}
const inviteApi=(action,extra={})=>send('/api/invite',{invite,action,...extra});
const candidateApi=(action,extra={})=>send('/api/candidate',{action,...extra},true);
function updateTimer(){
  if(!deadline||finished)return;
  const remaining=Math.max(0,Math.ceil((deadline-(Date.now()+serverOffset))/1000));
  byId('candidate-timer').textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  if(remaining<=0){byId('candidate-timer').classList.add('expired');finishAssessment('time');}
}
function stopTimers(){if(tick)clearInterval(tick);if(idleTimeout)clearTimeout(idleTimeout);tick=null;}
function showDone(reason){finished=true;stopTimers();sessionStorage.removeItem(storeKey);view('candidate-done');
  byId('completion-message').textContent=reason==='time_expired'?'Your allotted time has ended. Saved responses have been submitted.':'Your assessment has been submitted. You may close this page.';}
async function refresh(){
  if(!session)throw new Error('Session unavailable');
  const response=await fetch('/api/candidate',{headers:{Authorization:`Bearer ${session}`},cache:'no-store'});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Unable to resume assessment');
  receiveState(data.assessment);
}
function receiveState(next){
  model=next;
  if(next.status==='completed')return showDone(next.finishReason);
  if(next.status==='verified')return renderReady();
  if(next.status!=='started')return view('candidate-verify');
  index=next.currentIndex||0;deadline=next.deadlineAt;serverOffset=next.serverTime-Date.now();finished=false;
  view('candidate-test');byId('candidate-role').textContent=role||'Candidate assessment';renderQuestion();updateTimer();
  if(!tick)tick=setInterval(updateTimer,1000);scheduleIdle();
}
function renderReady(){view('candidate-ready');byId('ready-description').textContent=`${role}: ${duration} minutes. Your timer begins only when you click Start assessment.`;}
async function initialize(){
  if(!invite||!/^[A-Za-z0-9_-]{35,100}$/.test(invite))return notify('This invitation link is invalid. Request a new link from the recruiter.');
  try{const details=await inviteApi('details');role=details.role;duration=details.durationMinutes;
    if(details.status==='completed'){return showDone('submitted');}
    if(details.status==='expired')return notify('This invitation has expired. Contact the recruiter.');
    byId('invite-details').textContent=`${role} · ${duration}-minute assessment`;
    byId('email-hint').textContent=details.emailHint;
    if(session){try{await refresh();return;}catch{session=null;sessionStorage.removeItem(storeKey);}}
    view('candidate-verify');
  }catch(error){notify(errorText(error));}
}
byId('request-otp').addEventListener('click',async()=>{
  clearMessage();const button=byId('request-otp');button.disabled=true;
  try{await inviteApi('send-code');show('otp-form');notify('Verification code sent. Check your inbox and spam folder.',false);}
  catch(error){notify(errorText(error));}finally{setTimeout(()=>{button.disabled=false;},60000);}
});
byId('otp-form').addEventListener('submit',async event=>{
  event.preventDefault();clearMessage();byId('verify-otp').disabled=true;
  try{const result=await inviteApi('verify',{code:byId('otp-input').value.trim()});
    session=result.session;sessionStorage.setItem(storeKey,session);byId('otp-input').value='';await refresh();}
  catch(error){notify(errorText(error));}finally{byId('verify-otp').disabled=false;}
});
byId('candidate-consent').addEventListener('change',event=>byId('begin-assessment').disabled=!event.target.checked);
byId('begin-assessment').addEventListener('click',async()=>{
  if(!byId('candidate-consent').checked)return;
  byId('begin-assessment').disabled=true;clearMessage();
  try{const result=await candidateApi('start');receiveState(result.assessment);
    if(byId('fullscreen-opt-in').checked){
      if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen()
        .then(()=>{enteredFullscreen=true;}).catch(()=>queueEvent('fullscreen_unavailable'));
      else queueEvent('fullscreen_unavailable');
    }
  }catch(error){notify(errorText(error));byId('begin-assessment').disabled=false;}
});
function renderQuestion(){
  if(!model||model.status!=='started')return;
  const questions=model.questions||[];
  const q=questions[index];if(!q)return;
  byId('candidate-question-title').textContent=`Question ${index+1} of ${questions.length}`;
  byId('candidate-question-text').textContent=q.text;
  byId('candidate-progress').textContent=`${questions.filter(x=>x.selected!==null).length} of ${questions.length} answered`;
  const box=byId('candidate-options');box.replaceChildren();
  q.options.forEach((option,choice)=>{
    const label=document.createElement('label');label.className='candidate-option';
    const input=document.createElement('input');input.type='radio';input.name='choice';input.value=String(choice);input.checked=q.selected===choice;
    input.addEventListener('change',async()=>{
      if(busy)return;busy=true;byId('answer-save-status').textContent='Saving your answer…';
      try{const result=await candidateApi('answer',{questionId:q.id,selected:choice});
        if(result.assessment.status==='completed')return showDone(result.assessment.finishReason);
        model=result.assessment;byId('answer-save-status').textContent='Answer saved.';
        byId('candidate-progress').textContent=`${model.questions.filter(x=>x.selected!==null).length} of ${model.questions.length} answered`;
      }catch(error){byId('answer-save-status').textContent='Not saved; please retry.';notify(errorText(error));input.checked=false;}
      finally{busy=false;}
    });label.append(input,document.createTextNode(`${'ABCD'[choice]}. ${option}`));box.append(label);
  });
  byId('candidate-prev').disabled=index===0;
  byId('candidate-next').disabled=index>=questions.length-1;
  byId('answer-save-status').textContent='Your answer is saved when selected.';
  const nav=byId('candidate-question-nav');nav.replaceChildren();questions.forEach((item,i)=>{
    const b=document.createElement('button');b.type='button';b.textContent=String(i+1);
    b.className=`question-nav-item ${i===index?'current':''} ${item.selected!==null?'answered':''}`;
    b.setAttribute('aria-label',`Go to question ${i+1}${item.selected!==null?', answered':''}`);
    b.addEventListener('click',()=>navigate(i));nav.append(b);
  });
}
async function navigate(next){
  if(!model||busy||next===index||next<0||next>=model.questions.length)return;
  busy=true;clearMessage();
  try{const result=await candidateApi('navigate',{index:next});if(result.assessment.status==='completed')return showDone(result.assessment.finishReason);
    receiveState(result.assessment);}
  catch(error){notify(errorText(error));}finally{busy=false;}
}
byId('candidate-prev').addEventListener('click',()=>navigate(index-1));
byId('candidate-next').addEventListener('click',()=>navigate(index+1));
let submitting=false;
async function finishAssessment(reason){
  if(submitting||finished)return;
  if(reason==='manual'&&!confirm('Submit your answers now? You will not be able to return.'))return;
  submitting=true;busy=true;clearMessage();
  try{const result=await candidateApi('submit');if(result.status==='completed')showDone(reason==='time'?'time_expired':'submitted');
    else notify('Unable to finish yet. Please check your connection and try again.');}
  catch(error){notify(`Your answers remain saved. We will retry submission when connected. ${errorText(error)}`);
    if(reason==='time')setTimeout(()=>{if(!finished)finishAssessment('time');},5000);}
  finally{submitting=false;busy=false;}
}
byId('candidate-submit').addEventListener('click',()=>finishAssessment('manual'));
async function flushEvents(){
  if(flushing||!session||!model||model.status!=='started')return;
  flushing=true;try{while(events.length){
    const type=events[0];try{const result=await candidateApi('event',{type});events.shift();
      if(result.assessment.status==='completed'){showDone(result.assessment.finishReason);break;}}
    catch{break;}
  }}finally{flushing=false;}
}
function queueEvent(type){if(!session||!model||model.status!=='started'||finished)return;
  if(events.length>=15)events.shift();events.push(type);flushEvents();}
function scheduleIdle(){if(idleTimeout)clearTimeout(idleTimeout);idleTimeout=setTimeout(()=>{
  if(model?.status==='started'&&!idle){idle=true;queueEvent('idle_start');}
},90000);}
for(const name of ['pointerdown','keydown'])document.addEventListener(name,()=>{
  if(model?.status!=='started')return;if(idle){idle=false;queueEvent('idle_end');}scheduleIdle();},{passive:true});
document.addEventListener('visibilitychange',()=>queueEvent(document.hidden?'tab_hidden':'tab_visible'));
window.addEventListener('blur',()=>queueEvent('window_blur'));
window.addEventListener('focus',()=>{queueEvent('window_focus');flushEvents();});
document.addEventListener('fullscreenchange',()=>{if(enteredFullscreen&&!document.fullscreenElement){enteredFullscreen=false;queueEvent('fullscreen_exit');}});
document.addEventListener('copy',()=>queueEvent('copy'));
document.addEventListener('paste',()=>queueEvent('paste'));
window.addEventListener('offline',()=>queueEvent('offline'));
window.addEventListener('online',()=>{queueEvent('online');flushEvents();if(model?.status==='started')refresh().catch(()=>{});});
window.addEventListener('beforeunload',event=>{if(model?.status==='started'&&!finished){event.preventDefault();event.returnValue='';}});
initialize();
