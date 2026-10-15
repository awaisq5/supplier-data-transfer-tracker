/**
 * "What if" analysis: how the register changes when an adequacy finding is
 * withdrawn or added, or when a supplier adds a sub-processor.
 *
 * When the Privacy Shield fell in 2020, every company had to find out which
 * suppliers relied on it, overnight. This answers that question in advance.
 */

import { buildLists, CURRENT_LISTS, type Lists, type Override } from '../law/adequacy'
import { countryName } from '../law/countries'
import type { Regime } from '../law/regimes'
import { statusOf } from './documents'
import { assessFlows, requirementsFor } from './rules'
import type { Agreement, Basis, DocKey, Requirement, RequirementStatus, Settings } from './types'

export interface FlowChange {
  regime: Regime
  entity: string
  country: string
  from: Basis | 'new'
  to: Basis
}

export interface Impact {
  agreement: Agreement
  flowChanges: FlowChange[]
  /** New or wider requirements that current documents do not satisfy. */
  added: RequirementStatus[]
  /** Requirements that would no longer apply. */
  dropped: Requirement[]
  /** For requirements that already existed: the countries they would newly have to cover. */
  widened: Partial<Record<DocKey, string[]>>
}

function sameScope(a: Requirement, b: Requirement): boolean {
  return a.key === b.key && b.label === a.label
}

export function compareAgreement(
  before: Agreement,
  after: Agreement,
  settings: Settings,
  today: string,
  listsBefore: Lists = CURRENT_LISTS,
  listsAfter: Lists = CURRENT_LISTS,
): Impact {
  const fb = assessFlows(before, listsBefore)
  const fa = assessFlows(after, listsAfter)
  const key = (f: { regime: Regime; destination: { id: string } }) => `${f.regime}|${f.destination.id}`
  const prev = new Map(fb.map((f) => [key(f), f]))
  const flowChanges: FlowChange[] = []
  for (const f of fa) {
    const p = prev.get(key(f))
    if (p && p.basis === f.basis) continue
    flowChanges.push({
      regime: f.regime,
      entity: f.destination.entity,
      country: f.destination.country,
      from: p ? p.basis : 'new',
      to: f.basis,
    })
  }

  const rb = requirementsFor(before, listsBefore)
  const ra = requirementsFor(after, listsAfter)
  const added: RequirementStatus[] = []
  const widened: Partial<Record<DocKey, string[]>> = {}
  for (const r of ra) {
    const old = rb.find((x) => x.key === r.key)
    const newCountries = old ? (r.countries ?? []).filter((c) => !(old.countries ?? []).includes(c)) : []
    const wider = !old || !sameScope(old, r) || newCountries.length > 0
    if (!wider) continue
    const st = statusOf(r, after.documents[r.key], settings, today)
    if (st.progress === 'done') continue
    added.push(st)
    if (old && newCountries.length) widened[r.key] = newCountries
  }
  const dropped = rb.filter((r) => !ra.some((x) => x.key === r.key))
  return { agreement: after, flowChanges, added, dropped, widened }
}

export interface Scenario {
  impacts: Impact[]
  agreements: number
  live: number
  specialCategory: number
  people: number
  documentsToRequest: number
}

export function runScenario(agreements: Agreement[], overrides: Override[], settings: Settings, today: string): Scenario {
  const after = buildLists(overrides)
  const impacts = agreements
    .filter((a) => a.status !== 'ended')
    .map((a) => compareAgreement(a, a, settings, today, CURRENT_LISTS, after))
    .filter((i) => i.flowChanges.length || i.added.length || i.dropped.length)
  const hit = impacts.filter((i) => i.added.length)
  return {
    impacts,
    agreements: hit.length,
    live: hit.filter((i) => i.agreement.status === 'live').length,
    specialCategory: hit.filter((i) => i.agreement.specialCategory).length,
    people: hit.reduce((n, i) => n + i.agreement.subjectCount, 0),
    documentsToRequest: hit.reduce((n, i) => n + i.added.filter((s) => s.requirement.supplierAction).length, 0),
  }
}

export interface Preset {
  id: string
  label: string
  description: string
  overrides: Override[]
}

export const PRESETS: Preset[] = [
  {
    id: 'dpf-falls',
    label: 'The EU-US Data Privacy Framework is struck down',
    description:
      'As happened to Safe Harbor in 2015 and the Privacy Shield in 2020. A challenge was dismissed in 2025 and is under appeal. The UK Extension depends on the EU framework and the Swiss one mirrors it, so all three are switched off here.',
    overrides: [
      { regime: 'EU', country: 'US', adequate: false },
      { regime: 'UK', country: 'US', adequate: false },
      { regime: 'CH', country: 'US', adequate: false },
    ],
  },
  {
    id: 'uk-lapses',
    label: 'The EU’s UK adequacy decision lapses',
    description: 'EU entities sending data to UK suppliers would need SCCs and transfer impact assessments.',
    overrides: [{ regime: 'EU', country: 'GB', adequate: false }],
  },
  {
    id: 'india-adequate',
    label: 'India receives an EU adequacy decision (hypothetical)',
    description: 'Shows which document requests would no longer be needed. No such decision exists.',
    overrides: [{ regime: 'EU', country: 'IN', adequate: true }],
  },
  {
    id: 'brazil-uk-ch',
    label: 'The UK and Switzerland follow the EU on Brazil (hypothetical)',
    description: 'The EU recognised Brazil in 2026; the UK and Swiss lists have not followed yet.',
    overrides: [
      { regime: 'UK', country: 'BR', adequate: true },
      { regime: 'CH', country: 'BR', adequate: true },
    ],
  },
]

export function describeOverride(o: Override): string {
  const who = o.regime === 'EU' ? 'EU' : o.regime === 'UK' ? 'UK' : 'Swiss'
  return o.adequate ? `${who} finding for ${countryName(o.country)} added` : `${who} finding for ${countryName(o.country)} withdrawn`
}
