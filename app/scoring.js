import { MIHAELA_PROFILE } from './profile.js';

const EMEA_COUNTRIES = new Set(['Albania','Algeria','Andorra','Angola','Armenia','Austria','Azerbaijan','Bahrain','Belarus','Belgium','Bosnia and Herzegovina','Botswana','Bulgaria','Croatia','Cyprus','Czechia','Denmark','Egypt','Estonia','Finland','France','Georgia','Germany','Ghana','Greece','Hungary','Iceland','Ireland','Israel','Italy','Jordan','Kenya','Kuwait','Latvia','Lebanon','Lithuania','Luxembourg','Malta','Moldova','Monaco','Morocco','Netherlands','Nigeria','North Macedonia','Norway','Oman','Poland','Portugal','Qatar','Romania','Saudi Arabia','Serbia','Slovakia','Slovenia','South Africa','Spain','Sweden','Switzerland','Tunisia','Turkey','Ukraine','United Arab Emirates','United Kingdom']);
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(n)));
const norm=v=>String(v??'').toLowerCase();
const textFor=j=>norm([j.title,j.description,j.requirements,j.skills?.join(' '),j.languages?.join(' '),j.industry].filter(Boolean).join(' '));
const regionFor=c=>['Poland','Greece','Moldova'].includes(c)?c:(EMEA_COUNTRIES.has(c)?'RestOfEMEA':'OUTSIDE_EMEA');

export function checkFreshness(job, profile=MIHAELA_PROFILE){
  const posted = job.postedAt ? new Date(job.postedAt) : null;
  const renewed = job.renewedAt ? new Date(job.renewedAt) : null;
  const effective = renewed && !Number.isNaN(renewed) ? renewed : posted;
  if (!effective || Number.isNaN(effective)) return {allowed:true,status:'DATE_UNKNOWN',flags:['DATE_REVIEW']};
  const ageDays = (Date.now()-effective.getTime())/86400000;
  if (ageDays <= profile.freshness.maxAgeDays) return {allowed:true,status:renewed?'RECENTLY_RENEWED':'FRESH',ageDays:Math.floor(ageDays),flags:[]};
  return {allowed:false,status:'STALE',ageDays:Math.floor(ageDays),reason:`Posted more than ${profile.freshness.maxAgeDays} days ago`};
}

export function checkGeography(job){
  const region=regionFor(job.country||'');
  if(region==='OUTSIDE_EMEA') return {allowed:false,reason:'Outside configured geography',region};
  if(region==='RestOfEMEA'&&norm(job.workModel)!=='remote') return {allowed:false,reason:'Rest of EMEA is remote-only',region};
  return {allowed:true,region};
}

export function checkSalary(job, profile=MIHAELA_PROFILE){
  const geo=regionFor(job.country||''); const rule=profile.salaryRules[geo]; const s=job.salary||{};
  if(!rule) return {allowed:true,status:'NO_RULE',flags:[]};
  if(rule.allowAnySalary) return {allowed:true,status:'ANY_SALARY',flags:[]};
  const hasM=Number.isFinite(s.monthlyGross), hasA=Number.isFinite(s.annualGross);
  if(!hasM&&!hasA) return {allowed:!!rule.allowUndisclosed,status:'UNDISCLOSED_OK',flags:[]};
  const flags=[]; if(s.currency&&rule.currency&&s.currency!==rule.currency) flags.push('CURRENCY_REVIEW');
  const mp=!hasM||s.monthlyGross>=(rule.monthlyGrossMin??-Infinity); const ap=!hasA||s.annualGross>=(rule.annualGrossMin??-Infinity);
  if(hasM&&hasA&&mp!==ap) return {allowed:true,status:'CONFLICT_ALLOWED',flags:[...flags,'SALARY_REVIEW']};
  return {allowed:mp&&ap,status:mp&&ap?'SALARY_OK':'BELOW_MINIMUM',flags,reason:mp&&ap?undefined:'Known salary is below configured minimum'};
}

function unsupportedHardLanguage(text, profile){
  const known=profile.languages;
  const languageNames=['polish','german','french','dutch','spanish','italian','swedish','norwegian','danish','finnish','czech','hungarian','portuguese','arabic','hebrew','turkish'];
  for(const lang of languageNames){
    if(known.includes(lang)) continue;
    const hard=[`${lang} required`,`fluent ${lang}`,`native ${lang}`,`${lang} c1`,`${lang} c2`,`professional ${lang} required`];
    if(hard.some(p=>text.includes(p))) return lang;
  }
  return null;
}

function classify(job,fit,priority,profile){
  const text=textFor(job); const roleHits=profile.roleFamilies.filter(x=>text.includes(x)).length; const skillHits=profile.strongSignals.filter(x=>text.includes(x)).length;
  if(priority===0) return profile.taxonomy.BLACK_HOLE;
  if(fit>=86 && roleHits>=2) return profile.taxonomy.CORE;
  if(fit>=76 && skillHits>=4) return profile.taxonomy.TRANSFERABLE;
  if(fit>=70) return profile.taxonomy.STRETCH;
  if(priority>=68 && roleHits>=1) return profile.taxonomy.WILD_CARD;
  return profile.taxonomy.BLACK_HOLE;
}

function scoreFit(job,profile){
  const text=textFor(job); let score=38; const reasons=[]; const gaps=[];
  const roleHits=profile.roleFamilies.filter(t=>text.includes(t)); score+=Math.min(28,roleHits.length*7); if(roleHits.length) reasons.push(`Role overlap: ${roleHits.slice(0,4).join(', ')}`);
  const strong=profile.strongSignals.filter(t=>text.includes(t)); score+=Math.min(34,strong.length*4); if(strong.length) reasons.push(`Skill overlap: ${strong.slice(0,6).join(', ')}`);
  const langs=profile.languages.filter(t=>text.includes(t)); if(langs.length){score+=Math.min(10,langs.length*3);reasons.push(`Language advantage: ${langs.join(', ')}`)}
  if(text.includes('sql')){score+=2;gaps.push('SQL may need role-specific depth')}
  return {score:clamp(score),reasons,gaps};
}

function scoreDesirability(job,geo,salary,freshness){
  let score=60; const reasons=[];
  if(geo.region==='Poland'){score+=25;reasons.push('Poland priority')} else if(['Greece','Moldova'].includes(geo.region)) score+=10; else score+=8;
  if(['SALARY_OK','ANY_SALARY'].includes(salary.status)) score+=8; else if(salary.status==='UNDISCLOSED_OK') score+=3;
  if(freshness.status==='FRESH') score+=6; if(freshness.status==='RECENTLY_RENEWED') score+=5;
  if(['saas','tech','technology','fintech','gaming','travel','hr tech','payments'].some(x=>textFor(job).includes(x))) score+=5;
  return {score:clamp(score),reasons};
}

export function scoreJob(job,profile=MIHAELA_PROFILE){
  const freshness=checkFreshness(job,profile); if(!freshness.allowed) return {decision:'REJECT',taxonomy:profile.taxonomy.BLACK_HOLE,priority:0,fit:0,desirability:0,hardReject:freshness.reason,flags:[]};
  const geography=checkGeography(job); if(!geography.allowed) return {decision:'REJECT',taxonomy:profile.taxonomy.BLACK_HOLE,priority:0,fit:0,desirability:0,hardReject:geography.reason,flags:[]};
  const salary=checkSalary(job,profile); if(!salary.allowed) return {decision:'REJECT',taxonomy:profile.taxonomy.BLACK_HOLE,priority:0,fit:0,desirability:0,hardReject:salary.reason,flags:salary.flags||[]};
  const text=textFor(job);
  const unsupported=unsupportedHardLanguage(text,profile); if(unsupported) return {decision:'REJECT',taxonomy:profile.taxonomy.BLACK_HOLE,priority:0,fit:0,desirability:0,hardReject:`Unsupported language required: ${unsupported}`,flags:[]};
  if(profile.hardTechnicalRejects.some(p=>text.includes(p))) return {decision:'REJECT',taxonomy:profile.taxonomy.BLACK_HOLE,priority:0,fit:0,desirability:0,hardReject:'Python is a hard requirement',flags:[]};
  const fitR=scoreFit(job,profile), desR=scoreDesirability(job,geography,salary,freshness); const priority=clamp(fitR.score*.62+desR.score*.38);
  let decision='MAYBE'; if(priority>=85) decision='APPLY_NOW'; else if(priority>=75) decision='APPLY'; else if(fitR.score>=profile.stretch.surfaceFromFit) decision='STRETCH';
  const taxonomy=classify(job,fitR.score,priority,profile);
  return {decision,taxonomy,fit:fitR.score,desirability:desR.score,priority,flags:[...(salary.flags||[]),...(freshness.flags||[])],salaryStatus:salary.status,freshness:freshness.status,geography:geography.region,reasons:[...fitR.reasons,...desR.reasons],gaps:fitR.gaps};
}