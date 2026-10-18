/**
 * Adequacy lists for the three regimes, as published by each authority.
 *
 * These lists change: the US was added to all three between 2023 and 2024,
 * Brazil to the EU list in 2026, and a court can strike a decision down, as
 * happened to the Privacy Shield in 2020. So they live here as data with a
 * source and the date they were last checked, not as logic, and the "what if"
 * view can switch any of them off.
 */

import { EEA, type Regime } from './regimes'

/**
 * Some decisions only cover part of a country's economy or only importers that
 * have signed up to a framework.
 * - full: any importer in the country
 * - private-sector: only private-sector (commercial) importers
 * - dpf: only importers certified under the Data Privacy Framework for this regime
 */
export type Scope = 'full' | 'private-sector' | 'dpf'

export interface AdequacyDecision {
  regime: Regime
  country: string
  scope: Scope
  note?: string
}

export interface AdequacyList {
  regime: Regime
  authority: string
  source: string
  /** When the list in this file was compared with the source. */
  checkedOn: string
  decisions: AdequacyDecision[]
}

const d = (regime: Regime, country: string, scope: Scope = 'full', note?: string): AdequacyDecision => ({
  regime,
  country,
  scope,
  note,
})

export const ADEQUACY: Record<Regime, AdequacyList> = {
  EU: {
    regime: 'EU',
    authority: 'European Commission',
    source:
      'https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en',
    checkedOn: '2026-10-15',
    // The list also includes the European Patent Organisation, an international
    // organisation rather than a country, so it is not modelled here.
    decisions: [
      d('EU', 'AD'),
      d('EU', 'AR'),
      d('EU', 'BR', 'full', 'Adopted January 2026.'),
      d('EU', 'CA', 'private-sector', 'Covers commercial organisations subject to PIPEDA.'),
      d('EU', 'FO'),
      d('EU', 'GG'),
      d('EU', 'IL'),
      d('EU', 'IM'),
      d('EU', 'JP', 'private-sector', 'Covers private-sector business operators under the APPI.'),
      d('EU', 'JE'),
      d('EU', 'NZ'),
      d('EU', 'KR'),
      d('EU', 'CH'),
      d('EU', 'GB', 'full', 'Renewed in December 2025, valid until 27 December 2031.'),
      d('EU', 'US', 'dpf', 'Covers organisations certified under the EU-US Data Privacy Framework.'),
      d('EU', 'UY'),
    ],
  },
  UK: {
    regime: 'UK',
    authority: 'Information Commissioner’s Office (UK adequacy regulations)',
    source:
      'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/international-transfers-a-guide/',
    checkedOn: '2026-10-15',
    decisions: [
      ...[...EEA].map((c) => d('UK', c)),
      d('UK', 'GI'),
      d('UK', 'AD'),
      d('UK', 'AR'),
      d('UK', 'FO'),
      d('UK', 'GG'),
      d('UK', 'IM'),
      d('UK', 'IL'),
      d('UK', 'JE'),
      d('UK', 'NZ'),
      d('UK', 'CH'),
      d('UK', 'UY'),
      d('UK', 'KR'),
      d('UK', 'CA', 'private-sector', 'Covers organisations subject to PIPEDA.'),
      d('UK', 'JP', 'private-sector', 'Covers private-sector personal information handling business operators under the APPI.'),
      d('UK', 'US', 'dpf', 'Covers organisations certified under the UK Extension to the EU-US Data Privacy Framework.'),
    ],
  },
  CH: {
    regime: 'CH',
    authority: 'Federal Office of Justice (Annex 1, Data Protection Ordinance)',
    source: 'https://www.bj.admin.ch/bj/en/home/staat/datenschutz/internationales/anerkennung-staaten.html',
    checkedOn: '2026-10-15',
    decisions: [
      ...[...EEA].map((c) => d('CH', c)),
      d('CH', 'GB'),
      d('CH', 'AD'),
      d('CH', 'AR'),
      d('CH', 'CA', 'private-sector', 'Covers the private sector, subject to the federal private-sector law (PIPEDA).'),
      d('CH', 'FO'),
      d('CH', 'GI'),
      d('CH', 'GG'),
      d('CH', 'IM'),
      d('CH', 'IL'),
      d('CH', 'JE'),
      d('CH', 'MC'),
      d('CH', 'NZ'),
      d('CH', 'US', 'dpf', 'Covers organisations certified under the Swiss-US Data Privacy Framework.'),
      d('CH', 'UY'),
    ],
  },
}

/** A change to the lists, for the "what if" view. */
export interface Override {
  regime: Regime
  country: string
  /** false withdraws a decision; true adds a full decision. */
  adequate: boolean
}

export type Lists = Record<Regime, Map<string, AdequacyDecision>>

export function buildLists(overrides: Override[] = []): Lists {
  const lists = {} as Lists
  for (const regime of Object.keys(ADEQUACY) as Regime[]) {
    lists[regime] = new Map(ADEQUACY[regime].decisions.map((x) => [x.country, x]))
  }
  for (const o of overrides) {
    if (o.adequate) lists[o.regime].set(o.country, d(o.regime, o.country, 'full', 'Hypothetical decision.'))
    else lists[o.regime].delete(o.country)
  }
  return lists
}

export const CURRENT_LISTS = buildLists()

/** Public milestones since 2020 that changed what suppliers had to sign. */
export const TIMELINE: { date: string; regime: Regime | 'all'; text: string }[] = [
  { date: '2020-07-16', regime: 'EU', text: 'Court of Justice invalidates the EU-US Privacy Shield (Schrems II). Transfers relying on it need SCCs plus an assessment of the destination’s laws.' },
  { date: '2021-06-04', regime: 'EU', text: 'Commission adopts new standard contractual clauses (Decision 2021/914) with four modules.' },
  { date: '2022-03-21', regime: 'UK', text: 'UK International Data Transfer Agreement (IDTA) and the UK Addendum to the EU SCCs come into force.' },
  { date: '2022-12-19', regime: 'UK', text: 'UK adequacy regulations for the Republic of Korea come into force.' },
  { date: '2022-12-27', regime: 'EU', text: 'Deadline for replacing contracts on the old SCCs with the 2021 clauses.' },
  { date: '2023-07-10', regime: 'EU', text: 'Adequacy decision for the EU-US Data Privacy Framework: only certified US organisations are covered.' },
  { date: '2023-10-12', regime: 'UK', text: 'UK Extension to the Data Privacy Framework (UK-US data bridge) takes effect.' },
  { date: '2024-09-15', regime: 'CH', text: 'Switzerland adds the US to Annex 1 for organisations certified under the Swiss-US Data Privacy Framework.' },
  { date: '2025-09-03', regime: 'EU', text: 'General Court dismisses a challenge to the EU-US Data Privacy Framework (Latombe). An appeal to the Court of Justice was lodged on 31 October 2025.' },
  { date: '2025-12-19', regime: 'EU', text: 'Commission announces the renewal of the UK adequacy decisions, valid until 27 December 2031.' },
  { date: '2026-01-26', regime: 'EU', text: 'Adequacy decision for Brazil adopted, alongside Brazil recognising the EU.' },
  { date: '2026-02-05', regime: 'UK', text: 'Data (Use and Access) Act transfer provisions in force: safeguards must give protection “not materially lower” than in the UK.' },
]

/** Re-check the lists against their sources at least this often. */
export const RECHECK_AFTER_DAYS = 182

export interface ListAge {
  list: AdequacyList
  days: number
  overdue: boolean
}

/** Age of each regime's list on `today` (YYYY-MM-DD), oldest first. */
export function listAges(today: string, lists: AdequacyList[] = Object.values(ADEQUACY)): ListAge[] {
  const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000
  return lists
    .map((list) => {
      const days = Math.max(0, Math.round(day(today) - day(list.checkedOn)))
      return { list, days, overdue: days > RECHECK_AFTER_DAYS }
    })
    .sort((a, b) => b.days - a.days)
}
