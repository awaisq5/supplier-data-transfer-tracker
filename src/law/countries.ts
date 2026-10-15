import rows from './countries.json'

export interface Country {
  code: string
  numeric: string
  name: string
}

export const COUNTRIES: Country[] = rows

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]))
const BY_NAME = new Map(COUNTRIES.map((c) => [fold(c.name), c]))

// Common alternative spellings seen in supplier registers.
const ALIASES: Record<string, string> = {
  usa: 'US',
  'united states of america': 'US',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  scotland: 'GB',
  'south korea': 'KR',
  korea: 'KR',
  turkey: 'TR',
  uae: 'AE',
  "people's republic of china": 'CN',
  'czech republic': 'CZ',
  holland: 'NL',
  'the netherlands': 'NL',
  'russian federation': 'RU',
  'ivory coast': 'CI',
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

export function countryName(code: string): string {
  return BY_CODE.get(code)?.name ?? code
}

const WITH_ARTICLE = new Set(['PH', 'US', 'GB', 'AE', 'NL', 'BS', 'GM', 'CD', 'CG', 'FO', 'KY', 'MV', 'MH', 'SB', 'VA', 'VG', 'VI', 'TC', 'FK', 'CK'])

/** A country name for use inside a sentence: "the Philippines", "India". */
export function proseName(code: string): string {
  return WITH_ARTICLE.has(code) ? `the ${countryName(code)}` : countryName(code)
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function isCountryCode(code: string): boolean {
  return BY_CODE.has(code)
}

/** Resolves an ISO alpha-2 code or an English name ("India", "USA") to a code. */
export function resolveCountry(input: string): string | undefined {
  const s = input.trim()
  if (!s) return undefined
  if (/^[A-Za-z]{2}$/.test(s) && BY_CODE.has(s.toUpperCase())) return s.toUpperCase()
  const f = fold(s)
  return BY_NAME.get(f)?.code ?? ALIASES[f]
}

export function numericToCode(numeric: string): string | undefined {
  return NUMERIC.get(numeric)
}

const NUMERIC = new Map(COUNTRIES.map((c) => [c.numeric, c.code]))
