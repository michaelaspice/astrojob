import { scoreJob } from './scoring.js';
import { MIHAELA_PROFILE } from './profile.js';

const DEMO_STORAGE='astrojob-demo-mirror-v1';
const DEMO_USER={id:'demo-user'};
const readStore=()=>{try{return JSON.parse(localStorage.getItem(DEMO_STORAGE))||{astrojob_jobs:[],astrojob_profiles:[],astrojob_memory_core:[]}}catch{return{astrojob_jobs:[],astrojob_profiles:[],astrojob_memory_core:[]}}};
const writeStore=s=>localStorage.setItem(DEMO_STORAGE,JSON.stringify(s));
const uuid=()=>crypto.randomUUID?crypto.randomUUID():'demo-'+Date.now()+'-'+Math.random().toString(16).slice(2);

class LocalQuery{
  constructor(table){this.table=table;this.action='select';this.payload=null;this.filters=[];this.orderBy=null;this.returning=false;this.conflict=null}
  select(){this.returning=true;return this}
  insert(v){this.action='insert';this.payload=Array.isArray(v)?v:[v];return this}
  update(v){this.action='update';this.payload=v;return this}
  upsert(v,opts={}){this.action='upsert';this.payload=Array.isArray(v)?v:[v];this.conflict=opts.onConflict||null;return this}
  delete(){this.action='delete';return this}
  eq(k,v){this.filters.push([k,v]);return this}
  order(k,opts={}){this.orderBy=[k,!!opts.ascending];return this}
  _matches(r){return this.filters.every(([k,v])=>r?.[k]===v)}
  _run(){
    const s=readStore();let rows=s[this.table]||[];let data=null;
    if(this.action==='select'){
      data=rows.filter(r=>this._matches(r)).map(r=>structuredClone(r));
      if(this.orderBy){const[k,asc]=this.orderBy;data.sort((a,b)=>{const av=a?.[k]??'',bv=b?.[k]??'';return(asc?1:-1)*String(av).localeCompare(String(bv))})}
    }else if(this.action==='insert'){
      const now=new Date().toISOString();
      const made=this.payload.map(v=>({...structuredClone(v),id:v.id||uuid(),created_at:v.created_at||now,updated_at:v.updated_at||now}));
      rows.push(...made);s[this.table]=rows;writeStore(s);data=made;
    }else if(this.action==='update'){
      const now=new Date().toISOString();const changed=[];
      rows=rows.map(r=>this._matches(r)?Object.assign({},r,structuredClone(this.payload),{updated_at:this.payload.updated_at||now}):r);
      changed.push(...rows.filter(r=>this._matches(r)));s[this.table]=rows;writeStore(s);data=changed;
    }else if(this.action==='delete'){
      const removed=rows.filter(r=>this._matches(r));rows=rows.filter(r=>!this._matches(r));s[this.table]=rows;writeStore(s);data=removed;
    }else if(this.action==='upsert'){
      const now=new Date().toISOString();const out=[];
      for(const v0 of this.payload){const v=structuredClone(v0);let i=-1;if(this.conflict)i=rows.findIndex(r=>r?.[this.conflict]===v?.[this.conflict]);if(i<0&&v.id)i=rows.findIndex(r=>r.id===v.id);if(i>=0){rows[i]={...rows[i],...v,updated_at:v.updated_at||now};out.push(rows[i])}else{const row={...v,id:v.id||uuid(),created_at:v.created_at||now,updated_at:v.updated_at||now};rows.push(row);out.push(row)}}s[this.table]=rows;writeStore(s);data=out;
    }
    return{data,error:null};
  }
  single(){const r=this._run();return Promise.resolve({data:Array.isArray(r.data)?r.data[0]||null:r.data,error:r.error})}
  maybeSingle(){return this.single()}
  then(resolve,reject){return Promise.resolve(this._run()).then(resolve,reject)}
}
const supabase={
  from:table=>new LocalQuery(table),
  auth:{
    signOut:async()=>({error:null}),
    getSession:async()=>({data:{session:{user:DEMO_USER}}}),
    onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
  }
};

const STATUS_LABELS={all:'All',new:'New Matches',saved:'Saved',applied:'Applied',screening:'Screening',interview:'Interview',offer:'Offer',signed:'Signed',rejected:'Rejected / Skipped',withdrawn:'Withdrawn',archived:'Archived'};
const state={jobs:[],status:'all',query:'',decision:'all',country:'all',sort:'priority',view:'board',user:null,profile:structuredClone(MIHAELA_PROFILE),memoryInsights:[]};
const $=s=>document.querySelector(s);
const els={authGate:$('#authGate'),appRoot:$('#appRoot'),authForm:$('#authForm'),authEmail:$('#authEmail'),authPassword:$('#authPassword'),authMessage:$('#authMessage'),signUp:$('#signUpButton'),signOut:$('#signOutButton'),grid:$('#jobsGrid'),empty:$('#emptyState'),stats:$('#stats'),tabs:$('#tabs'),search:$('#searchInput'),decision:$('#decisionFilter'),country:$('#countryFilter'),sort:$('#sortBy'),template:$('#jobCardTemplate'),add:$('#addJobButton'),emptyAdd:$('#emptyAddButton'),loadDemo:$('#loadDemoButton'),export:$('#exportButton'),import:$('#importButton'),importFile:$('#importFile'),dialog:$('#jobDialog'),form:$('#jobForm'),close:$('#closeDialog'),cancel:$('#cancelDialog'),deleteBtn:$('#deleteJobButton'),dialogTitle:$('#dialogTitle'),dialogScore:$('#dialogScore'),importUrl:$('#importJobUrl'),importStatus:$('#importJobStatus'),profileButton:$('#profileButton'),profileDialog:$('#profileDialog'),profileForm:$('#profileForm'),closeProfile:$('#closeProfileDialog'),cancelProfile:$('#cancelProfileDialog'),resetProfile:$('#resetProfileButton'),insightDialog:$('#insightDialog'),insightForm:$('#insightForm'),insightJobId:$('#insightJobId'),insightText:$('#insightText'),insightHistory:$('#insightHistory'),closeInsight:$('#closeInsightDialog'),cancelInsight:$('#cancelInsightDialog'),settingsButton:$('#settingsButton'),settingsDialog:$('#settingsDialog'),closeSettings:$('#closeSettingsDialog'),jobAgentImport:$('#jobAgentImportButton'),jobAgentFile:$('#jobAgentFile'),jobAgentStatus:$('#jobAgentImportStatus'),viewSwitch:$('#viewSwitch'),pipeline:$('#pipelineView'),jobDetailDialog:$('#jobDetailDialog'),jobDetailContent:$('#jobDetailContent'),closeJobDetail:$('#closeJobDetailDialog'),matchLegendButton:$('#matchLegendButton'),matchLegendDialog:$('#matchLegendDialog'),closeMatchLegend:$('#closeMatchLegendDialog'),boardViewButton:$('#boardViewButton'),pipelineViewButton:$('#pipelineViewButton')};
const fields={id:$('#jobId'),url:$('#jobUrl'),title:$('#jobTitle'),company:$('#jobCompany'),country:$('#jobCountry'),city:$('#jobCity'),workModel:$('#jobWorkModel'),postedAt:$('#jobPostedAt'),renewedAt:$('#jobRenewedAt'),currency:$('#jobCurrency'),monthly:$('#jobMonthly'),annual:$('#jobAnnual'),interest:$('#jobInterest'),nextAction:$('#jobNextAction'),languages:$('#jobLanguages'),description:$('#jobDescription'),notes:$('#jobNotes')};
const profileFields={
  roleFamilies:$('#profileRoleFamilies'),strongSignals:$('#profileStrongSignals'),languages:$('#profileLanguages'),
  experienceYears:$('#profileExperienceYears'),skills:$('#profileSkills'),hardTech:$('#profileHardTech'),
  freshness:$('#profileFreshness'),polandMonthly:$('#profilePolandMonthly'),polandAnnual:$('#profilePolandAnnual'),
  greeceMonthly:$('#profileGreeceMonthly'),greeceAnnual:$('#profileGreeceAnnual'),emeaAnnual:$('#profileEmeaAnnual')
};
const listToText=a=>(a||[]).join(', ');
const textToList=v=>String(v||'').split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
const cloneDefaultProfile=()=>structuredClone(MIHAELA_PROFILE);

function fillProfileForm(){
  const p=state.profile;
  profileFields.roleFamilies.value=listToText(p.roleFamilies);
  profileFields.strongSignals.value=listToText(p.strongSignals);
  profileFields.languages.value=listToText(p.languages);
  profileFields.experienceYears.value=p.relevantExperienceYears??7;
  profileFields.skills.value=listToText(p.profileSkills);
  profileFields.hardTech.value=listToText(p.hardTechnicalRejects);
  profileFields.freshness.value=p.freshness?.maxAgeDays??21;
  profileFields.polandMonthly.value=p.salaryRules?.Poland?.monthlyGrossMin??10000;
  profileFields.polandAnnual.value=p.salaryRules?.Poland?.annualGrossMin??120000;
  profileFields.greeceMonthly.value=p.salaryRules?.Greece?.monthlyGrossMin??2400;
  profileFields.greeceAnnual.value=p.salaryRules?.Greece?.annualGrossMin??28000;
  profileFields.emeaAnnual.value=p.salaryRules?.RestOfEMEA?.annualGrossMin??30000;
}
function profileFromForm(){
  const p=cloneDefaultProfile();
  p.roleFamilies=textToList(profileFields.roleFamilies.value).map(x=>x.toLowerCase());
  p.strongSignals=textToList(profileFields.strongSignals.value).map(x=>x.toLowerCase());
  p.languages=textToList(profileFields.languages.value).map(x=>x.toLowerCase());
  p.relevantExperienceYears=Number(profileFields.experienceYears.value)||0;
  p.profileSkills=textToList(profileFields.skills.value).map(x=>x.toLowerCase());
  p.hardTechnicalRejects=textToList(profileFields.hardTech.value).map(x=>x.toLowerCase());
  p.freshness.maxAgeDays=Number(profileFields.freshness.value)||21;
  p.salaryRules.Poland.monthlyGrossMin=Number(profileFields.polandMonthly.value)||0;
  p.salaryRules.Poland.annualGrossMin=Number(profileFields.polandAnnual.value)||0;
  p.salaryRules.Greece.monthlyGrossMin=Number(profileFields.greeceMonthly.value)||0;
  p.salaryRules.Greece.annualGrossMin=Number(profileFields.greeceAnnual.value)||0;
  p.salaryRules.RestOfEMEA.annualGrossMin=Number(profileFields.emeaAnnual.value)||0;
  return p;
}
async function loadProfile(){
  if(!state.user)return;
  const {data,error}=await supabase.from('astrojob_profiles').select('profile').eq('user_id',state.user.id).maybeSingle();
  if(error){console.warn('Could not load profile',error.message);state.profile=cloneDefaultProfile();return}
  state.profile=data?.profile&&Object.keys(data.profile).length?{...cloneDefaultProfile(),...data.profile,salaryRules:{...cloneDefaultProfile().salaryRules,...(data.profile.salaryRules||{})},freshness:{...cloneDefaultProfile().freshness,...(data.profile.freshness||{})}}:cloneDefaultProfile();
}
async function saveProfile(profile){
  const {error}=await supabase.from('astrojob_profiles').upsert({user_id:state.user.id,profile,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error)throw error;
  state.profile={...profile,memoryInsights:state.memoryInsights.map(x=>x.insight)};
  rescoreAll();
  render();
}

const toDate=v=>v?String(v).slice(0,10):'';
const n=v=>v===''?null:Number(v);
const enrich=j=>({...j,status:j.status||'new',score:scoreJob(j,state.profile)});
const fromRow=r=>enrich({id:r.id,title:r.title,company:r.company,country:r.country,city:r.city||'',workModel:r.work_model||'',url:r.url||'#',postedAt:r.posted_at,renewedAt:r.renewed_at,salary:{currency:r.salary_currency||'',monthlyGross:r.salary_monthly_gross==null?null:Number(r.salary_monthly_gross),annualGross:r.salary_annual_gross==null?null:Number(r.salary_annual_gross)},languages:r.languages||[],description:r.description||'',notes:r.notes||'',interest:r.interest||'positive',nextActionAt:r.next_action_at,status:r.status||'new',foundAt:r.found_at,createdAt:r.created_at,updatedAt:r.updated_at});
const toRow=j=>({user_id:state.user.id,title:j.title,company:j.company,country:j.country,city:j.city||null,work_model:j.workModel||null,url:j.url==='#'?null:j.url,posted_at:toDate(j.postedAt)||null,renewed_at:toDate(j.renewedAt)||null,salary_currency:j.salary?.currency||null,salary_monthly_gross:Number.isFinite(j.salary?.monthlyGross)?j.salary.monthlyGross:null,salary_annual_gross:Number.isFinite(j.salary?.annualGross)?j.salary.annualGross:null,languages:j.languages||[],description:j.description||null,notes:j.notes||null,interest:j.interest||'positive',next_action_at:toDate(j.nextActionAt)||null,status:j.status||'new',found_at:j.foundAt||new Date().toISOString(),updated_at:new Date().toISOString()});

async function loadMemoryCore(){
  if(!state.user)return;
  const {data,error}=await supabase.from('astrojob_memory_core').select('*').eq('user_id',state.user.id).order('created_at',{ascending:true});
  if(error){console.warn('Could not load Memory Core',error.message);state.memoryInsights=[]}
  else state.memoryInsights=data||[];
  state.profile.memoryInsights=state.memoryInsights.map(x=>x.insight);
}
function rescoreAll(){
  state.jobs=state.jobs.map(j=>({...j,score:scoreJob(j,state.profile)}));
}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderInsightHistory(jobId){
  const items=state.memoryInsights.filter(x=>x.source_job_id===jobId);
  els.insightHistory.innerHTML=items.length
    ? '<div class="insight-history-title">Insights already saved from this job</div>'+items.map(x=>'<div class="memory-item"><span>'+escapeHtml(x.insight)+'</span><button type="button" class="memory-delete" data-id="'+x.id+'" aria-label="Delete insight">×</button></div>').join('')
    : '';
  els.insightHistory.querySelectorAll('.memory-delete').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.id;
    const {error}=await supabase.from('astrojob_memory_core').delete().eq('id',id);
    if(error)return alert('Could not delete insight: '+error.message);
    state.memoryInsights=state.memoryInsights.filter(x=>x.id!==id);
    state.profile.memoryInsights=state.memoryInsights.map(x=>x.insight);
    rescoreAll();render();renderInsightHistory(jobId);
  });
}
function openInsightDialog(jobId){
  els.insightJobId.value=jobId;
  els.insightText.value='';
  renderInsightHistory(jobId);
  els.insightDialog.showModal();
}

function msg(t,type=''){els.authMessage.textContent=t;els.authMessage.className='auth-message '+type}
async function loadJobs(){const{data,error}=await supabase.from('astrojob_jobs').select('*').order('created_at',{ascending:false});if(error){alert('Could not load jobs: '+error.message);return}state.jobs=(data||[]).map(fromRow);renderCountries();render()}
async function enter(session){
  if(!session?.user) return;
  state.user=session.user;
  await loadProfile();
  await loadMemoryCore();
  els.authGate.hidden=true;
  els.authGate.style.display='none';
  els.appRoot.hidden=false;
  els.appRoot.style.display='block';
  try{await loadJobs()}catch(err){console.error(err);alert('Signed in, but AstroJob could not finish loading: '+err.message)}
}
function leave(){state.user=null;state.jobs=[];state.memoryInsights=[];els.appRoot.hidden=true;els.appRoot.style.display='none';els.authGate.hidden=false;els.authGate.style.display='grid'}
els.authForm?.addEventListener('submit',async e=>{e.preventDefault();msg('Signing in…');const{data,error}=await supabase.auth.signInWithPassword({email:els.authEmail.value.trim(),password:els.authPassword.value});if(error)return msg(error.message,'error');if(!data?.session)return msg('Sign-in succeeded but no session was returned. Please refresh and try again.','error');msg('Welcome back. Loading Mission Control…','success');await enter(data.session)});
els.signUp?.addEventListener('click',async()=>{const email=els.authEmail.value.trim(),password=els.authPassword.value;if(!email||password.length<6)return msg('Enter your email and a password of at least 6 characters.','error');msg('Creating your account…');const{data,error}=await supabase.auth.signUp({email,password});if(error)return msg(error.message,'error');if(data.session){msg('Account created.','success');await enter(data.session)}else msg('Account created. Check your email to confirm it, then sign in.','success')});
els.signOut.addEventListener('click',()=>{if(confirm('Reset the demo to its original sample jobs?')){localStorage.removeItem(DEMO_STORAGE);location.reload()}});

async function saveWithdrawalReason(id,value){
 const job=state.jobs.find(j=>j.id===id);if(!job)return;
 const reason=String(value||'').trim();
 const old=job.withdrawalReason||'';
 job.withdrawalReason=reason;
 const notesBase=String(job.notes||'').replace(/\n?Withdrawal reason:.*$/m,'').trim();
 const notes=reason?[notesBase,'Withdrawal reason: '+reason].filter(Boolean).join('\n'):notesBase;
 job.notes=notes;
 const{error}=await supabase.from('astrojob_jobs').update({notes,updated_at:new Date().toISOString()}).eq('id',id);
 if(error){job.withdrawalReason=old;alert(error.message)}
}
async function setStatus(id,status){const job=state.jobs.find(j=>j.id===id);if(!job)return;const old=job.status;job.status=status;render();const{error}=await supabase.from('astrojob_jobs').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(error){job.status=old;render();alert(error.message)}}
function salary(j){const s=j.salary||{};if(!Number.isFinite(s.monthlyGross)&&!Number.isFinite(s.annualGross))return'Salary: not disclosed';const p=[],c=s.currency||'';if(Number.isFinite(s.monthlyGross))p.push(`${s.monthlyGross.toLocaleString()} ${c} gross / month`);if(Number.isFinite(s.annualGross))p.push(`${s.annualGross.toLocaleString()} ${c} gross / year`);return'Salary: '+p.join(' · ')}
function rec(r){return({APPLY_NOW:'🔥 APPLY NOW',APPLY:'APPLY',STRETCH:'STRETCH',MAYBE:'MAYBE',REJECT:'REJECT'})[r.decision]||r.decision}
function interest(v){return({love:'💗 Love this',positive:'✨ Interested',neutral:'Neutral',low:'Not excited'})[v]||''}
function renderTabs(){els.tabs.innerHTML='';for(const[k,l]of Object.entries(STATUS_LABELS)){const count=k==='all'?state.jobs.length:state.jobs.filter(j=>j.status===k).length,b=document.createElement('button');b.className='tab '+(state.status===k?'active':'');b.textContent=`${l} ${count}`;b.onclick=()=>{state.status=k;render()};els.tabs.appendChild(b)}}
function renderStats(){const a=state.jobs.filter(j=>['APPLY_NOW','APPLY','STRETCH'].includes(j.score.decision)&&!['rejected','withdrawn'].includes(j.status)).length,active=state.jobs.filter(j=>['applied','screening','interview'].includes(j.status)).length,interviews=state.jobs.filter(j=>j.status==='interview').length,o=state.jobs.filter(j=>['offer','signed'].includes(j.status)).length;els.stats.innerHTML=[['Actionable matches',a],['Active applications',active],['Interviews',interviews],['Offers',o]].map(([l,v])=>`<div class="stat"><span>${l}</span><strong>${v}</strong></div>`).join('')}
function renderCountries(){const prev=state.country,c=[...new Set(state.jobs.map(j=>j.country).filter(Boolean))].sort();els.country.innerHTML='<option value="all">All countries</option>'+c.map(x=>`<option>${x}</option>`).join('');state.country=c.includes(prev)?prev:'all';els.country.value=state.country}
function filtered(){const q=state.query.trim().toLowerCase();return[...state.jobs].filter(j=>state.status==='all'||j.status===state.status).filter(j=>state.decision==='all'||j.score.decision===state.decision).filter(j=>state.country==='all'||j.country===state.country).filter(j=>!q||[j.title,j.company,j.city,j.country,j.description,j.notes].some(v=>String(v||'').toLowerCase().includes(q))).sort((a,b)=>state.sort==='fit'?b.score.fit-a.score.fit:state.sort==='newest'?new Date(b.foundAt||0)-new Date(a.foundAt||0):b.score.priority-a.score.priority)}
function openJobDetail(jobId){
  const job=state.jobs.find(j=>j.id===jobId);
  if(!job)return;
  els.jobDetailContent.innerHTML='';
  const frag=card(job);
  const article=frag.querySelector('.job-card');
  if(!article)return;
  article.classList.add('expanded-card');
  article.querySelector('.expand-job')?.remove();
  els.jobDetailContent.appendChild(article);
  els.jobDetailDialog.showModal();
}

function card(job){const node=els.template.content.cloneNode(true),badge=node.querySelector('.priority-badge'),tax=node.querySelector('.taxonomy-badge');node.querySelector('.job-company').textContent=job.company||'Unknown company';node.querySelector('.job-title').textContent=job.title||'Untitled role';node.querySelector('.job-meta').textContent=[job.city,job.country,job.workModel].filter(Boolean).join(' · ');badge.textContent=rec(job.score);
const rawTaxonomy=String(job.score.taxonomy||'Wild Card').replace(/[🌟🚀🪐☄️🕳️⭐✨🔥]/gu,'').trim();
const taxonomyName=/^Core(?:\s+Match)?$/i.test(rawTaxonomy)?'Core Match':
  /^Transferable(?:\s+Match)?$/i.test(rawTaxonomy)?'Transferable':
  /^Stretch(?:\s+Match)?$/i.test(rawTaxonomy)?'Stretch':
  /^Wild(?:\s+Card)?$/i.test(rawTaxonomy)?'Wild Card':
  /^Black(?:\s+Hole)?$/i.test(rawTaxonomy)?'Black Hole':rawTaxonomy;
const taxonomyKey=taxonomyName.toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
tax.innerHTML='<span class="taxonomy-icon '+taxonomyKey+'" aria-hidden="true"></span><span>'+escapeHtml(taxonomyName)+'</span>';
tax.classList.add('taxonomy-'+taxonomyKey);if(job.score.priority>=85&&job.score.decision!=='REJECT')badge.classList.add('hot');if(job.score.decision==='REJECT')badge.classList.add('reject');node.querySelector('.fit-score').textContent=job.score.fit+'%';node.querySelector('.desirability-score').textContent=job.score.desirability+'%';node.querySelector('.priority-score').textContent=job.score.priority+'%';node.querySelector('.salary-row').textContent=salary(job);const flags=node.querySelector('.flags');[...(job.score.flags||[]),...(job.score.hardReject?[job.score.hardReject]:[])].forEach(f=>{const s=document.createElement('span');s.className='flag';s.textContent=f;flags.appendChild(s)});if(job.interest){const s=document.createElement('span');s.className='flag';s.textContent=interest(job.interest);flags.appendChild(s)}if(job.nextActionAt){const s=document.createElement('span');s.className='flag';s.textContent='Next: '+new Date(job.nextActionAt+'T12:00:00').toLocaleDateString();flags.appendChild(s)}const reasons=node.querySelector('.reasons-list');(job.score.reasons?.length?job.score.reasons:['Passed hard filters; no strong positive signal detected yet.']).forEach(x=>{const li=document.createElement('li');li.textContent=x;reasons.appendChild(li)});const gaps=node.querySelector('.gaps-list');(job.score.gaps?.length?job.score.gaps:['No major keyword-level gaps flagged.']).forEach(x=>{const li=document.createElement('li');li.textContent=x;gaps.appendChild(li)});const intel=job.score.intelligence||{};const pct=(v)=>Number.isFinite(v)?v+'%':'—';node.querySelector('.tech-fit').textContent=pct(intel.techFit);node.querySelector('.role-fit').textContent=pct(intel.roleFit);node.querySelector('.seniority-fit').textContent=pct(intel.seniorityFit);node.querySelector('.language-fit').textContent=pct(intel.languageFit);
 const badgeList=(sel,items,type)=>{const box=node.querySelector(sel);if(!items?.length){box.innerHTML='<span class="intel-empty">None detected</span>';return}items.forEach(x=>{const b=document.createElement('span');b.className='intel-badge '+type;b.textContent=x;box.appendChild(b)})};
 const tb=node.querySelector('.tech-badges'),tech=[...(intel.matchedTech||[]).map(x=>[x,'match']),...(intel.learningTech||[]).map(x=>[x+' · learning','learning']),...(intel.transferableTech||[]).map(x=>[x+' · transferable','transfer']),...(intel.techGaps||[]).map(x=>[x+' · review','gap'])];if(!tech.length)tb.innerHTML='<span class="intel-empty">No named systems detected</span>';else tech.forEach(([x,t])=>{const b=document.createElement('span');b.className='intel-badge '+t;b.textContent=x;tb.appendChild(b)});
 badgeList('.matched-badges',intel.matchedSkills,'match');
 const langItems=(intel.mentionedLanguages||[]).map(x=>(intel.knownLanguages||[]).includes(x)?x[0].toUpperCase()+x.slice(1):x[0].toUpperCase()+x.slice(1)+' · missing');
 badgeList('.language-badges',langItems,'match');
 const expItems=intel.mentionedExperience||[];
 badgeList('.experience-badges',expItems,'transfer');
 badgeList('.gap-badges',intel.gaps,'gap');
 const p=node.querySelector('.job-notes-preview');if(job.notes)p.textContent=job.notes.length>180?job.notes.slice(0,180)+'…':job.notes;const link=node.querySelector('.apply-link');link.href=job.url||'#';if(!job.url||job.url==='#'){link.classList.add('disabled');link.textContent='No job link';link.removeAttribute('target')}node.querySelector('.expand-job').onclick=()=>openJobDetail(job.id);node.querySelector('.open-job').onclick=()=>openDialog(job.id);node.querySelector('.insight-job')?.addEventListener('click',()=>openInsightDialog(job.id));const sel=node.querySelector('.status-select'),withdrawal=node.querySelector('.withdrawal-reason');
sel.value=job.status||'new';
withdrawal.value=job.withdrawalReason||'';
withdrawal.hidden=sel.value!=='withdrawn';
sel.onchange=e=>{withdrawal.hidden=e.target.value!=='withdrawn';setStatus(job.id,e.target.value)};
withdrawal.onchange=e=>saveWithdrawalReason(job.id,e.target.value);
return node}

const PIPELINE_COLUMNS=[
  {key:'savedprep',label:'Saved / Prep',statuses:['new','saved']},
  {key:'applied',label:'Applied',statuses:['applied']},
  {key:'screening',label:'Screening',statuses:['screening']},
  {key:'interview',label:'Interview',statuses:['interview']},
  {key:'offer',label:'Offered',statuses:['offer']},
  {key:'signed',label:'Signed',statuses:['signed']},
  {key:'rejected',label:'Rejected / Skipped',statuses:['rejected']},
  {key:'withdrawn',label:'Withdrawn',statuses:['withdrawn']},
  {key:'archived',label:'Archived',statuses:['archived']}
];

function pipelineCard(job,col){
  const el=document.createElement('article');
  el.className='pipeline-card';
  el.draggable=true;
  el.dataset.jobId=job.id;
  const fit=Number.isFinite(job.score?.fit)?job.score.fit:null;
  const date=job.updatedAt||job.createdAt||job.foundAt;
  const location=[job.city,job.country,job.workModel].filter(Boolean).join(' · ')||'Location not set';
  const statusLabel=STATUS_LABELS[job.status]||'Saved';
  el.innerHTML=
    '<button type="button" class="pipeline-open" aria-label="Open job">'+
      '<strong>'+escapeHtml(job.company||'Unknown company')+'</strong>'+
      '<span class="pipeline-role">'+escapeHtml(job.title||'Untitled role')+'</span>'+
      '<span class="pipeline-location">⌖ '+escapeHtml(location)+'</span>'+
      '<div class="pipeline-fit"><i style="width:'+(fit??0)+'%"></i></div>'+
      '<div class="pipeline-meta"><small>'+(fit==null?'Fit —':'Fit '+fit+'%')+'</small>'+(date?'<time>'+new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric'})+'</time>':'')+'</div>'+
      '<span class="pipeline-status status-'+(job.status||'saved')+'">'+escapeHtml(statusLabel)+'</span>'+
    '</button>';
  el.querySelector('.pipeline-open').onclick=()=>openJobDetail(job.id);
  el.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',job.id);e.dataTransfer.effectAllowed='move';el.classList.add('dragging')});
  el.addEventListener('dragend',()=>el.classList.remove('dragging'));
  return el;
}

function renderPipeline(){
  els.pipeline.innerHTML='';
  const header=document.createElement('div');
  header.className='pipeline-toolbar';
  header.innerHTML='<div><h2>Application Pipeline</h2><p>Track progress from saved roles to signed offers. Drag cards between stages to update status.</p></div>'+
    '<div class="pipeline-toolbar-actions"><select id="pipelineCountry"><option value="all">All countries</option></select><button type="button" class="button secondary" id="pipelineBoardButton">▦ View as Board</button></div>';
  els.pipeline.appendChild(header);
  const countrySelect=header.querySelector('#pipelineCountry');
  const countries=[...new Set(state.jobs.map(j=>j.country).filter(Boolean))].sort();
  countries.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;countrySelect.appendChild(o)});
  countrySelect.value=state.country||'all';
  countrySelect.onchange=e=>{state.country=e.target.value;renderPipeline()};
  header.querySelector('#pipelineBoardButton').onclick=()=>setView('board');

  const wrap=document.createElement('div');wrap.className='pipeline-board';
  for(const col of PIPELINE_COLUMNS){
    const jobs=state.jobs
      .filter(j=>col.statuses.includes(j.status||'new'))
      .filter(j=>state.country==='all'||j.country===state.country);
    const lane=document.createElement('section');lane.className='pipeline-lane lane-'+col.key;lane.dataset.status=col.statuses[0];
    lane.innerHTML='<div class="pipeline-lane-head"><span class="pipeline-lane-title"><i></i>'+col.label+'</span><strong>'+jobs.length+'</strong></div>';
    const cards=document.createElement('div');cards.className='pipeline-cards';
    if(!jobs.length){const empty=document.createElement('div');empty.className='pipeline-empty';empty.innerHTML='<span>◌</span><strong>No jobs here yet</strong><small>Move jobs here as their status changes.</small>';cards.appendChild(empty)}
    else jobs.sort((a,z)=>new Date(z.updatedAt||z.createdAt||0)-new Date(a.updatedAt||a.createdAt||0)).forEach(j=>cards.appendChild(pipelineCard(j,col)));
    lane.addEventListener('dragover',e=>{e.preventDefault();lane.classList.add('drag-over');e.dataTransfer.dropEffect='move'});
    lane.addEventListener('dragleave',()=>lane.classList.remove('drag-over'));
    lane.addEventListener('drop',async e=>{e.preventDefault();lane.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain');if(id)await setStatus(id,lane.dataset.status)});
    lane.appendChild(cards);wrap.appendChild(lane);
  }
  els.pipeline.appendChild(wrap);
}

function setView(view){
  state.view=view==='pipeline'?'pipeline':'board';
  const pipeline=state.view==='pipeline';
  els.pipeline.hidden=!pipeline;
  els.grid.hidden=pipeline;
  els.pipeline.style.display=pipeline?'block':'none';
  els.grid.style.display=pipeline?'none':'grid';
  els.empty.hidden=true;

  const controls=document.querySelector('.controls');
  controls.hidden=pipeline;
  controls.style.display=pipeline?'none':'grid';

  els.tabs.hidden=pipeline;
  els.tabs.style.display=pipeline?'none':'flex';

  els.stats.hidden=pipeline;
  els.stats.style.display=pipeline?'none':'grid';

  els.boardViewButton.classList.toggle('active',!pipeline);
  els.pipelineViewButton.classList.toggle('active',pipeline);
  document.body.classList.toggle('pipeline-mode',pipeline);

  if(pipeline){
    renderPipeline();
  }else{
    render();
  }
}

function render(){renderTabs();renderStats();if(state.view==='pipeline'){renderPipeline();return}const jobs=filtered();els.grid.innerHTML='';jobs.forEach(j=>els.grid.appendChild(card(j)));els.empty.hidden=jobs.length>0}

function blank(){Object.values(fields).forEach(el=>{if(el&&el.tagName!=='SELECT')el.value=''});fields.workModel.value='Remote';fields.interest.value='positive';fields.currency.value=''}
function fill(j){fields.id.value=j.id;fields.url.value=j.url||'';fields.title.value=j.title||'';fields.company.value=j.company||'';fields.country.value=j.country||'';fields.city.value=j.city||'';fields.workModel.value=j.workModel||'Remote';fields.postedAt.value=toDate(j.postedAt);fields.renewedAt.value=toDate(j.renewedAt);fields.currency.value=j.salary?.currency||'';fields.monthly.value=Number.isFinite(j.salary?.monthlyGross)?j.salary.monthlyGross:'';fields.annual.value=Number.isFinite(j.salary?.annualGross)?j.salary.annualGross:'';fields.interest.value=j.interest||'positive';fields.nextAction.value=toDate(j.nextActionAt);fields.languages.value=(j.languages||[]).join(', ');fields.description.value=j.description||'';fields.notes.value=j.notes||''}
function openDialog(id=null){blank();const j=id?state.jobs.find(x=>x.id===id):null;els.dialogTitle.textContent=j?'Edit job':'Add a job';els.deleteBtn.hidden=!j;if(j)fill(j);els.dialogScore.textContent=j?`${j.score.taxonomy} · Fit ${j.score.fit}% · Desirability ${j.score.desirability}% · Priority ${j.score.priority}% · ${rec(j.score)}`:'Fill in the role and AstroJob will score it when you save.';els.dialog.showModal()}
function closeDialog(){els.dialog.close()}
async function importFromUrl(){
  const url=fields.url.value.trim();
  if(!url){els.importStatus.textContent='Paste a job link first.';return}
  els.importStatus.textContent='Scanning job listing…';
  els.importUrl.disabled=true;
  try{
    const res=await fetch('https://astrojob-private.vercel.app/api/import-job',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});
    const raw=await res.text();
    let data={};
    try{data=raw?JSON.parse(raw):{}}catch{throw new Error(raw||('Server returned HTTP '+res.status))}
    if(!res.ok)throw new Error(data.error||('Import failed with HTTP '+res.status));
    const s=data.structured||{};
    if(s.title)fields.title.value=s.title;
    if(s.company)fields.company.value=s.company;
    if(s.country)fields.country.value=s.country;
    if(s.city)fields.city.value=s.city;
    if(s.workModel)fields.workModel.value=s.workModel;
    if(s.postedDate)fields.postedAt.value=String(s.postedDate).slice(0,10);
    if(s.salary){
      if(s.salary.currency)fields.currency.value=s.salary.currency;
      if(s.salary.period==='monthly'&&Number.isFinite(s.salary.min))fields.monthly.value=s.salary.min;
      if(s.salary.period==='annual'&&Number.isFinite(s.salary.min))fields.annual.value=s.salary.min;
    }
    const text=s.description||data.pageText||'';
    if(text)fields.description.value=text;
    els.importStatus.textContent=data.extraction==='json-ld'?'✓ Imported from structured job data. Review before saving.':'✓ Imported from page text. Review carefully before saving.';
  }catch(err){
    els.importStatus.textContent='Could not import automatically: '+err.message;
  }finally{els.importUrl.disabled=false}
}
els.importUrl?.addEventListener('click',importFromUrl);
function formJob(existing=null){const sal={};if(fields.currency.value)sal.currency=fields.currency.value;const m=n(fields.monthly.value),a=n(fields.annual.value);if(Number.isFinite(m))sal.monthlyGross=m;if(Number.isFinite(a))sal.annualGross=a;const now=new Date().toISOString();return{...(existing||{}),title:fields.title.value.trim(),company:fields.company.value.trim(),country:fields.country.value.trim(),city:fields.city.value.trim(),workModel:fields.workModel.value,url:fields.url.value.trim()||'#',postedAt:fields.postedAt.value||null,renewedAt:fields.renewedAt.value||null,salary:sal,languages:fields.languages.value.split(',').map(x=>x.trim()).filter(Boolean),description:fields.description.value.trim(),notes:fields.notes.value.trim(),interest:fields.interest.value,nextActionAt:fields.nextAction.value||null,status:existing?.status||'new',foundAt:existing?.foundAt||now,createdAt:existing?.createdAt||now,updatedAt:now}}
els.form.addEventListener('submit',async e=>{e.preventDefault();if(!fields.title.value.trim()||!fields.company.value.trim()||!fields.country.value.trim())return;const existing=state.jobs.find(j=>j.id===fields.id.value),j=formJob(existing);const q=existing?supabase.from('astrojob_jobs').update(toRow(j)).eq('id',existing.id).select().single():supabase.from('astrojob_jobs').insert(toRow(j)).select().single();const{data,error}=await q;if(error)return alert('Could not save job: '+error.message);const saved=fromRow(data);if(existing)state.jobs[state.jobs.findIndex(x=>x.id===existing.id)]=saved;else state.jobs.unshift(saved);renderCountries();state.status='all';render();closeDialog()});
els.deleteBtn.onclick=async()=>{const id=fields.id.value;if(!id||!confirm('Delete this job from AstroJob?'))return;const{error}=await supabase.from('astrojob_jobs').delete().eq('id',id);if(error)return alert(error.message);state.jobs=state.jobs.filter(j=>j.id!==id);renderCountries();render();closeDialog()};
els.matchLegendButton.onclick=()=>els.matchLegendDialog.showModal();
els.closeMatchLegend.onclick=()=>els.matchLegendDialog.close();
els.matchLegendDialog.onclick=e=>{if(e.target===els.matchLegendDialog)els.matchLegendDialog.close()};
els.settingsButton.onclick=()=>els.settingsDialog.showModal();
els.closeSettings.onclick=()=>els.settingsDialog.close();
els.settingsDialog.onclick=e=>{if(e.target===els.settingsDialog)els.settingsDialog.close()};
els.boardViewButton.onclick=()=>setView('board');
els.pipelineViewButton.onclick=()=>setView('pipeline');
els.closeJobDetail.onclick=()=>els.jobDetailDialog.close();
els.jobDetailDialog.onclick=e=>{if(e.target===els.jobDetailDialog)els.jobDetailDialog.close()};
els.profileButton.onclick=()=>{fillProfileForm();els.profileDialog.showModal()};
els.closeProfile.onclick=()=>els.profileDialog.close();
els.cancelProfile.onclick=()=>els.profileDialog.close();
els.resetProfile.onclick=()=>{state.profile=cloneDefaultProfile();fillProfileForm()};
els.profileDialog.onclick=e=>{if(e.target===els.profileDialog)els.profileDialog.close()};
els.profileForm.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    await saveProfile(profileFromForm());
    els.profileDialog.close();
  }catch(err){alert('Could not save profile: '+err.message)}
});
els.closeInsight.onclick=()=>els.insightDialog.close();
els.cancelInsight.onclick=()=>els.insightDialog.close();
els.insightDialog.onclick=e=>{if(e.target===els.insightDialog)els.insightDialog.close()};
els.insightForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const insight=els.insightText.value.trim(),jobId=els.insightJobId.value;
  if(!insight)return;
  const {data,error}=await supabase.from('astrojob_memory_core').insert({user_id:state.user.id,source_job_id:jobId||null,insight}).select().single();
  if(error)return alert('Could not save insight: '+error.message);
  state.memoryInsights.push(data);
  state.profile.memoryInsights=state.memoryInsights.map(x=>x.insight);
  rescoreAll();
  render();
  els.insightDialog.close();
});
els.add.onclick=()=>openDialog();els.emptyAdd.onclick=()=>openDialog();els.close.onclick=closeDialog;els.cancel.onclick=closeDialog;els.dialog.onclick=e=>{if(e.target===els.dialog)closeDialog()};els.search.oninput=e=>{state.query=e.target.value;render()};els.decision.onchange=e=>{state.decision=e.target.value;render()};els.country.onchange=e=>{state.country=e.target.value;render()};els.sort.onchange=e=>{state.sort=e.target.value;render()};
els.export.onclick=()=>{const payload=JSON.stringify({version:2,exportedAt:new Date().toISOString(),jobs:state.jobs.map(({score,...j})=>j)},null,2),blob=new Blob([payload],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='astrojob-backup.json';a.click();URL.revokeObjectURL(a.href)};
els.import.onclick=()=>els.importFile.click();
els.importFile.onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const p=JSON.parse(await file.text()),jobs=Array.isArray(p)?p:p.jobs;if(!Array.isArray(jobs))throw new Error('No jobs array found');for(const raw of jobs){const j=enrich(raw),{error}=await supabase.from('astrojob_jobs').insert(toRow(j));if(error)throw error}await loadJobs()}catch(err){alert('Could not import backup: '+err.message)}e.target.value=''};

const JOBAGENT_STATUS={saved:'saved',applied:'applied',screening:'screening',interview:'interview',offer:'offer',offered:'offer',signed:'signed',rejected:'rejected',withdrawn:'withdrawn',archived:'archived'};
const CITY_COUNTRY={warsaw:'Poland','kraków':'Poland',krakow:'Poland','wrocław':'Poland',wroclaw:'Poland',katowice:'Poland','gdańsk':'Poland',gdansk:'Poland','poznań':'Poland',poznan:'Poland',athens:'Greece','chisinau':'Moldova','chișinău':'Moldova',bucharest:'Romania',london:'United Kingdom',dublin:'Ireland',berlin:'Germany',amsterdam:'Netherlands'};
function inferJobAgentLocation(text=''){
  const lower=String(text).toLowerCase();
  for(const [city,country] of Object.entries(CITY_COUNTRY))if(lower.includes(city))return{city:city[0].toUpperCase()+city.slice(1),country};
  const countries=['Poland','Greece','Moldova','Romania','Germany','France','Italy','Spain','United Kingdom','Ireland','Netherlands','Portugal','Czechia','Hungary','Austria','Switzerland','Sweden','Norway','Denmark','Finland','United Arab Emirates'];
  const country=countries.find(x=>lower.includes(x.toLowerCase()));
  if(country)return{city:'',country};
  if(/\b(remote|worldwide|global|anywhere)\b/i.test(text))return{city:'',country:'Global'};
  return{city:'',country:'Global'};
}
function inferWorkModel(text=''){
  if(/\bhybrid\b/i.test(text))return'Hybrid';
  if(/\b(remote|work from home|home-based|worldwide)\b/i.test(text))return'Remote';
  if(/\b(on[- ]site|office[- ]based|at our .* offices?)\b/i.test(text))return'On-site';
  return'Remote';
}
const normValue=v=>String(v??'').toLowerCase().trim();
function normalizeUrl(url=''){try{const u=new URL(url);u.hash='';return u.toString().replace(/\/$/,'')}catch{return String(url||'').trim().replace(/\/$/,'')}}
function jobAgentToAstro(app){
  const description=app.rawJobDescription||'';
  const loc=inferJobAgentLocation(description);
  const sourceUrl=app.metadata?.sourceUrl||'';
  const noteParts=[];
  if(app.notes)noteParts.push(app.notes);
  if(Array.isArray(app.interviewNotes)&&app.interviewNotes.length)noteParts.push('JobAgent interview notes:\n'+app.interviewNotes.map(x=>typeof x==='string'?x:JSON.stringify(x)).join('\n'));
  return {
    title:app.jobTitle||'Untitled role',company:app.companyName||'Unknown company',
    country:loc.country,city:loc.city,workModel:inferWorkModel(description),url:sourceUrl||'#',
    postedAt:null,renewedAt:null,salary:{},languages:[],description,
    notes:noteParts.join('\n\n'),interest:'positive',
    nextActionAt:app.followUpAt?String(app.followUpAt).slice(0,10):null,
    status:JOBAGENT_STATUS[app.status]||'saved',
    foundAt:app.createdAt||new Date().toISOString(),createdAt:app.createdAt||new Date().toISOString(),updatedAt:app.updatedAt||new Date().toISOString()
  };
}
async function importJobAgent(file){
  const payload=JSON.parse(await file.text());
  const apps=payload?.applications;
  if(!Array.isArray(apps))throw new Error('This does not look like a JobAgent export: no applications array found.');
  let added=0,updated=0,skipped=0;
  const current=[...state.jobs];
  for(const app of apps){
    const incoming=jobAgentToAstro(app);
    const inUrl=normalizeUrl(incoming.url==='#'?'':incoming.url);
    const existing=current.find(j=>{
      const sameUrl=inUrl&&normalizeUrl(j.url==='#'?'':j.url)===inUrl;
      const sameTitleCompany=normValue(j.title)===normValue(incoming.title)&&normValue(j.company)===normValue(incoming.company);
      return sameUrl||sameTitleCompany;
    });
    if(existing){
      const merged={...existing,
        title:incoming.title||existing.title,company:incoming.company||existing.company,
        country:existing.country&&existing.country!=='Global'?existing.country:incoming.country,
        city:existing.city||incoming.city,workModel:existing.workModel||incoming.workModel,
        url:existing.url&&existing.url!=='#'?existing.url:incoming.url,
        description:existing.description||incoming.description,
        notes:existing.notes||incoming.notes,
        nextActionAt:incoming.nextActionAt||existing.nextActionAt,
        status:incoming.status||existing.status,
        updatedAt:incoming.updatedAt||new Date().toISOString()
      };
      const {error}=await supabase.from('astrojob_jobs').update(toRow(merged)).eq('id',existing.id);
      if(error)throw error;
      Object.assign(existing,merged);
      updated++;
    }else{
      const {data,error}=await supabase.from('astrojob_jobs').insert(toRow(incoming)).select().single();
      if(error)throw error;
      current.push(fromRow(data));added++;
    }
  }
  await loadJobs();
  return{added,updated,skipped,total:apps.length};
}
els.jobAgentImport.onclick=()=>els.jobAgentFile.click();
els.jobAgentFile.onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  els.jobAgentStatus.textContent='Importing JobAgent applications…';
  try{
    const r=await importJobAgent(file);
    els.jobAgentStatus.textContent='✓ JobAgent import complete: '+r.added+' added · '+r.updated+' existing jobs updated · '+r.total+' processed.';
  }catch(err){
    els.jobAgentStatus.textContent='Import failed: '+err.message;
  }
  e.target.value='';
};
els.loadDemo.onclick=async()=>{const res=await fetch('./data/sample-jobs.json'),jobs=await res.json();for(const raw of jobs){const j=enrich({...raw,status:'new',foundAt:new Date().toISOString()}),{error}=await supabase.from('astrojob_jobs').insert(toRow(j));if(error)return alert(error.message)}await loadJobs()};

await enter({user:DEMO_USER});
if(!state.jobs.length){
  const res=await fetch('./data/sample-jobs.json');
  const jobs=await res.json();
  const demoStatuses=['saved','applied','applied','interview','applied','rejected','screening','interview','offer','new','withdrawn','archived'];
  for(let i=0;i<jobs.length;i++){
    const raw=jobs[i];
    const j=enrich({...raw,status:demoStatuses[i%demoStatuses.length],foundAt:raw.postedAt||new Date().toISOString()});
    await supabase.from('astrojob_jobs').insert(toRow(j));
  }
  await loadJobs();
}
