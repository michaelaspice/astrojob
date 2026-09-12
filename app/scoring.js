import { MIHAELA_PROFILE } from './profile.js';

const EMEA_COUNTRIES = new Set(['Albania','Algeria','Andorra','Angola','Armenia','Austria','Azerbaijan','Bahrain','Belarus','Belgium','Bosnia and Herzegovina','Botswana','Bulgaria','Croatia','Cyprus','Czechia','Denmark','Egypt','Estonia','Finland','France','Georgia','Germany','Ghana','Greece','Hungary','Iceland','Ireland','Israel','Italy','Jordan','Kenya','Kuwait','Latvia','Lebanon','Lithuania','Luxembourg','Malta','Moldova','Monaco','Morocco','Netherlands','Nigeria','North Macedonia','Norway','Oman','Poland','Portugal','Qatar','Romania','Saudi Arabia','Serbia','Slovakia','Slovenia','South Africa','Spain','Sweden','Switzerland','Tunisia','Turkey','Ukraine','United Arab Emirates','United Kingdom']);
const clamp=(n,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(n)));
const norm=v=>String(v??'').toLowerCase();
const textFor=j=>norm([j.title,j.description,j.requirements,j.skills?.join(' '),j.languages?.join(' '),j.industry].filter(Boolean).join(' '));
const regionFor=c=>['Poland','Greece','Moldova'].includes(c)?c:(['Global','Worldwide','Anywhere','Remote'].includes(c)?'RestOfEMEA':(EMEA_COUNTRIES.has(c)?'RestOfEMEA':'OUTSIDE_EMEA'));

export function checkFreshness(job, profile=MIHAELA_PROFILE){
  const posted = job.postedAt ? new Date(job.postedAt) : null;
  const renewed = job.renewedAt ? new Date(job.renewedAt) : null;
  const effective = renewed && !Number.isNaN(renewed) ? renewed : posted;
  if (!effective || Number.isNaN(effective)) return {allowed:true,status:'DATE_UNKNOWN',flags:['DATE_REVIEW'],priorityPenalty:0};
  const ageDays = (Date.now()-effective.getTime())/86400000;
  if (ageDays <= profile.freshness.maxAgeDays) return {allowed:true,status:renewed?'RECENTLY_RENEWED':'FRESH',ageDays:Math.floor(ageDays),flags:[],priorityPenalty:0};
  return {
    allowed:true,
    status:'STALE',
    ageDays:Math.floor(ageDays),
    reason:`Posted more than ${profile.freshness.maxAgeDays} days ago`,
    flags:[`Posted more than ${profile.freshness.maxAgeDays} days ago`],
    priorityPenalty:12
  };
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


const TECH=[
 ['Salesforce',['salesforce']],['HubSpot',['hubspot']],['Pipedrive',['pipedrive']],['Zendesk',['zendesk']],['Kustomer',['kustomer']],['Jira',['jira']],['SQL',['sql']],['Excel',['excel']],['Google Sheets',['google sheets']],['Looker Studio',['looker studio']],['Power BI',['power bi']],['Tableau',['tableau']],['Zapier',['zapier']],['Coupler.io',['coupler']],['Parabola',['parabola']],['Amadeus',['amadeus']],['Sabre',['sabre']],['Asana',['asana']],['Monday.com',['monday.com']],['Trello',['trello']],['Outreach',['outreach']],['SynXis CRS',['synxis crs','synxis']]
];
const OWNED_TECH=new Set(['Salesforce','HubSpot','Pipedrive','Zendesk','Kustomer','Jira','Excel','Google Sheets','Looker Studio','Zapier','Coupler.io','Parabola','Amadeus','Sabre','Asana','Monday.com','Trello','Outreach']);
const LEARNING_TECH=new Set(['SQL']);
const ADJACENT_TECH=new Set(['Power BI','Tableau']);
const SKILLS=[
 ['Customer Success',['customer success']],['Onboarding',['onboarding']],['Implementation',['implementation']],['Account Management',['account management']],['Renewals',['renewal']],['Retention',['retention','churn']],['Escalation Management',['escalation']],['Stakeholder Management',['stakeholder']],['Team Leadership',['team leadership','team lead','people management']],['Coaching',['coaching']],['KPI Management',['kpi']],['CSAT',['csat','customer satisfaction']],['Quality Assurance',['quality assurance']],['Process Improvement',['process improvement']],['SOPs & Playbooks',['sop','playbook']],['Sales Operations',['sales operations']],['Revenue Operations',['revenue operations','revops']],['CRM Operations',['crm operations']],['Data Analysis',['data analysis','analytics']],['Automation',['automation']],['Project Management',['project management','project manager']],['Program Management',['program management','program manager']]
];
const TRANSFER_SKILLS=new Set(['Revenue Operations','Program Management','Project Management','Sales Operations','Quality Assurance','Process Improvement','Data Analysis','Automation','Stakeholder Management','Team Leadership','Coaching','CRM Operations']);
function intelligenceFor(job,profile){
 const text=textFor(job);
 const memoryText=norm((profile.memoryInsights||[]).join(' '));
 const tech=TECH.filter(([,terms])=>terms.some(t=>text.includes(t))).map(([name])=>name);
 const matchedTech=tech.filter(x=>OWNED_TECH.has(x)||memoryText.includes(norm(x)));
 const learningTech=tech.filter(x=>!matchedTech.includes(x)&&LEARNING_TECH.has(x));
 const transferableTech=tech.filter(x=>!matchedTech.includes(x)&&ADJACENT_TECH.has(x));
 const techGaps=tech.filter(x=>!matchedTech.includes(x)&&!learningTech.includes(x)&&!transferableTech.includes(x));

 const skills=SKILLS.filter(([,terms])=>terms.some(t=>text.includes(t))).map(([name])=>name);
 const profileSkills=new Set((profile.profileSkills||[]).map(norm));
 const matchedSkills=skills.filter(x=>profileSkills.has(norm(x))||memoryText.includes(norm(x)));
 const skillGaps=skills.filter(x=>!matchedSkills.includes(x));
 const transferableSkills=skills.filter(x=>!matchedSkills.includes(x)&&TRANSFER_SKILLS.has(x));

 const languageNames=['romanian','russian','english','greek','polish','german','french','dutch','spanish','italian','swedish','norwegian','danish','finnish','czech','hungarian','portuguese','arabic','hebrew','turkish'];
 const mentionedLanguages=[...new Set([...(job.languages||[]).map(norm),...languageNames.filter(x=>text.includes(x))])];
 const knownLanguages=mentionedLanguages.filter(x=>profile.languages.includes(x)||memoryText.includes(x));
 const languageGaps=mentionedLanguages.filter(x=>!knownLanguages.includes(x));

 const expMatches=[...text.matchAll(/\b(?:at least\s*)?(\d{1,2})\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:relevant\s+)?(?:professional\s+)?experience\b/gi)];
 const mentionedExperience=[...new Set(expMatches.map(m=>m[0].replace(/\s+/g,' ').trim()))];
 const maxRequiredYears=expMatches.reduce((m,x)=>Math.max(m,Number(x[1])||0),0);
 const memoryYears=[...memoryText.matchAll(/\b(\d{1,2})\+?\s*(?:years?|yrs?)/g)].reduce((m,x)=>Math.max(m,Number(x[1])||0),0);
 const effectiveYears=Math.max(profile.relevantExperienceYears||0,memoryYears);
 const experienceGap=maxRequiredYears>effectiveYears ? (maxRequiredYears+'+ years experience requested; profile baseline is ~'+effectiveYears+'+ relevant years') : null;

 const title=norm(job.title);
 const seniorityKeywords=['intern','junior','entry','assistant','analyst','specialist','senior','lead','manager','head','director','vp','vice president','chief'];
 const mentionedSeniority=seniorityKeywords.find(x=>title.includes(x))||null;
 const seniorityMap={intern:35,junior:55,entry:55,assistant:60,analyst:84,specialist:90,senior:94,lead:98,manager:100,head:90,director:72,vp:48,'vice president':48,chief:42};
 let seniorityFit=mentionedSeniority?(seniorityMap[mentionedSeniority]??82):86;
 let seniorityGap=null;
 if(['director','vp','vice president','chief'].includes(mentionedSeniority)) seniorityGap='Seniority: '+mentionedSeniority.toUpperCase()+' level is above current profile baseline';

 const roleHits=[...new Set(profile.roleFamilies.filter(x=>text.includes(x)))];
 const roleFit=roleHits.length?clamp(58+Math.min(42,roleHits.length*9)):45;
 const techFit=tech.length?clamp((matchedTech.length+learningTech.length*.72+transferableTech.length*.6)/tech.length*100):null;
 const skillFit=skills.length?clamp((matchedSkills.length+transferableSkills.length*.65)/skills.length*100):null;
 const languageFit=mentionedLanguages.length?clamp(knownLanguages.length/mentionedLanguages.length*100):null;
 const experienceFit=maxRequiredYears?clamp(Math.min(1,effectiveYears/maxRequiredYears)*100):null;

 const strengths=[
   ...(roleHits.length?['Direct role overlap: '+roleHits.slice(0,4).join(', ')]:[]),
   ...matchedSkills.slice(0,6).map(x=>'Proven skill: '+x),
   ...matchedTech.slice(0,5).map(x=>'Known system: '+x),
   ...(knownLanguages.length?['Language match: '+knownLanguages.map(x=>x[0].toUpperCase()+x.slice(1)).join(', ')]:[]),
   ...(maxRequiredYears&&effectiveYears>=maxRequiredYears?['Experience requirement met: '+effectiveYears+'+ years vs '+maxRequiredYears+'+ requested']:[]),
   ...(seniorityFit>=90?['Seniority aligns well with the role']:[])
 ];

 const transferable=[...transferableSkills,...transferableTech,...learningTech.map(x=>x+' (already in learning path)')];
 const weaknesses=[
   ...skillGaps.filter(x=>!transferableSkills.includes(x)).slice(0,6).map(x=>'Limited evidence: '+x),
   ...(experienceGap?[experienceGap]:[]),
   ...(seniorityGap?[seniorityGap]:[])
 ];
 const toLearn=[...learningTech,...techGaps,...skillGaps.filter(x=>!transferableSkills.includes(x)).slice(0,5)];

 const gaps=[
   ...techGaps.map(x=>'Tech: '+x),
   ...skillGaps.map(x=>'Skill: '+x),
   ...languageGaps.map(x=>'Language: '+x[0].toUpperCase()+x.slice(1)),
   ...(experienceGap?[experienceGap]:[]),
   ...(seniorityGap?[seniorityGap]:[])
 ];

 return {
   matchedTech,learningTech,transferableTech,techGaps,
   matchedSkills,skillGaps,transferableSkills,
   mentionedLanguages,knownLanguages,languageGaps,
   mentionedExperience,maxRequiredYears,
   roleHits,skillFit,experienceFit,
   strengths,weaknesses,transferable,toLearn,
   gaps,techFit,roleFit,languageFit,seniorityFit
 };
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

function scoreFit(job,profile,intelligence){
  const i=intelligence;
  const dimensions=[
    ['role',i.roleFit,35],
    ['skills',i.skillFit,30],
    ['seniority',i.seniorityFit,15],
    ['tech',i.techFit,10],
    ['language',i.languageFit,10]
  ].filter(([,v])=>Number.isFinite(v));
  if(Number.isFinite(i.experienceFit))dimensions.push(['experience',i.experienceFit,15]);
  const weight=dimensions.reduce((sum,[,,w])=>sum+w,0)||1;
  const raw=dimensions.reduce((sum,[,v,w])=>sum+v*w,0)/weight;
  const reasons=[];
  if(i.roleFit>=80)reasons.push('Strong role-family alignment');
  if((i.skillFit??0)>=75)reasons.push('Strong skill coverage');
  if((i.techFit??0)>=80)reasons.push('Strong systems / tooling coverage');
  if((i.languageFit??0)===100&&i.mentionedLanguages.length)reasons.push('Language requirements covered');
  if(i.seniorityFit>=90)reasons.push('Seniority aligns with profile');
  return {score:clamp(raw),reasons,gaps:i.weaknesses||[]};
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
  // Fit and intelligence describe the candidate-role match and are always calculated.
  // Practical constraints influence desirability, priority and the final decision, but never erase fit.
  const freshness=checkFreshness(job,profile);
  const geography=checkGeography(job);
  const salary=checkSalary(job,profile);
  const text=textFor(job);
  const unsupported=unsupportedHardLanguage(text,profile);
  const pythonReject=profile.hardTechnicalRejects.some(p=>text.includes(p));

  const intelligence=intelligenceFor(job,profile);
  const fitR=scoreFit(job,profile,intelligence);
  const desR=scoreDesirability(job,geography,salary,freshness);

  const basePriority=clamp(fitR.score*.62+desR.score*.38);
  let priority=clamp(basePriority-(freshness.priorityPenalty||0));

  const hardReasons=[];
  if(!geography.allowed) hardReasons.push(geography.reason);
  if(!salary.allowed) hardReasons.push(salary.reason);
  if(unsupported) hardReasons.push(`Unsupported language required: ${unsupported}`);
  if(pythonReject) hardReasons.push('Python is a hard requirement');

  let decision='MAYBE';
  if(hardReasons.length){
    decision='REJECT';
    priority=0;
  }else if(priority>=85) decision='APPLY_NOW';
  else if(priority>=75) decision='APPLY';
  else if(fitR.score>=profile.stretch.surfaceFromFit) decision='STRETCH';

  // Taxonomy reflects the role match itself, not whether a practical rule blocks applying.
  const taxonomy=classify(job,fitR.score,basePriority,profile);

  const flags=[
    ...(salary.flags||[]),
    ...(freshness.flags||[])
  ];

  const reasons=[...fitR.reasons,...desR.reasons];
  if(freshness.status==='STALE') reasons.push('Older posting: priority reduced, fit preserved');

  return {
    decision,
    taxonomy,
    fit:fitR.score,
    desirability:desR.score,
    priority,
    intelligence,
    flags,
    hardReject:hardReasons.length?hardReasons.join(' · '):undefined,
    hardBlockers:hardReasons,
    salaryStatus:salary.status,
    freshness:freshness.status,
    geography:geography.region,
    reasons,
    gaps:fitR.gaps
  };
}