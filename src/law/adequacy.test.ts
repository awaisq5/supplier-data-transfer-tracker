import { describe, expect, it } from 'vitest'
import { ADEQUACY, type AdequacyList, listAges, RECHECK_AFTER_DAYS } from './adequacy'

const list = (regime: AdequacyList['regime'], checkedOn: string): AdequacyList => ({ ...ADEQUACY[regime], checkedOn })

describe('listAges', () => {
  it('measures each list from its own check date, oldest first', () => {
    const ages = listAges('2027-01-10', [list('EU', '2027-01-01'), list('UK', '2026-12-01'), list('CH', '2027-01-10')])
    expect(ages.map((a) => [a.list.regime, a.days])).toEqual([
      ['UK', 40],
      ['EU', 9],
      ['CH', 0],
    ])
  })

  it('marks a list overdue only after the re-check interval', () => {
    const [age] = listAges('2027-04-15', [list('EU', '2026-10-15')])
    expect(age.days).toBe(182)
    expect(age.overdue).toBe(false)
    expect(listAges('2027-04-16', [list('EU', '2026-10-15')])[0].overdue).toBe(true)
    expect(RECHECK_AFTER_DAYS).toBe(182)
  })

  it('every list in the app has a valid check date', () => {
    for (const l of Object.values(ADEQUACY)) {
      expect(l.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(l.checkedOn))).toBe(false)
    }
  })
})
