/**
 * The rules engine: for each supplier agreement, how each flow of personal data
 * is lawful, and which documents that takes.
 *
 * A flow is one exporting regime (EU, UK or Switzerland, from the countries of
 * our entities that send data) to one place where the supplier or one of its
 * sub-processors handles the data. Each flow is either domestic, covered by an
 * adequacy finding, the supplier's own business (when it acts as a controller),
 * or a restricted transfer that needs safeguards.
 */

import { CURRENT_LISTS, type Lists } from '../law/adequacy'
import { capitalise, countryName, proseName } from '../law/countries'
import { isDomestic, regimeOf, type Regime, REGIMES } from '../law/regimes'
import { type Agreement, type Destination, type FlowAssessment, HR_SUBJECTS, type Requirement, type Role } from './types'

export const MODULE_NAMES: Record<number, string> = {
  1: 'controller to controller',
  2: 'controller to processor',
  3: 'processor to processor',
  4: 'processor to controller',
}

export function moduleFor(exporter: Role, importer: Role): number {
  if (exporter === 'controller') return importer === 'controller' ? 1 : 2
  return importer === 'processor' ? 3 : 4
}

/** The regimes an agreement falls under, from the countries of the entities that send data. */
export function regimesOf(agreement: Pick<Agreement, 'exporters'>): Regime[] {
  const found = new Set(agreement.exporters.map(regimeOf).filter((r): r is Regime => r !== undefined))
  return REGIMES.filter((r) => found.has(r))
}

export function handlesHrData(agreement: Pick<Agreement, 'dataSubjects'>): boolean {
  return agreement.dataSubjects.some((s) => HR_SUBJECTS.has(s))
}

const DPF_NAME: Record<Regime, string> = {
  EU: 'the EU-US Data Privacy Framework',
  UK: 'the UK Extension to the Data Privacy Framework',
  CH: 'the Swiss-US Data Privacy Framework',
}

function regimeLabel(regime: Regime): string {
  return regime === 'EU' ? 'EU' : regime === 'UK' ? 'UK' : 'Swiss'
}

function covered(regime: Regime, Place: string): string {
  if (regime === 'EU') return `${Place} has an EU adequacy decision (Art. 45 GDPR).`
  if (regime === 'UK') return `${Place} is covered by UK adequacy regulations.`
  return `${Place} is on the Swiss list of adequate countries (Annex 1 DPO).`
}

function notCovered(regime: Regime, Place: string): string {
  if (regime === 'EU') return `${Place} has no EU adequacy decision`
  if (regime === 'UK') return `${Place} is not covered by UK adequacy regulations`
  return `${Place} is not on the Swiss list of adequate countries`
}

export function assessFlow(
  agreement: Agreement,
  regime: Regime,
  destination: Destination,
  lists: Lists = CURRENT_LISTS,
): FlowAssessment {
  const place = proseName(destination.country)
  const Place = capitalise(place)
  const base = { regime, destination }

  if (destination.kind === 'sub-processor' && agreement.importerRole === 'controller') {
    return {
      ...base,
      basis: 'supplier-controller',
      reason: `The supplier acts as a controller, so passing data to ${destination.entity} in ${place} is its own transfer and its own responsibility.`,
    }
  }

  if (isDomestic(regime, destination.country)) {
    const area = regime === 'EU' ? 'the EEA' : regime === 'UK' ? 'the UK' : 'Switzerland'
    return { ...base, basis: 'domestic', reason: `${Place} is inside ${area}: no restricted transfer.` }
  }

  const decision = lists[regime].get(destination.country)
  const restricted = (failedCondition?: string): FlowAssessment => ({
    ...base,
    basis: 'safeguards',
    failedCondition,
    reason: failedCondition
      ? `${failedCondition} The transfer needs safeguards such as SCCs.`
      : `${notCovered(regime, Place)}, so the transfer needs safeguards such as SCCs.`,
  })

  if (!decision) return restricted()

  const adequate = (extra = ''): FlowAssessment => ({
    ...base,
    basis: 'adequacy',
    reason: `${covered(regime, Place)}${extra}`,
  })

  switch (decision.scope) {
    case 'full':
      return adequate()
    case 'private-sector':
      return destination.privateSector
        ? adequate(` ${decision.note ?? ''}`.trimEnd())
        : restricted(`The ${regimeLabel(regime)} finding for ${place} covers only the private sector, and ${destination.entity} is not a private-sector organisation.`)
    case 'dpf': {
      const certified = destination.dpf?.[regime] === true
      if (!certified) return restricted(`${destination.entity} is not certified under ${DPF_NAME[regime]}.`)
      if (handlesHrData(agreement) && !destination.dpf?.hr) {
        return restricted(`${destination.entity} is certified under ${DPF_NAME[regime]}, but not for HR data, and this agreement covers workforce data.`)
      }
      return {
        ...base,
        basis: 'adequacy',
        reason: `${destination.entity} is certified under ${DPF_NAME[regime]}, so the ${regimeLabel(regime)} adequacy finding for the United States covers it.`,
      }
    }
  }
}

export function assessFlows(agreement: Agreement, lists: Lists = CURRENT_LISTS): FlowAssessment[] {
  return regimesOf(agreement).flatMap((regime) => agreement.destinations.map((d) => assessFlow(agreement, regime, d, lists)))
}

const list = (codes: string[]) => joinAnd(codes.map(proseName))

const unique = <T,>(xs: T[]) => [...new Set(xs)]

const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** The documents an agreement needs, derived from its flows. */
export function requirementsFor(agreement: Agreement, lists: Lists = CURRENT_LISTS): Requirement[] {
  const regimes = regimesOf(agreement)
  if (regimes.length === 0) return []
  const flows = assessFlows(agreement, lists)
  const reqs: Requirement[] = []
  const isProcessor = agreement.importerRole === 'processor'

  reqs.push({
    key: 'pdpa',
    label: 'Privacy and data protection appendix (PDPA)',
    tier: isProcessor ? 'processor' : 'policy',
    regimes,
    supplierAction: true,
    why: isProcessor
      ? `The supplier processes personal data on our behalf, so the contract needs processor terms (${[
          regimes.includes('EU') || regimes.includes('UK') ? `Art. 28 ${regimes.includes('EU') ? 'GDPR' : 'UK GDPR'}` : '',
          regimes.includes('CH') ? 'Art. 9 FADP' : '',
        ]
          .filter(Boolean)
          .join(', ')}).`
      : 'The supplier receives personal data as a controller; the appendix limits what it may do with it.',
  })

  const safeguards = flows.filter((f) => f.basis === 'safeguards')
  const direct = safeguards.filter((f) => f.destination.kind === 'importer')
  const viaSub = safeguards.filter((f) => f.destination.kind === 'sub-processor')
  const directRegimes = REGIMES.filter((r) => direct.some((f) => f.regime === r))
  const module = moduleFor(agreement.exporterRole, agreement.importerRole)

  const needsScc = directRegimes.includes('EU') || directRegimes.includes('CH')
  if (needsScc) {
    const sccRegimes = directRegimes.filter((r) => r !== 'UK')
    const countries = unique(direct.filter((f) => f.regime !== 'UK').map((f) => f.destination.country))
    reqs.push({
      key: 'scc',
      label: `EU standard contractual clauses, Module ${module} (${MODULE_NAMES[module]})`,
      tier: 'transfer',
      regimes: sccRegimes,
      modules: [module],
      countries,
      supplierAction: true,
      why: `Data goes to ${list(countries)} without an adequacy finding for ${sccRegimes.map(regimeLabel).join(' and ')} exporters. The 2021 SCCs (Decision 2021/914) are the usual safeguard (Art. 46(2)(c) GDPR).`,
    })
  }
  if (directRegimes.includes('UK')) {
    const countries = unique(direct.filter((f) => f.regime === 'UK').map((f) => f.destination.country))
    reqs.push({
      key: 'uk',
      label: needsScc ? 'UK Addendum to the EU SCCs' : 'UK International Data Transfer Agreement (IDTA)',
      tier: 'transfer',
      regimes: ['UK'],
      countries,
      supplierAction: true,
      why: needsScc
        ? `Our UK entity also sends data to ${list(countries)}. UK law does not accept the EU SCCs on their own; the ICO's Addendum adapts them.`
        : `Our UK entity sends data to ${list(countries)}, which UK adequacy regulations do not cover. The IDTA is the UK's own safeguard.`,
    })
  }
  if (directRegimes.includes('CH')) {
    const countries = unique(direct.filter((f) => f.regime === 'CH').map((f) => f.destination.country))
    reqs.push({
      key: 'ch',
      label: 'Swiss amendments to the EU SCCs',
      tier: 'transfer',
      regimes: ['CH'],
      countries,
      supplierAction: true,
      why: `Our Swiss entity sends data to ${list(countries)}, which is not on the Swiss list. The FDPIC accepts the EU SCCs for Swiss transfers once they are adapted to the FADP.`,
    })
  }

  if (viaSub.length) {
    const countries = unique(viaSub.map((f) => f.destination.country))
    const entities = unique(viaSub.map((f) => `${f.destination.entity} (${countryName(f.destination.country)})`))
    reqs.push({
      key: 'subproc',
      label: 'Sub-processor transfer terms (SCC Module 3 or equivalent)',
      tier: 'transfer',
      regimes: REGIMES.filter((r) => viaSub.some((f) => f.regime === r)),
      countries,
      supplierAction: true,
      why: `The supplier passes our data to ${joinAnd(entities)}. It must bind them to the same protection (Art. 28(4) GDPR, Clause 9 SCCs) and show us the terms.`,
    })
  }

  if (safeguards.length) {
    const countries = unique(safeguards.map((f) => f.destination.country))
    const ukOnly = safeguards.every((f) => f.regime === 'UK')
    reqs.push({
      key: 'tia',
      label: ukOnly ? 'Transfer risk assessment (TRA)' : 'Transfer impact assessment (TIA)',
      tier: 'transfer',
      regimes: REGIMES.filter((r) => safeguards.some((f) => f.regime === r)),
      countries,
      supplierAction: true,
      why: `Safeguards only work if the law in ${list(countries)} lets the supplier keep them. The supplier's answers to our questionnaire feed the assessment (${[
        safeguards.some((f) => f.regime !== 'UK') ? 'Clause 14 SCCs' : '',
        safeguards.some((f) => f.regime === 'UK') ? 'for UK exporters, the "not materially lower" test' : '',
      ]
        .filter(Boolean)
        .join('; ')}).`,
    })
    if (module !== 4) {
      reqs.push({
        key: 'toms',
        label: 'Technical and organisational measures (TOMs, SCC Annex II)',
        tier: 'transfer',
        regimes: REGIMES.filter((r) => safeguards.some((f) => f.regime === r)),
        supplierAction: true,
        why: 'Annex II of the SCCs lists the security measures the supplier applies; the assessment relies on them.',
      })
    }
  }

  const viaDpf = flows.filter((f) => f.basis === 'adequacy' && f.destination.country === 'US')
  if (viaDpf.length) {
    reqs.push({
      key: 'dpf',
      label: 'Data Privacy Framework certification check',
      tier: 'verification',
      regimes: unique(viaDpf.map((f) => f.regime)),
      supplierAction: false,
      why: 'Adequacy covers US importers only while their certification is active. Check the Data Privacy Framework list and record the date.',
    })
  }

  return reqs
}

export const DOC_ORDER: Record<string, number> = { pdpa: 0, scc: 1, uk: 2, ch: 3, subproc: 4, tia: 5, toms: 6, dpf: 7 }
