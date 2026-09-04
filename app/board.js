import { scoreJob } from './scoring.js';

const STORAGE_KEY = 'astrojob-jobs-v1';
const STATUS_LABELS = {
  all: 'All',
  new: 'New Matches',
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected / Skipped',
  withdrawn: 'Withdrawn'
};

const state = {
  jobs: [],
  status: 'all',
  query: '',
  decision: 'all',
  country: 'all',
  sort: 'priority'
};

const $ = sel => document.querySelector(sel);
const els = {
  grid: $('#jobsGrid'), empty: $('#emptyState'), stats: $('#stats'), tabs: $('#tabs'),
  search: $('#searchInput'), decision: $('#decisionFilter'), country: $('#countryFilter'), sort: $('#sortBy'),
  template: $('#jobCardTemplate'), add: $('#addJobButton'), emptyAdd: $('#emptyAddButton'), loadDemo: $('#loadDemoButton'),
  export: $('#exportButton'), import: $('#importButton'), importFile: $('#importFile'),
  dialog: $('#jobDialog'), form: $('#jobForm'), close: $('#closeDialog'), cancel: $('#cancelDialog'),
  deleteBtn: $('#deleteJobButton'), dialogTitle: $('#dialogTitle'), dialogScore: $('#dialogScore')
};

const fields = {
  id: $('#jobId'), url: $('#jobUrl'), title: $('#jobTitle'), company: $('#jobCompany'), country: $('#jobCountry'),
  city: $('#jobCity'), workModel: $('#jobWorkModel'), postedAt: $('#jobPostedAt'), renewedAt: $('#jobRenewedAt'),
  currency: $('#jobCurrency'), monthly: $('#jobMonthly'), annual: $('#jobAnnual'), interest: $('#jobInterest'),
  nextAction: $('#jobNextAction'), languages: $('#jobLanguages'), description: $('#jobDescription'), notes: $('#jobNotes')
};

const safeParse = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};
const uid = () => 'job-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7);
const toIso = v => v ? new Date(v + 'T12:00:00').toISOString() : null;
const toDateInput = v => v ? String(v).slice(0,10) : '';
const numOrNull = v => v === '' ? null : Number(v);

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.jobs.map(({score, ...job}) => job)));
}
function enrich(job) {
  return { ...job, status: job.status || 'new', score: scoreJob(job) };
}
function loadStored() {
  const saved = safeParse(localStorage.getItem(STORAGE_KEY), []);
  state.jobs = Array.isArray(saved) ? saved.map(enrich) : [];
}
function setStatus(id, status) {
  const job = state.jobs.find(j => j.id === id);
  if (!job) return;
  job.status = status;
  job.updatedAt = new Date().toISOString();
  persist();
  render();
}
function formatSalary(job) {
  const s = job.salary || {};
  if (!Number.isFinite(s.monthlyGross) && !Number.isFinite(s.annualGross)) return 'Salary: not disclosed';
  const parts = [], currency = s.currency || '';
  if (Number.isFinite(s.monthlyGross)) parts.push(`${s.monthlyGross.toLocaleString()} ${currency} gross / month`);
  if (Number.isFinite(s.annualGross)) parts.push(`${s.annualGross.toLocaleString()} ${currency} gross / year`);
  return 'Salary: ' + parts.join(' · ');
}
function recommendationLabel(result) {
  return ({ APPLY_NOW:'🔥 APPLY NOW', APPLY:'APPLY', STRETCH:'STRETCH', MAYBE:'MAYBE', REJECT:'REJECT' })[result.decision] || result.decision;
}
function interestLabel(v) {
  return ({love:'💗 Love this',positive:'✨ Interested',neutral:'Neutral',low:'Not excited'})[v] || '';
}
function renderTabs() {
  els.tabs.innerHTML = '';
  for (const [key,label] of Object.entries(STATUS_LABELS)) {
    const count = key === 'all' ? state.jobs.length : state.jobs.filter(j => j.status === key).length;
    const btn = document.createElement('button');
    btn.className = 'tab ' + (state.status === key ? 'active' : '');
    btn.textContent = `${label} ${count}`;
    btn.addEventListener('click', () => { state.status = key; render(); });
    els.tabs.appendChild(btn);
  }
}
function renderStats() {
  const actionable = state.jobs.filter(j => ['APPLY_NOW','APPLY','STRETCH'].includes(j.score.decision) && !['rejected','withdrawn'].includes(j.status)).length;
  const hot = state.jobs.filter(j => j.score.priority >= 85 && j.score.decision !== 'REJECT').length;
  const active = state.jobs.filter(j => ['applied','screening','interview'].includes(j.status)).length;
  const offers = state.jobs.filter(j => j.status === 'offer').length;
  const items = [['Actionable matches',actionable],['🔥 Top priority',hot],['Active applications',active],['Offers',offers]];
  els.stats.innerHTML = items.map(([label,value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
}
function renderCountries() {
  const previous = state.country;
  const countries = [...new Set(state.jobs.map(j => j.country).filter(Boolean))].sort();
  els.country.innerHTML = '<option value="all">All countries</option>' + countries.map(c => `<option value="${c.replace(/"/g,'&quot;')}">${c}</option>`).join('');
  state.country = countries.includes(previous) ? previous : 'all';
  els.country.value = state.country;
}
function filteredJobs() {
  const q = state.query.trim().toLowerCase();
  return [...state.jobs]
    .filter(j => state.status === 'all' || j.status === state.status)
    .filter(j => state.decision === 'all' || j.score.decision === state.decision)
    .filter(j => state.country === 'all' || j.country === state.country)
    .filter(j => !q || [j.title,j.company,j.city,j.country,j.description,j.notes].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a,b) => {
      if (state.sort === 'fit') return b.score.fit - a.score.fit;
      if (state.sort === 'newest') return new Date(b.foundAt || b.createdAt || 0) - new Date(a.foundAt || a.createdAt || 0);
      return b.score.priority - a.score.priority;
    });
}
function renderCard(job) {
  const node = els.template.content.cloneNode(true);
  const card = node.querySelector('.job-card');
  const badge = node.querySelector('.priority-badge');
  const taxonomy = node.querySelector('.taxonomy-badge');
  const meta = [job.city,job.country,job.workModel].filter(Boolean).join(' · ');

  node.querySelector('.job-company').textContent = job.company || 'Unknown company';
  node.querySelector('.job-title').textContent = job.title || 'Untitled role';
  node.querySelector('.job-meta').textContent = meta;
  badge.textContent = recommendationLabel(job.score);
  taxonomy.textContent = job.score.taxonomy || '☄️ Wild Card';
  if (job.score.priority >= 85 && job.score.decision !== 'REJECT') badge.classList.add('hot');
  if (job.score.decision === 'REJECT') badge.classList.add('reject');

  node.querySelector('.fit-score').textContent = job.score.fit + '%';
  node.querySelector('.desirability-score').textContent = job.score.desirability + '%';
  node.querySelector('.priority-score').textContent = job.score.priority + '%';
  node.querySelector('.salary-row').textContent = formatSalary(job);

  const flags = node.querySelector('.flags');
  [...(job.score.flags || []), ...(job.score.hardReject ? [job.score.hardReject] : [])].forEach(flag => {
    const span = document.createElement('span'); span.className = 'flag'; span.textContent = flag; flags.appendChild(span);
  });
  if (job.interest) {
    const span = document.createElement('span'); span.className = 'flag'; span.textContent = interestLabel(job.interest); flags.appendChild(span);
  }
  if (job.nextActionAt) {
    const span = document.createElement('span'); span.className = 'flag'; span.textContent = 'Next: ' + new Date(job.nextActionAt).toLocaleDateString(); flags.appendChild(span);
  }

  const reasons = node.querySelector('.reasons-list');
  (job.score.reasons?.length ? job.score.reasons : ['Passed hard filters; no strong positive signal detected yet.']).forEach(r => {
    const li = document.createElement('li'); li.textContent = r; reasons.appendChild(li);
  });
  const gaps = node.querySelector('.gaps-list');
  (job.score.gaps?.length ? job.score.gaps : ['No major keyword-level gaps flagged.']).forEach(g => {
    const li = document.createElement('li'); li.textContent = g; gaps.appendChild(li);
  });

  const preview = node.querySelector('.job-notes-preview');
  if (job.notes) preview.textContent = job.notes.length > 180 ? job.notes.slice(0,180) + '…' : job.notes;

  const link = node.querySelector('.apply-link');
  link.href = job.url || '#';
  if (!job.url || job.url === '#') { link.classList.add('disabled'); link.textContent = 'No job link'; }

  node.querySelector('.edit-job').addEventListener('click', () => openDialog(job.id));
  const select = node.querySelector('.status-select');
  select.value = job.status || 'new';
  select.addEventListener('change', e => setStatus(job.id,e.target.value));
  card.dataset.id = job.id;
  return node;
}
function render() {
  renderTabs(); renderStats();
  const jobs = filteredJobs();
  els.grid.innerHTML = '';
  jobs.forEach(job => els.grid.appendChild(renderCard(job)));
  els.empty.hidden = jobs.length > 0;
}
function blankForm() {
  Object.values(fields).forEach(el => {
    if (!el) return;
    if (el.tagName === 'SELECT') return;
    el.value = '';
  });
  fields.workModel.value = 'Remote';
  fields.interest.value = 'positive';
  fields.currency.value = '';
}
function populateForm(job) {
  fields.id.value = job.id;
  fields.url.value = job.url || '';
  fields.title.value = job.title || '';
  fields.company.value = job.company || '';
  fields.country.value = job.country || '';
  fields.city.value = job.city || '';
  fields.workModel.value = job.workModel || 'Remote';
  fields.postedAt.value = toDateInput(job.postedAt);
  fields.renewedAt.value = toDateInput(job.renewedAt);
  fields.currency.value = job.salary?.currency || '';
  fields.monthly.value = Number.isFinite(job.salary?.monthlyGross) ? job.salary.monthlyGross : '';
  fields.annual.value = Number.isFinite(job.salary?.annualGross) ? job.salary.annualGross : '';
  fields.interest.value = job.interest || 'positive';
  fields.nextAction.value = toDateInput(job.nextActionAt);
  fields.languages.value = (job.languages || []).join(', ');
  fields.description.value = job.description || '';
  fields.notes.value = job.notes || '';
}
function openDialog(id=null) {
  blankForm();
  const job = id ? state.jobs.find(j => j.id === id) : null;
  els.dialogTitle.textContent = job ? 'Edit job' : 'Add a job';
  els.deleteBtn.hidden = !job;
  if (job) populateForm(job);
  els.dialogScore.textContent = job
    ? `${job.score.taxonomy} · Fit ${job.score.fit}% · Desirability ${job.score.desirability}% · Priority ${job.score.priority}% · ${recommendationLabel(job.score)}`
    : 'Fill in the role and AstroJob will score it when you save.';
  els.dialog.showModal();
}
function closeDialog() { els.dialog.close(); }

function formToJob(existing=null) {
  const salary = {};
  if (fields.currency.value) salary.currency = fields.currency.value;
  const monthly = numOrNull(fields.monthly.value), annual = numOrNull(fields.annual.value);
  if (Number.isFinite(monthly)) salary.monthlyGross = monthly;
  if (Number.isFinite(annual)) salary.annualGross = annual;
  const now = new Date().toISOString();
  return {
    ...(existing || {}),
    id: existing?.id || uid(),
    title: fields.title.value.trim(),
    company: fields.company.value.trim(),
    country: fields.country.value.trim(),
    city: fields.city.value.trim(),
    workModel: fields.workModel.value,
    url: fields.url.value.trim() || '#',
    postedAt: toIso(fields.postedAt.value),
    renewedAt: toIso(fields.renewedAt.value),
    salary,
    languages: fields.languages.value.split(',').map(x=>x.trim()).filter(Boolean),
    description: fields.description.value.trim(),
    notes: fields.notes.value.trim(),
    interest: fields.interest.value,
    nextActionAt: toIso(fields.nextAction.value),
    status: existing?.status || 'new',
    foundAt: existing?.foundAt || now,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

els.form.addEventListener('submit', e => {
  e.preventDefault();
  if (!fields.title.value.trim() || !fields.company.value.trim() || !fields.country.value.trim()) return;
  const existing = state.jobs.find(j => j.id === fields.id.value);
  const job = enrich(formToJob(existing));
  if (existing) state.jobs[state.jobs.findIndex(j => j.id === existing.id)] = job;
  else state.jobs.unshift(job);
  persist(); renderCountries(); state.status = 'all'; render(); closeDialog();
});
els.deleteBtn.addEventListener('click', () => {
  const id = fields.id.value;
  if (!id || !confirm('Delete this job from AstroJob?')) return;
  state.jobs = state.jobs.filter(j => j.id !== id);
  persist(); renderCountries(); render(); closeDialog();
});

els.add.addEventListener('click', () => openDialog());
els.emptyAdd.addEventListener('click', () => openDialog());
els.close.addEventListener('click', closeDialog);
els.cancel.addEventListener('click', closeDialog);
els.dialog.addEventListener('click', e => { if (e.target === els.dialog) closeDialog(); });

els.search.addEventListener('input', e => { state.query = e.target.value; render(); });
els.decision.addEventListener('change', e => { state.decision = e.target.value; render(); });
els.country.addEventListener('change', e => { state.country = e.target.value; render(); });
els.sort.addEventListener('change', e => { state.sort = e.target.value; render(); });

els.export.addEventListener('click', () => {
  const payload = JSON.stringify({ version:1, exportedAt:new Date().toISOString(), jobs:state.jobs.map(({score,...j})=>j) }, null, 2);
  const blob = new Blob([payload], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'astrojob-backup.json'; a.click(); URL.revokeObjectURL(a.href);
});
els.import.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', async e => {
  const file = e.target.files?.[0]; if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const jobs = Array.isArray(parsed) ? parsed : parsed.jobs;
    if (!Array.isArray(jobs)) throw new Error('No jobs array found');
    state.jobs = jobs.map(enrich); persist(); renderCountries(); render();
  } catch (err) { alert('Could not import backup: ' + err.message); }
  e.target.value = '';
});
els.loadDemo.addEventListener('click', async () => {
  const res = await fetch('./data/sample-jobs.json');
  const jobs = await res.json();
  state.jobs = jobs.map((j,i) => enrich({ ...j, status:'new', foundAt:j.foundAt || new Date(Date.now()-i*86400000).toISOString(), createdAt:new Date().toISOString() }));
  persist(); renderCountries(); render();
});

loadStored();
renderCountries();
render();
