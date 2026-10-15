import { describe, expect, it } from 'vitest'
import { sampleRegister } from '../data/sample'
import { compareAgreement, PRESETS, runScenario } from './whatif'
import { DEFAULT_SETTINGS } from './types'

const TODAY = '2026-10-15'
const register = sampleRegister(TODAY)
const preset = (id: string) => PRESETS.find((p) => p.id === id)!.overrides

describe('what if', () => {
  it('finds every agreement that relies on the Data Privacy Framework', () => {
    const s = runScenario(register, preset('dpf-falls'), DEFAULT_SETTINGS, TODAY)
    const names = s.impacts.filter((i) => i.added.length).map((i) => i.agreement.supplier)
    expect(names).toContain('Northgate HR Cloud Inc')
    expect(names).toContain('ClientHub CRM Ltd')
    expect(names).not.toContain('Bharat Engineering Services Pvt Ltd')
    const northgate = s.impacts.find((i) => i.agreement.supplier === 'Northgate HR Cloud Inc')!
    expect(northgate.added.map((x) => x.requirement.key)).toEqual(expect.arrayContaining(['scc', 'uk', 'ch', 'tia', 'toms']))
    expect(northgate.dropped.map((r) => r.key)).toEqual(['dpf'])
    expect(s.documentsToRequest).toBeGreaterThan(0)
  })

  it('shows which requests a new adequacy finding would remove', () => {
    const s = runScenario(register, preset('india-adequate'), DEFAULT_SETTINGS, TODAY)
    const bharat = s.impacts.find((i) => i.agreement.supplier === 'Bharat Engineering Services Pvt Ltd')!
    expect(bharat.dropped.map((r) => r.key)).toEqual(['scc', 'tia', 'toms'])
    expect(bharat.added).toEqual([])
    expect(s.agreements).toBe(0)
  })

  it('previews the effect of a new sub-processor', () => {
    const base = register.find((a) => a.supplier === 'Bharat Engineering Services Pvt Ltd')!
    const after = {
      ...base,
      destinations: [...base.destinations, { id: 'new', entity: 'Drafting Partner', country: 'VN', kind: 'sub-processor' as const, privateSector: true }],
    }
    const impact = compareAgreement(base, after, DEFAULT_SETTINGS, TODAY)
    expect(impact.flowChanges).toEqual([{ regime: 'EU', entity: 'Drafting Partner', country: 'VN', from: 'new', to: 'safeguards' }])
    expect(impact.added.map((s) => [s.requirement.key, s.progress])).toEqual([
      ['subproc', 'not-requested'],
      ['tia', 'incomplete'],
    ])
  })
})
