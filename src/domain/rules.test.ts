import { describe, expect, it } from 'vitest'
import { buildLists } from '../law/adequacy'
import { assessFlows, moduleFor, regimesOf, requirementsFor } from './rules'
import type { Agreement, Destination } from './types'

const dest = (country: string, extra: Partial<Destination> = {}): Destination => ({
  id: `d-${country}-${extra.kind ?? 'importer'}`,
  entity: extra.entity ?? `Supplier ${country}`,
  country,
  kind: 'importer',
  privateSector: true,
  ...extra,
})

const agreement = (over: Partial<Agreement> = {}): Agreement => ({
  id: 'A1',
  supplier: 'Supplier',
  service: 'Service',
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

const keys = (a: Agreement, lists = buildLists()) => requirementsFor(a, lists).map((r) => r.key)
const basis = (a: Agreement) => assessFlows(a).map((f) => `${f.regime}:${f.destination.country}:${f.basis}`)

describe('regimes', () => {
  it('comes from the countries of the exporting entities', () => {
    expect(regimesOf({ exporters: ['DE', 'NO', 'GB', 'CH', 'US'] })).toEqual(['EU', 'UK', 'CH'])
    expect(regimesOf({ exporters: ['US', 'AE'] })).toEqual([])
  })

  it('treats the EU outermost regions as part of the EEA', () => {
    expect(regimesOf({ exporters: ['RE'] })).toEqual(['EU'])
  })
})

describe('SCC modules', () => {
  it('follows the roles of exporter and importer', () => {
    expect(moduleFor('controller', 'controller')).toBe(1)
    expect(moduleFor('controller', 'processor')).toBe(2)
    expect(moduleFor('processor', 'processor')).toBe(3)
    expect(moduleFor('processor', 'controller')).toBe(4)
  })
})

describe('flows', () => {
  it('needs no transfer tool inside the EEA', () => {
    const a = agreement({ destinations: [dest('PL')] })
    expect(basis(a)).toEqual(['EU:PL:domestic'])
    expect(keys(a)).toEqual(['pdpa'])
  })

  it('uses adequacy where it exists', () => {
    expect(basis(agreement({ destinations: [dest('IL')] }))).toEqual(['EU:IL:adequacy'])
  })

  it('applies each regime’s own list: Brazil is adequate for the EU only', () => {
    const a = agreement({ exporters: ['DE', 'GB', 'CH'], destinations: [dest('BR')] })
    expect(basis(a)).toEqual(['EU:BR:adequacy', 'UK:BR:safeguards', 'CH:BR:safeguards'])
  })

  it('applies each regime’s own list: Japan is not on the Swiss list', () => {
    const a = agreement({ exporters: ['DE', 'GB', 'CH'], destinations: [dest('JP')] })
    expect(basis(a)).toEqual(['EU:JP:adequacy', 'UK:JP:adequacy', 'CH:JP:safeguards'])
  })

  it('treats the EEA as adequate for UK and Swiss exporters', () => {
    const a = agreement({ exporters: ['GB', 'CH'], destinations: [dest('IE')] })
    expect(basis(a)).toEqual(['UK:IE:adequacy', 'CH:IE:adequacy'])
  })

  it('covers US importers only with the matching DPF certification', () => {
    const us = dest('US', { dpf: { EU: true, UK: false, CH: false, hr: true } })
    const a = agreement({ exporters: ['DE', 'GB'], destinations: [us] })
    const flows = assessFlows(a)
    expect(flows.map((f) => f.basis)).toEqual(['adequacy', 'safeguards'])
    expect(flows[1].failedCondition).toMatch(/not certified under the UK Extension/)
  })

  it('needs HR coverage in the DPF certification for workforce data', () => {
    const us = dest('US', { dpf: { EU: true, hr: false } })
    expect(assessFlows(agreement({ destinations: [us] }))[0].basis).toBe('safeguards')
    expect(assessFlows(agreement({ destinations: [us], dataSubjects: ['customers'] }))[0].basis).toBe('adequacy')
  })

  it('limits the Canada finding to the private sector', () => {
    expect(assessFlows(agreement({ destinations: [dest('CA')] }))[0].basis).toBe('adequacy')
    expect(assessFlows(agreement({ destinations: [dest('CA', { privateSector: false })] }))[0].basis).toBe('safeguards')
  })

  it('leaves onward transfers of a controller to the supplier', () => {
    const a = agreement({
      importerRole: 'controller',
      destinations: [dest('AE'), dest('IN', { kind: 'sub-processor' })],
    })
    expect(basis(a)).toEqual(['EU:AE:safeguards', 'EU:IN:supplier-controller'])
    expect(requirementsFor(a).find((r) => r.key === 'tia')?.countries).toEqual(['AE'])
  })
})

describe('requirements', () => {
  it('asks for SCCs, TIA and TOMs for a restricted transfer', () => {
    const reqs = requirementsFor(agreement())
    expect(reqs.map((r) => r.key)).toEqual(['pdpa', 'scc', 'tia', 'toms'])
    const scc = reqs.find((r) => r.key === 'scc')!
    expect(scc.modules).toEqual([2])
    expect(scc.label).toContain('Module 2 (controller to processor)')
  })

  it('adds region-specific tools for UK and Swiss exporters', () => {
    const a = agreement({ exporters: ['DE', 'GB', 'CH'] })
    expect(keys(a)).toEqual(['pdpa', 'scc', 'uk', 'ch', 'tia', 'toms'])
    expect(requirementsFor(a).find((r) => r.key === 'uk')?.label).toBe('UK Addendum to the EU SCCs')
  })

  it('uses the IDTA when only the UK entity exports', () => {
    const a = agreement({ exporters: ['DE', 'GB'], destinations: [dest('BR')] })
    const reqs = requirementsFor(a)
    expect(reqs.map((r) => r.key)).toEqual(['pdpa', 'uk', 'tia', 'toms'])
    expect(reqs.find((r) => r.key === 'uk')?.label).toContain('IDTA')
    expect(reqs.find((r) => r.key === 'tia')?.label).toBe('Transfer risk assessment (TRA)')
  })

  it('needs sub-processor terms when an EEA supplier sends data abroad', () => {
    const a = agreement({
      destinations: [dest('IE'), dest('IN', { kind: 'sub-processor', entity: 'Sub India' }), dest('PH', { kind: 'sub-processor', entity: 'Sub PH' })],
    })
    const reqs = requirementsFor(a)
    expect(reqs.map((r) => r.key)).toEqual(['pdpa', 'subproc', 'tia', 'toms'])
    expect(reqs.find((r) => r.key === 'subproc')?.countries).toEqual(['IN', 'PH'])
  })

  it('asks for a DPF check when adequacy rests on certification', () => {
    const a = agreement({ destinations: [dest('US', { dpf: { EU: true, hr: true } })] })
    expect(keys(a)).toEqual(['pdpa', 'dpf'])
  })

  it('treats a missing PDPA as a processor-terms gap only for processors', () => {
    expect(requirementsFor(agreement())[0].tier).toBe('processor')
    expect(requirementsFor(agreement({ importerRole: 'controller' }))[0].tier).toBe('policy')
  })

  it('skips TOMs for Module 4', () => {
    const a = agreement({ exporterRole: 'processor', importerRole: 'controller' })
    expect(keys(a)).toEqual(['pdpa', 'scc', 'tia'])
  })

  it('needs nothing for agreements outside the three regimes', () => {
    expect(requirementsFor(agreement({ exporters: ['US'] }))).toEqual([])
  })

  it('follows changes to the adequacy lists', () => {
    const a = agreement({ destinations: [dest('US', { dpf: { EU: true, hr: true } })] })
    const withoutDpf = buildLists([{ regime: 'EU', country: 'US', adequate: false }])
    expect(keys(a, withoutDpf)).toEqual(['pdpa', 'scc', 'tia', 'toms'])
    const indiaAdequate = buildLists([{ regime: 'EU', country: 'IN', adequate: true }])
    expect(keys(agreement(), indiaAdequate)).toEqual(['pdpa'])
  })
})
