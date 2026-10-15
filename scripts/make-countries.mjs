// Generates src/law/countries.json: ISO 3166-1 alpha-2 code, numeric code (used by
// the world-atlas map) and a short English name. Run with `npm run countries`.
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const countries = require('i18n-iso-countries')
countries.registerLocale(require('i18n-iso-countries/langs/en.json'))

// Shorter or more familiar names than the ISO defaults.
const SHORT = {
  US: 'United States',
  GB: 'United Kingdom',
  KR: 'Republic of Korea',
  KP: 'North Korea',
  RU: 'Russia',
  IR: 'Iran',
  VN: 'Vietnam',
  TW: 'Taiwan',
  BO: 'Bolivia',
  VE: 'Venezuela',
  TZ: 'Tanzania',
  SY: 'Syria',
  LA: 'Laos',
  MD: 'Moldova',
  CZ: 'Czechia',
  CD: 'DR Congo',
  CG: 'Congo',
  FM: 'Micronesia',
  PS: 'Palestine',
  VA: 'Vatican City',
  BN: 'Brunei',
  MK: 'North Macedonia',
  CN: 'China',
  GM: 'Gambia',
  FK: 'Falkland Islands',
}

const names = countries.getNames('en', { select: 'official' })
const rows = Object.entries(names)
  .map(([code, name]) => ({
    code,
    numeric: countries.alpha2ToNumeric(code),
    name: SHORT[code] ?? name,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))

writeFileSync(new URL('../src/law/countries.json', import.meta.url), JSON.stringify(rows, null, 0).replace(/},{/g, '},\n{') + '\n')
console.log(`${rows.length} countries written`)
