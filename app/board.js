import { scoreJob } from './scoring.js';

const STATUS_LABELS = {
  all: 'All', new: 'New Matches', saved: 'Saved', applied: 'Applied', interview: 'Interview', rejected: 'Rejected / Skipped'
};

const state = {
  jobs: [],
  status: 'new',
  query: '',
  decision: 'all',
  country: 'all',
  sort: 'priority',
  statuses: JSON.parse(localStorage.getItem('astrojob-statuses') || '{}')
};

const els = {
  grid: document.querySelector('#jobsGrid'),
  empty: document.querySelector('#emptyState'),
  stats: document.querySelector('#stats'),
  tabs: document.querySelector('#tabs'),
  search: document.querySelector('#searchInput'),
  decision: document.querySelector('#decisionFilter'),
  country: document.querySelector('#countryFilter'),
  sort: document.querySelector('#sortBy'),
  reset: document.querySelector('#resetDemo'),
  template: document.querySelector('#jobCardTemplate')
};

function getStatus(job) { return state.statuses[job.id] || 'new'; }
function setStatus(id, status) {
  state.statuses[id] = status;
  localStorage.setItem('astrojob-statuses', JSON.stringify(state.statuses));
  render();
}

function formatSalary(job) {
  const s = job.salary || {};
  if (!Number.isFinite(s.monthlyGross) && !Number.isFinite(s.annualGross)) return 'Salary: not disclosed';
  const parts = [];
  const currency = s.currency || '';
  if (Number.isFinite(s.monthlyGross)) parts.push(`${s.monthlyGross.toLocaleString()} ${currency} gross / month`);
  if (Number.isFinite(s.annualGross)) parts.push(`${s.annualGross.toLocaleString()} ${currency} gross / year`);
  return `Salary: ${parts.join(' · ')}`;
}

function recommendationLabel(result) {
  const labels = { APPLY_NOW: '🔥 APPLY NOW', APPLY: 'APPLY', STRETCH: 'STRETCH', MAYBE: 'MAYBE', REJECT: 'REJECT' };
  return labels[result.decision] || result.decision;
}

function enrich(job, i) {
  const scored = scoreJob(job);
  return {
    ...job,
    foundAt: job.foundAt || new Date(Date.now() - i * 86400000).toISOString(),
    url: job.url || '#',
    score: scored
  };
}

function renderTabs() {
  els.tabs.innerHTML = '';
  for (const [key, label] of Object.entries(STATUS_LABELS)) {
    const count = key === 'all' ? state.jobs.length : state.jobs.filter(j => getStatus(j) === key).length;
    const btn = document.createElement('button');
    btn.className = `tab ${state.status === key ? 'active' : ''}`;
    btn.textContent = `${label} ${count}`;
    btn.addEventListener('click', () => { state.status = key; render(); });
    els.tabs.appendChild(btn);
  }
}

function renderStats() {
  const actionable = state.jobs.filter(j => ['APPLY_NOW','APPLY','STRETCH'].includes(j.score.decision)).length;
  const hot = state.jobs.filter(j => j.score.priority >= 85).length;
  const applied = state.jobs.filter(j => getStatus(j) === 'applied').length;
  const interviews = state.jobs.filter(j => getStatus(j) === 'interview').length;
  const items = [['Actionable matches', actionable], ['🔥 Top priority', hot], ['Applied', applied], ['Interviews', interviews]];
  els.stats.innerHTML = items.map(([label,value]) => `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
}

function renderCountries() {
  const countries = [...new Set(state.jobs.map(j => j.country).filter(Boolean))].sort();
  els.country.innerHTML = '<option value="all">All countries</option>' + countries.map(c => `<option value="${c}">${c}</option>`).join('');
  els.country.value = state.country;
}

function filteredJobs() {
  const q = state.query.trim().toLowerCase();
  return state.jobs
    .filter(j => state.status === 'all' || getStatus(j) === state.status)
    .filter(j => state.decision === 'all' || j.score.decision === state.decision)
    .filter(j => state.country === 'all' || j.country === state.country)
    .filter(j => !q || [j.title,j.company,j.city,j.country,j.description].some(v => String(v || '').toLowerCase().includes(q)))
    .sort((a,b) => {
      if (state.sort === 'fit') return b.score.fit - a.score.fit;
      if (state.sort === 'newest') return new Date(b.foundAt) - new Date(a.foundAt);
      return b.score.priority - a.score.priority;
    });
}

function renderCard(job) {
  const node = els.template.content.cloneNode(true);
  const card = node.querySelector('.job-card');
  const badge = node.querySelector('.priority-badge');
  const taxonomy = node.querySelector('.taxonomy-badge');
  const meta = [job.city, job.country, job.workModel].filter(Boolean).join(' · ');

  node.querySelector('.job-company').textContent = job.company || 'Unknown company';
  node.querySelector('.job-title').textContent = job.title;
  node.querySelector('.job-meta').textContent = meta;
  badge.textContent = recommendationLabel(job.score);
  if (taxonomy) taxonomy.textContent = job.score.taxonomy || '☄️ Wild Card';
  if (job.score.priority >= 85 && job.score.decision !== 'REJECT') badge.classList.add('hot');
  if (job.score.decision === 'REJECT') badge.classList.add('reject');

  node.querySelector('.fit-score').textContent = `${job.score.fit}%`;
  node.querySelector('.desirability-score').textContent = `${job.score.desirability}%`;
  node.querySelector('.priority-score').textContent = `${job.score.priority}%`;
  node.querySelector('.salary-row').textContent = formatSalary(job);

  const flags = node.querySelector('.flags');
  (job.score.flags || []).forEach(flag => {
    const span = document.createElement('span'); span.className = 'flag'; span.textContent = flag; flags.appendChild(span);
  });
  if (job.score.hardReject) {
    const span = document.createElement('span'); span.className = 'flag'; span.textContent = job.score.hardReject; flags.appendChild(span);
  }

  const intel = job.score.intelligence || {};
  const pct = v => Number.isFinite(v) ? v + '%' : '—';
  node.querySelector('.tech-fit').textContent = pct(intel.techFit);
  node.querySelector('.role-fit').textContent = pct(intel.roleFit);
  node.querySelector('.seniority-fit').textContent = pct(intel.seniorityFit);
  node.querySelector('.language-fit').textContent = pct(intel.languageFit);

  const badgeList = (selector, items, type) => {
    const box = node.querySelector(selector);
    if (!items?.length) { box.innerHTML = '<span class="intel-empty">None detected</span>'; return; }
    items.forEach(item => {
      const span = document.createElement('span');
      span.className = 'intel-badge ' + type;
      span.textContent = item;
      box.appendChild(span);
    });
  };

  const techBox = node.querySelector('.tech-badges');
  const techItems = [
    ...(intel.matchedTech || []).map(x => [x,'match']),
    ...(intel.learningTech || []).map(x => [x + ' · learning','learning']),
    ...(intel.transferableTech || []).map(x => [x + ' · transferable','transfer']),
    ...(intel.techGaps || []).map(x => [x + ' · review','gap'])
  ];
  if (!techItems.length) techBox.innerHTML = '<span class="intel-empty">No named systems detected</span>';
  else techItems.forEach(([label,type]) => {
    const span = document.createElement('span');
    span.className = 'intel-badge ' + type;
    span.textContent = label;
    techBox.appendChild(span);
  });

  badgeList('.matched-badges', intel.matchedSkills, 'match');
  const langItems = (intel.mentionedLanguages || []).map(x => {
    const label = x.charAt(0).toUpperCase() + x.slice(1);
    return (intel.knownLanguages || []).includes(x) ? label : label + ' · missing';
  });
  badgeList('.language-badges', langItems, 'match');
  badgeList('.experience-badges', intel.mentionedExperience, 'transfer');
  badgeList('.gap-badges', intel.gaps, 'gap');

  const reasons = node.querySelector('.reasons-list');
  const reasonItems = job.score.reasons?.length ? job.score.reasons : ['Passed hard filters; no strong positive signal detected yet.'];
  reasonItems.forEach(r => { const li = document.createElement('li'); li.textContent = r; reasons.appendChild(li); });

  const gaps = node.querySelector('.gaps-list');
  const gapItems = job.score.gaps?.length ? job.score.gaps : ['No major keyword-level gaps flagged.'];
  gapItems.forEach(g => { const li = document.createElement('li'); li.textContent = g; gaps.appendChild(li); });

  const link = node.querySelector('.apply-link');
  link.href = job.url || '#';
  if (!job.url || job.url === '#') { link.classList.add('disabled'); link.textContent = 'No link in demo'; }

  const select = node.querySelector('.status-select');
  select.value = getStatus(job);
  select.addEventListener('change', e => setStatus(job.id, e.target.value));
  card.dataset.id = job.id;
  return node;
}

function render() {
  renderTabs();
  renderStats();
  const jobs = filteredJobs();
  els.grid.innerHTML = '';
  jobs.forEach(job => els.grid.appendChild(renderCard(job)));
  els.empty.hidden = jobs.length > 0;
}

async function init() {
  const res = await fetch('./data/sample-jobs.json');
  const jobs = await res.json();
  state.jobs = jobs.map(enrich);
  renderCountries();
  render();
}

els.search.addEventListener('input', e => { state.query = e.target.value; render(); });
els.decision.addEventListener('change', e => { state.decision = e.target.value; render(); });
els.country.addEventListener('change', e => { state.country = e.target.value; render(); });
els.sort.addEventListener('change', e => { state.sort = e.target.value; render(); });
els.reset.addEventListener('click', () => {
  localStorage.removeItem('astrojob-statuses'); state.statuses = {}; state.status = 'new'; state.query=''; state.decision='all'; state.country='all'; state.sort='priority';
  els.search.value=''; els.decision.value='all'; els.sort.value='priority'; renderCountries(); render();
});

init().catch(err => {
  els.empty.hidden = false;
  els.empty.textContent = `Could not load jobs: ${err.message}. Run this folder through GitHub Pages or a local web server.`;
});