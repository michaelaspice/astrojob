export const MIHAELA_PROFILE = {
  version: '2.0.0',
  freshness: { maxAgeDays: 21, allowRecentlyRenewed: true },
  geography: {
    priorityCountries: ['Poland'],
    onsiteHybridRemoteCountries: ['Poland', 'Greece', 'Moldova'],
    restOfEMEA: { remoteOnly: true }
  },
  salaryRules: {
    Poland: { currency: 'PLN', monthlyGrossMin: 10000, annualGrossMin: 120000, allowUndisclosed: true },
    Greece: { currency: 'EUR', monthlyGrossMin: 2400, annualGrossMin: 28000, allowUndisclosed: true },
    Moldova: { allowAnySalary: true, allowUndisclosed: true },
    RestOfEMEA: { currency: 'EUR', annualGrossMin: 30000, allowUndisclosed: true, remoteOnly: true },
    conflictingSalaryPolicy: 'ALLOW_AND_FLAG'
  },
  roleFamilies: [
    'customer success','customer support','customer excellence','customer experience','customer operations','client success','client services',
    'support operations','onboarding','implementation','account management','renewals','relationship management','service delivery',
    'operations','sales operations','revenue operations','commercial operations','business operations','enablement','sales enablement',
    'quality assurance','quality operations','process improvement','process excellence','crm operations','crm manager','business analyst',
    'program manager','project manager','team lead','people manager','partner operations','customer engagement'
  ],
  strongSignals: [
    'customer success','customer support','customer experience','customer operations','client services','onboarding','implementation',
    'account management','renewals','retention','customer excellence','service delivery','escalation','customer lifecycle','team leadership',
    'people management','coaching','performance management','kpi','csat','quality assurance','process improvement','sop','playbook',
    'salesforce','hubspot','pipedrive','zendesk','kustomer','crm','excel','google sheets','looker studio','zapier','automation','analytics'
  ],
  languages: ['romanian','russian','english','greek'],
  relevantExperienceYears: 7,
  supportedSeniority: ['analyst','specialist','senior','lead','manager','head'],
  profileSkills: [
    'customer success','customer experience','onboarding','implementation','account management','renewals','retention',
    'escalation management','stakeholder management','team leadership','coaching','performance management','kpi management',
    'csat','quality assurance','process improvement','sops & playbooks','sales operations','crm operations','data analysis',
    'automation','project management'
  ],
  hardLanguagePolicy: 'REJECT_UNSUPPORTED_REQUIRED_LANGUAGE',
  hardTechnicalRejects: ['python required','advanced python required','strong python required','proficiency in python required'],
  acceptableTechnicalNiceToHaves: ['sql','python','data analysis','business intelligence','api','automation'],
  stretch: { enabled: true, surfaceFromFit: 70 },
  taxonomy: {
    CORE: '🌟 Core Match',
    TRANSFERABLE: '🚀 Transferable Match',
    STRETCH: '🪐 Stretch Match',
    WILD_CARD: '☄️ Wild Card',
    BLACK_HOLE: '🕳️ Black Hole'
  }
};