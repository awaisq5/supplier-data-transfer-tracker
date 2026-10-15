import { describe, expect, it } from 'vitest'
import { sampleRegister } from '../data/sample'
import { exportCsv, importCsv, parseDate, TEMPLATE_CSV } from './csv'
import { viewOf } from './documents'
import { DEFAULT_SETTINGS } from './types'

const HEADER = 'agreement_id,supplier,service,exporters,exporter_role,importer_role,data_subjects,special_category,data_subject_count,destination_entity,destination_country,destination_type,dpf,tia_approved,tia_covers'

describe('dates', () => {
  it('accepts ISO and German dates and rejects impossible ones', () => {
    expect(parseDate('2026-03-01')).toBe('2026-03-01')
    expect(parseDate('1.3.2026')).toBe('2026-03-01')
    expect(parseDate('31.02.2026')).toBeUndefined()
    expect(parseDate('03/2026')).toBeUndefined()
  })
})

describe('import', () => {
  it('reads an agreement spread over several rows, with country names', () => {
    const csv = [
      HEADER,
      'A1,Kestrel Desk Ltd,Service desk,"Germany; UK",controller,processor,employees,no,"21,000",,Ireland,importer,,12.01.2026,"India; PH"',
      'A1,,,,,,,,,Kestrel India,India,sub-processor,,,',
      'A1,,,,,,,,,Kestrel PH,Philippines,subprocessor,,,',
    ].join('\n')
    const { agreements, issues } = importCsv(csv)
    expect(issues.filter((i) => i.level === 'error')).toEqual([])
    expect(agreements).toHaveLength(1)
    const a = agreements[0]
    expect(a.exporters).toEqual(['DE', 'GB'])
    expect(a.subjectCount).toBe(21000)
    expect(a.destinations.map((d) => `${d.entity}:${d.country}:${d.kind}`)).toEqual([
      'Kestrel Desk Ltd:IE:importer',
      'Kestrel India:IN:sub-processor',
      'Kestrel PH:PH:sub-processor',
    ])
    expect(a.documents.tia).toMatchObject({ state: 'approved', approvedOn: '2026-01-12', covers: ['IN', 'PH'] })
  })

  it('reports problems by row', () => {
    const csv = [
      HEADER,
      'A1,Supplier,Svc,DE,controller,procesor,employees,maybe,12,,Indai,,,,',
      'A1,Supplier,Other service,DE,controller,processor,employees,no,12,,India,,,,',
      'A2,US only,Svc,US,controller,processor,employees,no,1,,India,,,,',
    ].join('\n')
    const { issues } = importCsv(csv)
    const text = issues.map((i) => `${i.row} ${i.level}: ${i.message}`)
    expect(text).toContain('2 error: `importer_role` must be controller or processor, not "procesor".')
    expect(text).toContain('2 error: `special_category` must be yes or no, not "maybe".')
    expect(text).toContain('2 error: Unknown destination country "Indai".')
    expect(text).toContain('3 error: `service` differs from row 2 of agreement A1.')
    expect(text).toContain('4 warning: Agreement A2 has no exporter in the EEA, the UK or Switzerland, so it is out of scope.')
  })

  it('rejects a file without the key columns', () => {
    const { issues, agreements } = importCsv('supplier,country\nX,India\n')
    expect(agreements).toEqual([])
    expect(issues.some((i) => i.message === 'Missing column `agreement_id`.')).toBe(true)
  })

  it('reads DPF certifications for US importers', () => {
    const csv = [HEADER, 'A1,Northgate,HR,DE,controller,processor,employees,no,10,,US,,EU;HR,,'].join('\n')
    const a = importCsv(csv).agreements[0]
    expect(a.destinations[0].dpf).toEqual({ EU: true, UK: false, CH: false, hr: true })
  })
})

describe('export', () => {
  it('round-trips the register’s structure and approvals', () => {
    const today = '2026-10-15'
    const register = sampleRegister(today)
    const { agreements, issues } = importCsv(exportCsv(register))
    expect(issues.filter((i) => i.level === 'error')).toEqual([])
    expect(agreements).toHaveLength(register.length)
    for (let i = 0; i < register.length; i++) {
      const a = register[i]
      const b = agreements[i]
      expect(b.destinations.map((d) => [d.entity, d.country, d.kind, d.privateSector])).toEqual(
        a.destinations.map((d) => [d.entity, d.country, d.kind, d.privateSector]),
      )
      expect(b.exporters).toEqual(a.exporters)
      // Approved documents survive, so complete agreements stay complete.
      const before = viewOf(a, DEFAULT_SETTINGS, today)
      const after = viewOf(b, DEFAULT_SETTINGS, today)
      if (before.bucket === 'compliant') expect(after.bucket).toBe('compliant')
    }
  })
})

describe('template', () => {
  it('imports cleanly and describes a complete agreement', () => {
    const { agreements, issues } = importCsv(TEMPLATE_CSV)
    expect(issues).toEqual([])
    expect(agreements).toHaveLength(1)
    expect(viewOf(agreements[0], DEFAULT_SETTINGS, '2026-10-15').bucket).toBe('compliant')
  })
})
