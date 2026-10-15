import { describe, expect, it } from 'vitest'
import { sampleRegister } from '../data/sample'
import { approve, logEmailSent, receive, request } from './actions'
import { comparePriority, draftEmail, statusOf, viewOf } from './documents'
import { requirementsFor } from './rules'
import { type Agreement, DEFAULT_SETTINGS, type Destination } from './types'

const TODAY = '2026-10-15'
const S = DEFAULT_SETTINGS

const dest = (country: string, extra: Partial<Destination> = {}): Destination => ({
  id: `d-${country}`,
  entity: `Supplier ${country}`,
  country,
  kind: 'importer',
  privateSector: true,
  ...extra,
})

const agreement = (over: Partial<Agreement> = {}): Agreement => ({
  id: 'A1',
  supplier: 'Supplier',
  service: 'Payroll',
  contactEmail: 'privacy@supplier.example',
  analyst: 'Analyst',
  status: 'live',
  exporters: ['DE'],
  exporterRole: 'controller',
  importerRole: 'processor',
  dataSubjects: ['employees'],
  specialCategory: false,
  subjectCount: 100,
  destinations: [dest('IN')],
  documents: {},
  ...over,
})

describe('document status', () => {
  const tia = requirementsFor(agreement()).find((r) => r.key === 'tia')!

  it('is due for a reminder after the reminder interval', () => {
    const s = statusOf(tia, { state: 'requested', requestedOn: '2026-09-20', reminders: ['2026-10-04'] }, S, TODAY)
    expect(s.progress).toBe('waiting')
    expect(s.daysWaiting).toBe(11)
    expect(s.reminderDue).toBe(false)
    const later = statusOf(tia, { state: 'requested', requestedOn: '2026-09-20', reminders: [] }, S, TODAY)
    expect(later.reminderDue).toBe(true)
  })

  it('escalates after the set number of reminders', () => {
    const s = statusOf(tia, { state: 'requested', requestedOn: '2026-07-01', reminders: ['2026-07-15', '2026-07-29', '2026-08-12'] }, S, TODAY)
    expect(s.escalate).toBe(true)
  })

  it('flags an approved assessment that does not cover a new country', () => {
    const a = agreement({ destinations: [dest('IN'), dest('PH', { kind: 'sub-processor', id: 'd-ph' })] })
    // The PH sub-processor of a processor in India: both countries need covering.
    const req = requirementsFor(a).find((r) => r.key === 'tia')!
    const s = statusOf(req, { state: 'approved', reminders: [], approvedOn: '2026-01-10', covers: ['IN'] }, S, TODAY)
    expect(s.progress).toBe('incomplete')
    expect(s.detail).toBe('Does not cover the Philippines.')
  })

  it('flags SCCs signed under the wrong module', () => {
    const req = requirementsFor(agreement()).find((r) => r.key === 'scc')!
    const s = statusOf(req, { state: 'approved', reminders: [], approvedOn: '2025-01-10', modules: [1] }, S, TODAY)
    expect(s.progress).toBe('incomplete')
  })

  it('asks for a fresh DPF check after a year', () => {
    const a = agreement({ destinations: [dest('US', { dpf: { EU: true, hr: true } })] })
    const req = requirementsFor(a).find((r) => r.key === 'dpf')!
    expect(statusOf(req, { state: 'approved', reminders: [], approvedOn: '2025-09-01' }, S, TODAY).progress).toBe('stale')
    expect(statusOf(req, { state: 'approved', reminders: [], approvedOn: '2026-09-01' }, S, TODAY).progress).toBe('done')
  })
})

describe('workflow', () => {
  it('moves a document from request to approval', () => {
    let a = agreement()
    const req = requirementsFor(a).find((r) => r.key === 'tia')!
    a = request(a, 'tia', '2026-09-01')
    expect(viewOf(a, S, TODAY).statuses.find((s) => s.requirement.key === 'tia')?.progress).toBe('waiting')
    a = receive(a, 'tia', '2026-09-20')
    expect(viewOf(a, S, TODAY).statuses.find((s) => s.requirement.key === 'tia')?.progress).toBe('review')
    a = approve(a, req, '2026-09-22')
    expect(a.documents.tia?.covers).toEqual(['IN'])
    expect(viewOf(a, S, TODAY).statuses.find((s) => s.requirement.key === 'tia')?.progress).toBe('done')
  })

  it('logs a sent email as requests and reminders', () => {
    let a = agreement()
    a = request(a, 'tia', '2026-09-01')
    const view = viewOf(a, S, TODAY)
    const after = logEmailSent(view, TODAY)
    expect(after.documents.tia?.reminders).toEqual([TODAY])
    expect(after.documents.scc?.requestedOn).toBe(TODAY)
    expect(after.documents.pdpa?.requestedOn).toBe(TODAY)
  })
})

describe('buckets and priority', () => {
  it('puts live gaps before onboarding and housekeeping', () => {
    const live = viewOf(agreement({ id: 'live' }), S, TODAY)
    const onboarding = viewOf(agreement({ id: 'ob', status: 'onboarding', goLive: '2026-11-01' }), S, TODAY)
    expect(live.bucket).toBe('exposed')
    expect(onboarding.bucket).toBe('go-live')
    expect([onboarding, live].sort(comparePriority).map((v) => v.agreement.id)).toEqual(['live', 'ob'])
  })

  it('ranks special-category data and more people higher within a bucket', () => {
    const small = viewOf(agreement({ id: 'small', subjectCount: 50 }), S, TODAY)
    const large = viewOf(agreement({ id: 'large', subjectCount: 5000 }), S, TODAY)
    const health = viewOf(agreement({ id: 'health', specialCategory: true, subjectCount: 10 }), S, TODAY)
    expect([small, large, health].sort(comparePriority).map((v) => v.agreement.id)).toEqual(['health', 'large', 'small'])
  })

  it('marks agreements outside the regimes as out of scope', () => {
    expect(viewOf(agreement({ exporters: ['US'] }), S, TODAY).bucket).toBe('out-of-scope')
  })
})

describe('reminder email', () => {
  it('lists what the supplier must send and numbers reminders', () => {
    let a = agreement({ exporters: ['DE', 'GB'] })
    a = request(a, 'tia', '2026-09-01')
    const email = draftEmail(viewOf(a, S, TODAY), S, TODAY)!
    expect(email.subject).toBe('Payroll: data protection documents (reminder 1)')
    expect(email.body).toContain('Transfer impact assessment (TIA): please complete our questionnaire for India (first requested 2026-09-01)')
    expect(email.body).toContain('UK Addendum to the EU SCCs')
    expect(email.body).toContain('by 2026-10-29')
  })

  it('has nothing to send when only internal work is left', () => {
    const a = agreement({ destinations: [dest('PL')], documents: { pdpa: { state: 'received', reminders: [] } } })
    expect(draftEmail(viewOf(a, S, TODAY), S, TODAY)).toBeUndefined()
  })
})

describe('sample register', () => {
  const register = sampleRegister(TODAY)

  it('has unique ids and only synthetic contacts', () => {
    expect(new Set(register.map((a) => a.id)).size).toBe(register.length)
    expect(register.every((a) => a.contactEmail.endsWith('.example'))).toBe(true)
  })

  it('covers every bucket', () => {
    const buckets = new Set(register.map((a) => viewOf(a, S, TODAY).bucket))
    for (const b of ['exposed', 'go-live', 'housekeeping', 'compliant', 'ended']) expect(buckets).toContain(b)
  })

  it('puts the health-data supplier with an outdated assessment near the top', () => {
    const queue = register.map((a) => viewOf(a, S, TODAY)).filter((v) => v.open.length && v.bucket !== 'ended').sort(comparePriority)
    expect(queue[0].agreement.specialCategory).toBe(true)
    expect(queue[0].bucket).toBe('exposed')
  })
})
