// Public Firebase Web SDK values come from /api/public-config; admin secrets never enter this file.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';

const byId = id => document.getElementById(id);
const show = id => byId(id).classList.remove('hidden');
const hide = id => byId(id).classList.add('hidden');
let auth;
let jobs = [];

function notify(text, error = false) {
  const box = byId('message');
  box.textContent = text;
  box.classList.toggle('error', error);
  show('message');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function clearNotification() { hide('message'); }
function loginView() {
  show('login-panel'); hide('dashboard'); hide('create-panel'); hide('logout');
}
function dashboardView() {
  hide('login-panel'); show('dashboard'); hide('create-panel'); show('logout');
}
function createView() {
  clearNotification(); hide('dashboard'); show('create-panel');
}
async function api(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in');
  const headers = { Authorization: `Bearer ${await user.getIdToken()}` };
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function renderJobs(filter = '') {
  const tbody = byId('jobs-body');
  tbody.replaceChildren();
  const visible = jobs.filter(j => j.title.toLowerCase().includes(filter.toLowerCase()));
  for (const job of visible) {
    const tr = document.createElement('tr');
    const title = document.createElement('td'); title.textContent = job.title;
    const status = document.createElement('td');
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = job.status;
    status.append(tag);
    const candidates = document.createElement('td'); candidates.textContent = String(job.candidateCount);
    const completed = document.createElement('td'); completed.textContent = String(job.completedCount);
    const created = document.createElement('td');
    created.textContent = job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-IN') : '—';
    tr.append(title, status, candidates, completed, created); tbody.append(tr);
  }
  byId('empty-state').textContent = jobs.length === 0
    ? 'No jobs yet. Select “Create job” to begin.'
    : visible.length === 0 ? 'No matching jobs.' : '';
}
async function refresh() {
  const [me, listing] = await Promise.all([api('/api/me'), api('/api/jobs')]);
  byId('org-name').textContent = me.organizationName;
  jobs = listing.jobs;
  byId('total-jobs').textContent = String(jobs.length);
  byId('published-jobs').textContent = String(jobs.filter(j => j.status === 'published').length);
  byId('total-candidates').textContent = String(jobs.reduce((sum, job) => sum + job.candidateCount, 0));
  byId('total-completed').textContent = String(jobs.reduce((sum, job) => sum + job.completedCount, 0));
  renderJobs(byId('search').value);
}

byId('login-form').addEventListener('submit', async event => {
  event.preventDefault(); clearNotification();
  const button = byId('login-btn'); button.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, byId('email').value.trim(), byId('password').value);
    byId('password').value = '';
  } catch (error) { notify(error.code === 'auth/invalid-credential' ? 'Incorrect email or password.' : error.message, true); }
  finally { button.disabled = false; }
});
byId('logout').addEventListener('click', async () => { await signOut(auth); clearNotification(); loginView(); });
byId('new-job-btn').addEventListener('click', createView);
byId('back-btn').addEventListener('click', dashboardView);
byId('cancel-btn').addEventListener('click', dashboardView);
byId('search').addEventListener('input', event => renderJobs(event.target.value));
byId('job-form').addEventListener('submit', async event => {
  event.preventDefault(); clearNotification();
  const button = byId('save-job-btn'); button.disabled = true;
  try {
    await api('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({
        title: byId('job-title').value,
        department: byId('department').value,
        jdText: byId('jd-text').value
      })
    });
    byId('job-form').reset(); dashboardView(); await refresh();
    notify('Draft JD saved. AI extraction and Word/PDF uploads arrive in the next build step.');
  } catch (error) { notify(error.message, true); }
  finally { button.disabled = false; }
});

try {
  const response = await fetch('/api/public-config');
  const config = await response.json();
  if (!response.ok) throw new Error(config.error || 'Firebase configuration unavailable');
  auth = getAuth(initializeApp(config));
  onAuthStateChanged(auth, async user => {
    clearNotification();
    if (!user) return loginView();
    try { await refresh(); dashboardView(); }
    catch (error) {
      await signOut(auth);
      loginView(); notify(error.message, true);
    }
  });
} catch (error) {
  loginView(); byId('login-btn').disabled = true;
  notify(`App configuration error: ${error.message}`, true);
}
