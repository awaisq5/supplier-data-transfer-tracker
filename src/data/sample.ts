/**
 * A synthetic supplier register for a fictional company, Corvane Energy
 * Services, with entities in Germany, the Netherlands, Italy, Norway, the UK,
 * Switzerland and the US. Every supplier name is invented and contact addresses
 * use the reserved .example domain.
 *
 * Each agreement is written to show one situation the rules have to handle,
 * and document dates are generated relative to today so the demo never goes stale.
 */

import { addDays } from '../domain/documents'
import { requirementsFor } from '../domain/rules'
import type { Agreement, AgreementStatus, DataSubject, Destination, DocKey, DocRecord, Role } from '../domain/types'

type Profile =
  | 'complete'
  | 'none'
  | 'waiting'
  | 'escalate'
  | 'review'
  | 'tia-outdated'
  | 'wrong-module'
  | 'pdpa-missing'
  | 'dpf-stale'

type Dest = [entity: string, country: string, opts?: Partial<Omit<Destination, 'id' | 'entity' | 'country'>>]

interface Spec {
  supplier: string
  service: string
  analyst: string
  status: AgreementStatus
  goLiveIn?: number
  exporters: string[]
  roles?: [Role, Role]
  subjects: DataSubject[]
  special?: boolean
  count: number
  dest: Dest[]
  profile: Profile
}

const LENA = 'Lena Hoffmann'
const TOM = 'Tom Fischer'
const PRIYA = 'Priya Nair'

const sub = (extra: Partial<Destination> = {}) => ({ kind: 'sub-processor' as const, ...extra })
const dpf = (EU: boolean, UK: boolean, CH: boolean, hr: boolean) => ({ dpf: { EU, UK, CH, hr } })

const SPECS: Spec[] = [
  {
    supplier: 'Halvorsen Payroll Services Pvt Ltd',
    service: 'Global payroll processing',
    analyst: LENA,
    status: 'live',
    exporters: ['DE', 'NL', 'GB', 'CH'],
    subjects: ['employees'],
    count: 9800,
    dest: [
      ['Halvorsen Payroll Services Pvt Ltd', 'IN'],
      ['Kestrel Cloud Inc', 'US', sub(dpf(true, true, false, true))],
    ],
    profile: 'waiting',
  },
  {
    supplier: 'Brightpath Talent Ltda',
    service: 'Recruitment for Brazilian operations',
    analyst: PRIYA,
    status: 'live',
    exporters: ['DE', 'GB'],
    subjects: ['candidates'],
    count: 2400,
    dest: [['Brightpath Talent Ltda', 'BR']],
    profile: 'waiting',
  },
  {
    supplier: 'Sakura e-Learning KK',
    service: 'Mandatory training platform',
    analyst: TOM,
    status: 'live',
    exporters: ['DE', 'NO', 'GB', 'CH'],
    subjects: ['employees'],
    count: 14000,
    dest: [['Sakura e-Learning KK', 'JP']],
    profile: 'review',
  },
  {
    supplier: 'Northgate HR Cloud Inc',
    service: 'HR information system',
    analyst: LENA,
    status: 'live',
    exporters: ['DE', 'NL', 'IT', 'GB', 'CH'],
    subjects: ['employees', 'candidates'],
    count: 21000,
    dest: [['Northgate HR Cloud Inc', 'US', dpf(true, true, true, true)]],
    profile: 'complete',
  },
  {
    supplier: 'Vantage Expense Systems Inc',
    service: 'Travel expense management',
    analyst: TOM,
    status: 'live',
    exporters: ['DE', 'GB'],
    subjects: ['employees'],
    count: 7600,
    dest: [['Vantage Expense Systems Inc', 'US', dpf(true, false, false, false)]],
    profile: 'escalate',
  },
  {
    supplier: 'Maple Ridge Engineering Ltd',
    service: 'Engineering design services',
    analyst: PRIYA,
    status: 'live',
    exporters: ['DE', 'NO'],
    subjects: ['employees'],
    count: 300,
    dest: [['Maple Ridge Engineering Ltd', 'CA']],
    profile: 'complete',
  },
  {
    supplier: 'Clearview Occupational Health Ltd',
    service: 'Offshore fitness-to-work medicals',
    analyst: LENA,
    status: 'live',
    exporters: ['DE', 'NL', 'NO'],
    subjects: ['employees', 'contractors'],
    special: true,
    count: 3200,
    dest: [
      ['Clearview Occupational Health Ltd', 'GB'],
      ['MedScan Diagnostics Pvt Ltd', 'IN', sub()],
      ['Lumen Reporting Inc', 'PH', sub()],
    ],
    profile: 'tia-outdated',
  },
  {
    supplier: 'Gulf Workforce Solutions LLC',
    service: 'Contract labour, Middle East projects',
    analyst: PRIYA,
    status: 'live',
    exporters: ['DE', 'GB'],
    subjects: ['contractors'],
    count: 1100,
    dest: [['Gulf Workforce Solutions LLC', 'AE']],
    profile: 'waiting',
  },
  {
    supplier: 'Pacific Crew Services Inc',
    service: 'Offshore crew staffing',
    analyst: TOM,
    status: 'live',
    exporters: ['NL', 'NO'],
    subjects: ['contractors'],
    count: 650,
    dest: [['Pacific Crew Services Inc', 'PH']],
    profile: 'complete',
  },
  {
    supplier: 'Bharat Engineering Services Pvt Ltd',
    service: 'Engineering drawing services',
    analyst: PRIYA,
    status: 'live',
    exporters: ['DE', 'IT'],
    subjects: ['employees'],
    count: 450,
    dest: [['Bharat Engineering Services Pvt Ltd', 'IN']],
    profile: 'complete',
  },
  {
    supplier: 'Kestrel Service Desk Ltd',
    service: 'IT service desk',
    analyst: LENA,
    status: 'live',
    exporters: ['DE', 'NL', 'IT', 'NO', 'GB', 'CH'],
    subjects: ['employees'],
    count: 21000,
    dest: [
      ['Kestrel Service Desk Ltd', 'IE'],
      ['Kestrel Support India Pvt Ltd', 'IN', sub()],
      ['Kestrel Support Philippines Inc', 'PH', sub()],
      ['Cloudmere Hosting Inc', 'US', sub(dpf(true, true, true, true))],
    ],
    profile: 'waiting',
  },
  {
    supplier: 'Atlas Travel Management GmbH',
    service: 'Business travel booking',
    analyst: TOM,
    status: 'live',
    exporters: ['DE', 'NL', 'IT', 'NO', 'GB', 'CH'],
    subjects: ['employees'],
    count: 18000,
    dest: [
      ['Atlas Travel Management GmbH', 'DE'],
      ['GlobalFares Reservations Inc', 'US', sub(dpf(true, true, true, true))],
    ],
    profile: 'dpf-stale',
  },
  {
    supplier: 'Meridian Relocation Pte Ltd',
    service: 'Expatriate relocation support',
    analyst: PRIYA,
    status: 'onboarding',
    goLiveIn: 12,
    exporters: ['DE', 'NL', 'GB'],
    subjects: ['employees'],
    count: 240,
    dest: [['Meridian Relocation Pte Ltd', 'SG']],
    profile: 'none',
  },
  {
    supplier: 'Stonebridge Legal LLP',
    service: 'Legal advice, UAE disputes',
    analyst: LENA,
    status: 'live',
    exporters: ['DE'],
    roles: ['controller', 'controller'],
    subjects: ['employees', 'customers'],
    count: 60,
    dest: [['Stonebridge Legal LLP', 'AE']],
    profile: 'complete',
  },
  {
    supplier: 'Crescent Audit Partners',
    service: 'Statutory audit, Saudi branch',
    analyst: TOM,
    status: 'live',
    exporters: ['DE', 'NL'],
    roles: ['controller', 'controller'],
    subjects: ['employees', 'supplier contacts'],
    count: 900,
    dest: [['Crescent Audit Partners', 'SA']],
    profile: 'waiting',
  },
  {
    supplier: 'Insight Market Surveys LLC',
    service: 'Customer satisfaction survey',
    analyst: PRIYA,
    status: 'onboarding',
    goLiveIn: 30,
    exporters: ['DE', 'GB', 'CH'],
    subjects: ['customers'],
    count: 5500,
    dest: [['Insight Market Surveys LLC', 'US']],
    profile: 'none',
  },
  {
    supplier: 'Lumio Translation doo',
    service: 'Document translation',
    analyst: LENA,
    status: 'live',
    exporters: ['DE', 'CH'],
    subjects: ['employees', 'customers'],
    count: 200,
    dest: [['Lumio Translation doo', 'RS']],
    profile: 'complete',
  },
  {
    supplier: 'Cape Fleet Safety Training (Pty) Ltd',
    service: 'Crew safety training',
    analyst: TOM,
    status: 'live',
    exporters: ['NL', 'GB'],
    subjects: ['contractors'],
    count: 1500,
    dest: [['Cape Fleet Safety Training (Pty) Ltd', 'ZA']],
    profile: 'none',
  },
  {
    supplier: 'Tianhe Components Co Ltd',
    service: 'Supplier quality portal',
    analyst: PRIYA,
    status: 'live',
    exporters: ['DE'],
    subjects: ['supplier contacts'],
    count: 120,
    dest: [['Tianhe Components Co Ltd', 'CN']],
    profile: 'complete',
  },
  {
    supplier: 'Eastbay Data Entry Pvt Ltd',
    service: 'Invoice scanning',
    analyst: LENA,
    status: 'live',
    exporters: ['DE', 'NL', 'IT'],
    subjects: ['supplier contacts'],
    count: 3000,
    dest: [['Eastbay Data Entry Pvt Ltd', 'IN']],
    profile: 'complete',
  },
  {
    supplier: 'Andes Field Services SAC',
    service: 'Field labour, Peru',
    analyst: TOM,
    status: 'live',
    exporters: ['DE'],
    subjects: ['contractors'],
    count: 300,
    dest: [['Andes Field Services SAC', 'PE']],
    profile: 'complete',
  },
  {
    supplier: 'Southern Cross Pipeline Consultants Pty Ltd',
    service: 'Pipeline integrity consulting',
    analyst: PRIYA,
    status: 'live',
    exporters: ['GB'],
    roles: ['controller', 'controller'],
    subjects: ['employees'],
    count: 30,
    dest: [['Southern Cross Pipeline Consultants Pty Ltd', 'AU']],
    profile: 'complete',
  },
  {
    supplier: 'Hanbit Inspection Co Ltd',
    service: 'Robotic tank inspection',
    analyst: LENA,
    status: 'live',
    exporters: ['DE', 'CH'],
    subjects: ['employees'],
    count: 80,
    dest: [['Hanbit Inspection Co Ltd', 'KR']],
    profile: 'waiting',
  },
  {
    supplier: 'Laurentian Workforce Analytics Inc',
    service: 'Workforce planning analytics',
    analyst: TOM,
    status: 'live',
    exporters: ['GB', 'CH'],
    subjects: ['employees'],
    count: 2000,
    dest: [['Laurentian Workforce Analytics Inc', 'CA']],
    profile: 'complete',
  },
  {
    supplier: 'Carmel Cyber Defence Ltd',
    service: 'Security operations centre',
    analyst: PRIYA,
    status: 'live',
    exporters: ['DE', 'NL', 'IT', 'NO', 'GB', 'CH'],
    subjects: ['employees'],
    count: 21000,
    dest: [['Carmel Cyber Defence Ltd', 'IL']],
    profile: 'complete',
  },
  {
    supplier: 'Rambla Shared Services SA',
    service: 'Accounts payable processing',
    analyst: LENA,
    status: 'live',
    exporters: ['DE', 'NL'],
    subjects: ['supplier contacts'],
    count: 4200,
    dest: [['Rambla Shared Services SA', 'UY']],
    profile: 'pdpa-missing',
  },
  {
    supplier: 'Atlantic Benefits Brokers Inc',
    service: 'Employee health insurance brokerage',
    analyst: TOM,
    status: 'live',
    exporters: ['DE', 'GB', 'CH'],
    subjects: ['employees'],
    special: true,
    count: 4300,
    dest: [['Atlantic Benefits Brokers Inc', 'US', dpf(true, true, false, true)]],
    profile: 'waiting',
  },
  {
    supplier: 'Harbour Lagos Workforce Ltd',
    service: 'Driver staffing, Nigeria',
    analyst: PRIYA,
    status: 'onboarding',
    goLiveIn: -5,
    exporters: ['NL'],
    subjects: ['contractors'],
    count: 400,
    dest: [['Harbour Lagos Workforce Ltd', 'NG']],
    profile: 'waiting',
  },
  {
    supplier: 'Selangor Drafting Sdn Bhd',
    service: 'CAD drafting',
    analyst: LENA,
    status: 'live',
    exporters: ['DE'],
    subjects: ['employees'],
    count: 150,
    dest: [['Selangor Drafting Sdn Bhd', 'MY']],
    profile: 'complete',
  },
  {
    supplier: 'Norte Fabrication Services SA de CV',
    service: 'Welding inspection labour',
    analyst: TOM,
    status: 'ended',
    exporters: ['DE'],
    subjects: ['contractors'],
    count: 220,
    dest: [['Norte Fabrication Services SA de CV', 'MX']],
    profile: 'none',
  },
  {
    supplier: 'Anatolia Engineering Staffing AS',
    service: 'Contractor staffing, Türkiye',
    analyst: PRIYA,
    status: 'live',
    exporters: ['DE', 'IT'],
    subjects: ['contractors'],
    count: 700,
    dest: [['Anatolia Engineering Staffing AS', 'TR']],
    profile: 'review',
  },
  {
    supplier: 'Nile Document Imaging SAE',
    service: 'HR file digitisation',
    analyst: LENA,
    status: 'onboarding',
    goLiveIn: 45,
    exporters: ['DE'],
    subjects: ['employees'],
    special: true,
    count: 6000,
    dest: [['Nile Document Imaging SAE', 'EG']],
    profile: 'none',
  },
  {
    supplier: 'ClientHub CRM Ltd',
    service: 'Customer relationship management',
    analyst: TOM,
    status: 'live',
    exporters: ['DE', 'NL', 'NO', 'CH'],
    subjects: ['customers'],
    count: 12000,
    dest: [
      ['ClientHub CRM Ltd', 'GB'],
      ['ClientHub Inc', 'US', sub(dpf(true, true, true, false))],
    ],
    profile: 'complete',
  },
  {
    supplier: 'Polar Data Centres AS',
    service: 'Hosting for client project data',
    analyst: PRIYA,
    status: 'live',
    exporters: ['NO', 'GB'],
    roles: ['processor', 'processor'],
    subjects: ['customers'],
    count: 800,
    dest: [
      ['Polar Data Centres AS', 'NO'],
      ['Frostline Backup LLC', 'US', sub()],
    ],
    profile: 'waiting',
  },
  {
    supplier: 'Nimbus Subsurface Analytics Pvt Ltd',
    service: 'Well data interpretation for clients',
    analyst: LENA,
    status: 'live',
    exporters: ['NL'],
    roles: ['processor', 'processor'],
    subjects: ['customers'],
    count: 800,
    dest: [['Nimbus Subsurface Analytics Pvt Ltd', 'IN']],
    profile: 'complete',
  },
  {
    supplier: 'Swiftpass Visa Services FZE',
    service: 'Visa applications for staff travel',
    analyst: TOM,
    status: 'live',
    exporters: ['DE', 'GB', 'NL'],
    subjects: ['employees'],
    count: 600,
    dest: [['Swiftpass Visa Services FZE', 'AE']],
    profile: 'waiting',
  },
  {
    supplier: 'Alpenblick Medical AG',
    service: 'Medical checks, Swiss staff',
    analyst: PRIYA,
    status: 'live',
    exporters: ['CH'],
    subjects: ['employees'],
    special: true,
    count: 150,
    dest: [['Alpenblick Medical AG', 'CH']],
    profile: 'complete',
  },
  {
    supplier: 'Riverside Background Checks Inc',
    service: 'Pre-employment screening',
    analyst: LENA,
    status: 'onboarding',
    goLiveIn: 8,
    exporters: ['DE', 'GB'],
    subjects: ['candidates'],
    count: 1800,
    dest: [['Riverside Background Checks Inc', 'US']],
    profile: 'review',
  },
  {
    supplier: 'Coromandel Contact Centre Pvt Ltd',
    service: 'Customer service hotline',
    analyst: TOM,
    status: 'live',
    exporters: ['DE', 'NL', 'GB'],
    subjects: ['customers'],
    count: 40000,
    dest: [['Coromandel Contact Centre Pvt Ltd', 'IN']],
    profile: 'wrong-module',
  },
]

/** Small deterministic generator so the sample is the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0
  return (lo: number, hi: number) => {
    s = (s * 1664525 + 1013904223) >>> 0
    return lo + (s % (hi - lo + 1))
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(ltd|inc|llc|llp|gmbh|ag|as|sa|sac|kk|pvt|pte|co|fze|sae|doo|ltda|bhd|sdn|pty|de|cv)\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

function approved(on: string, extra: Partial<DocRecord> = {}): DocRecord {
  return { state: 'approved', reminders: [], requestedOn: addDays(on, -30), receivedOn: addDays(on, -5), approvedOn: on, ...extra }
}

function documentsFor(a: Agreement, profile: Profile, today: string, r: ReturnType<typeof rng>): Agreement['documents'] {
  const reqs = requirementsFor(a)
  const docs: Partial<Record<DocKey, DocRecord>> = {}
  const pdpaOn = addDays(today, -r(200, 700))

  const approveAll = (signedOn: string) => {
    for (const q of reqs) {
      docs[q.key] =
        q.key === 'dpf'
          ? approved(addDays(today, -r(20, 250)))
          : approved(q.key === 'pdpa' ? pdpaOn : signedOn, { covers: q.countries, modules: q.modules })
    }
  }

  switch (profile) {
    case 'none':
      break
    case 'complete':
      approveAll(addDays(today, -r(40, 420)))
      break
    case 'waiting':
    case 'escalate': {
      const age = profile === 'escalate' ? 75 : r(8, 50)
      const requestedOn = addDays(today, -age)
      const reminders: string[] = []
      const count = profile === 'escalate' ? 3 : Math.min(2, Math.floor((age - 1) / 14))
      for (let i = 1; i <= count; i++) reminders.push(addDays(requestedOn, 14 * i))
      for (const q of reqs) {
        if (q.key === 'pdpa') docs.pdpa = approved(pdpaOn)
        else if (q.key === 'dpf') docs.dpf = approved(addDays(today, -r(20, 250)))
        else docs[q.key] = { state: 'requested', requestedOn, reminders: [...reminders] }
      }
      break
    }
    case 'review':
      for (const q of reqs) {
        if (q.key === 'tia' || q.key === 'toms' || q.key === 'subproc') {
          docs[q.key] = { state: 'received', requestedOn: addDays(today, -r(25, 40)), reminders: [], receivedOn: addDays(today, -r(2, 9)) }
        } else if (q.key === 'dpf') docs.dpf = approved(addDays(today, -r(20, 250)))
        else docs[q.key] = approved(q.key === 'pdpa' ? pdpaOn : addDays(today, -r(10, 20)), { covers: q.countries, modules: q.modules })
      }
      break
    case 'tia-outdated': {
      // Approved last year, before the supplier added its newest sub-processor.
      approveAll(addDays(today, -r(250, 330)))
      const newest = a.destinations[a.destinations.length - 1].country
      for (const key of ['tia', 'subproc'] as const) {
        const d = docs[key]
        if (d) d.covers = (d.covers ?? []).filter((c) => c !== newest)
      }
      break
    }
    case 'wrong-module':
      approveAll(addDays(today, -r(300, 500)))
      if (docs.scc) docs.scc.modules = [1]
      break
    case 'pdpa-missing':
      approveAll(addDays(today, -r(100, 300)))
      delete docs.pdpa
      break
    case 'dpf-stale':
      approveAll(addDays(today, -r(100, 300)))
      if (docs.dpf) docs.dpf.approvedOn = addDays(today, -r(400, 480))
      break
  }
  return docs
}

export function sampleRegister(today: string): Agreement[] {
  const r = rng(20220701)
  return SPECS.map((s, i) => {
    const id = `AGR-${String(1001 + i)}`
    const [exporterRole, importerRole] = s.roles ?? ['controller', 'processor']
    const destinations: Destination[] = s.dest.map(([entity, country, opts], j) => ({
      id: `${id}-d${j + 1}`,
      entity,
      country,
      kind: 'importer',
      privateSector: true,
      ...opts,
    }))
    const a: Agreement = {
      id,
      supplier: s.supplier,
      service: s.service,
      contactEmail: `privacy@${slug(s.supplier)}.example`,
      analyst: s.analyst,
      status: s.status,
      goLive: s.goLiveIn !== undefined ? addDays(today, s.goLiveIn) : undefined,
      exporters: s.exporters,
      exporterRole,
      importerRole,
      dataSubjects: s.subjects,
      specialCategory: s.special ?? false,
      subjectCount: s.count,
      destinations,
      documents: {},
    }
    return { ...a, documents: documentsFor(a, s.profile, today, r) }
  })
}

/** Our own entities, for the editor. */
export const OUR_ENTITIES: { country: string; name: string }[] = [
  { country: 'DE', name: 'Corvane Energy Services GmbH' },
  { country: 'NL', name: 'Corvane Energy Services BV' },
  { country: 'IT', name: 'Corvane Energy Services Srl' },
  { country: 'NO', name: 'Corvane Energy Services AS' },
  { country: 'GB', name: 'Corvane Energy Services Ltd' },
  { country: 'CH', name: 'Corvane Energy Services AG' },
  { country: 'US', name: 'Corvane Energy Services Inc' },
]
