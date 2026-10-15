/**
 * The three transfer regimes the tracker covers, and the territory inside which
 * personal data moves freely under each of them.
 */

export type Regime = 'EU' | 'UK' | 'CH'

export const REGIMES: Regime[] = ['EU', 'UK', 'CH']

export const EU_MEMBER_STATES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]

/**
 * The EEA: the EU plus Iceland, Liechtenstein and Norway. The EU's outermost
 * regions and the Åland Islands have their own ISO codes but are part of the EU.
 * Greenland and the Faroe Islands are not (the Faroes have an adequacy decision).
 */
export const EEA = new Set([
  ...EU_MEMBER_STATES,
  'IS', 'LI', 'NO',
  'GF', 'GP', 'MQ', 'RE', 'YT', 'MF', 'AX',
])

export interface RegimeInfo {
  regime: Regime
  name: string
  law: string
  /** What the regime calls an adequacy finding. */
  adequacyTerm: string
  /** What the regime calls a transfer impact assessment. */
  assessmentTerm: string
  transferArticle: string
  /** Statutory maximum for unlawful transfers, as a sentence. */
  transferFine: string
  /** Statutory maximum for missing processor terms, as a sentence. */
  processorFine: string
  currency: 'EUR' | 'GBP' | 'CHF'
}

export const REGIME_INFO: Record<Regime, RegimeInfo> = {
  EU: {
    regime: 'EU',
    name: 'EU/EEA',
    law: 'GDPR',
    adequacyTerm: 'adequacy decision (Art. 45 GDPR)',
    assessmentTerm: 'transfer impact assessment',
    transferArticle: 'Chapter V GDPR (Art. 44–49)',
    transferFine: 'up to €20 million or 4% of total worldwide annual turnover, whichever is higher (Art. 83(5) GDPR)',
    processorFine: 'up to €10 million or 2% of total worldwide annual turnover, whichever is higher (Art. 83(4) GDPR)',
    currency: 'EUR',
  },
  UK: {
    regime: 'UK',
    name: 'United Kingdom',
    law: 'UK GDPR',
    adequacyTerm: 'adequacy regulations (Art. 45 UK GDPR)',
    assessmentTerm: 'transfer risk assessment',
    transferArticle: 'Chapter V UK GDPR',
    transferFine: 'up to £17.5 million or 4% of total worldwide annual turnover, whichever is higher',
    processorFine: 'up to £8.7 million or 2% of total worldwide annual turnover, whichever is higher',
    currency: 'GBP',
  },
  CH: {
    regime: 'CH',
    name: 'Switzerland',
    law: 'FADP',
    adequacyTerm: 'listing in Annex 1 of the Data Protection Ordinance (Art. 16(1) FADP)',
    assessmentTerm: 'transfer impact assessment',
    transferArticle: 'Art. 16–17 FADP',
    transferFine: 'up to CHF 250,000, imposed on the responsible individuals (Art. 61 FADP)',
    processorFine: 'up to CHF 250,000, imposed on the responsible individuals (Art. 61 FADP)',
    currency: 'CHF',
  },
}

/** The regime that governs data exported from an entity in this country, if any. */
export function regimeOf(country: string): Regime | undefined {
  if (EEA.has(country)) return 'EU'
  if (country === 'GB') return 'UK'
  if (country === 'CH') return 'CH'
  return undefined
}

/** True if data moves freely to this country without being a restricted transfer. */
export function isDomestic(regime: Regime, country: string): boolean {
  switch (regime) {
    case 'EU':
      return EEA.has(country)
    case 'UK':
      return country === 'GB'
    case 'CH':
      return country === 'CH'
  }
}

/** The turnover-based part of the fine ceiling: 4% for unlawful transfers, 2% for missing processor terms. */
export function turnoverShare(tier: 'transfer' | 'processor', turnover: number): number {
  return (tier === 'transfer' ? 0.04 : 0.02) * turnover
}
