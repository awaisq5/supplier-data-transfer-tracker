/**
 * Register import and export as CSV, one row per destination.
 *
 * A supplier register usually lives in a spreadsheet, so the import accepts
 * what spreadsheets produce: country names or ISO codes, German or ISO dates,
 * yes/no flags. Agreement fields repeat on each of an agreement's rows and must
 * agree. Approval dates of documents can be carried over; the finer history
 * (requests, reminders) is kept only in the JSON backup.
 */

import Papa from 'papaparse'
import { countryName, resolveCountry } from '../law/countries'
import { regimeOf } from '../law/regimes'
import { requirementsFor } from './rules'
import { type Agreement, type AgreementStatus, DATA_SUBJECTS, type DataSubject, type Destination, type DocKey, type DocRecord, type Role } from './types'

export const COLUMNS = [
  'agreement_id',
  'supplier',
  'service',
  'contact_email',
  'analyst',
  'status',
  'go_live',
  'exporters',
  'exporter_role',
  'importer_role',
  'data_subjects',
  'special_category',
  'data_subject_count',
  'destination_entity',
  'destination_country',
  'destination_type',
  'private_sector',
  'dpf',
  'pdpa_signed',
  'scc_signed',
  'scc_modules',
  'uk_signed',
  'ch_signed',
  'subproc_approved',
  'subproc_covers',
  'tia_approved',
  'tia_covers',
  'toms_approved',
  'dpf_checked',
] as const

type Column = (typeof COLUMNS)[number]
type Row = Partial<Record<Column, string>>

const AGREEMENT_FIELDS: Column[] = [
  'supplier',
  'service',
  'contact_email',
  'analyst',
  'status',
  'go_live',
  'exporters',
  'exporter_role',
  'importer_role',
  'data_subjects',
  'special_category',
  'data_subject_count',
]

const DOC_COLUMNS: { key: DocKey; date: Column; extra?: Column }[] = [
  { key: 'pdpa', date: 'pdpa_signed' },
  { key: 'scc', date: 'scc_signed', extra: 'scc_modules' },
  { key: 'uk', date: 'uk_signed' },
  { key: 'ch', date: 'ch_signed' },
  { key: 'subproc', date: 'subproc_approved', extra: 'subproc_covers' },
  { key: 'tia', date: 'tia_approved', extra: 'tia_covers' },
  { key: 'toms', date: 'toms_approved' },
  { key: 'dpf', date: 'dpf_checked' },
]

export interface Issue {
  row: number
  level: 'error' | 'warning'
  message: string
}

export interface ImportResult {
  agreements: Agreement[]
  issues: Issue[]
  rowsRead: number
}

const split = (s: string | undefined) =>
  (s ?? '')
    .split(/[;,|]/)
    .map((x) => x.trim())
    .filter(Boolean)

export function parseDate(s: string): string | undefined {
  const t = s.trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  let iso: string | undefined
  if (m) iso = `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(t)
  if (m) iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  if (!iso) return undefined
  const d = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : undefined
}

function parseFlag(s: string | undefined, fallback: boolean): boolean | undefined {
  const t = (s ?? '').trim().toLowerCase()
  if (!t) return fallback
  if (['yes', 'y', 'true', '1', 'ja', 'x'].includes(t)) return true
  if (['no', 'n', 'false', '0', 'nein'].includes(t)) return false
  return undefined
}

export function importCsv(text: string): ImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'),
  })
  const issues: Issue[] = []
  const rows = parsed.data as Row[]
  const fields = parsed.meta.fields ?? []

  const unknown = fields.filter((f) => !(COLUMNS as readonly string[]).includes(f))
  if (unknown.length) issues.push({ row: 1, level: 'warning', message: `Ignored unknown column${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}.` })
  for (const req of ['agreement_id', 'supplier', 'exporters', 'exporter_role', 'importer_role', 'destination_country'] as const) {
    if (!fields.includes(req)) issues.push({ row: 1, level: 'error', message: `Missing column \`${req}\`.` })
  }
  if (issues.some((i) => i.level === 'error')) return { agreements: [], issues, rowsRead: rows.length }

  const byId = new Map<string, { firstRow: number; rows: { row: Row; n: number }[] }>()
  rows.forEach((row, i) => {
    const n = i + 2
    const id = (row.agreement_id ?? '').trim()
    if (!id) {
      issues.push({ row: n, level: 'error', message: '`agreement_id` is empty.' })
      return
    }
    const g = byId.get(id)
    if (g) g.rows.push({ row, n })
    else byId.set(id, { firstRow: n, rows: [{ row, n }] })
  })

  const agreements: Agreement[] = []
  for (const [id, g] of byId) {
    const n = g.firstRow
    const err = (message: string, row = n) => issues.push({ row, level: 'error', message })

    // Agreement fields may be filled on one row only, but where filled they must agree.
    const r: Row = {}
    for (const f of AGREEMENT_FIELDS) {
      const filled = g.rows.filter(({ row }) => (row[f] ?? '').trim() !== '')
      const values = new Set(filled.map(({ row }) => row[f]!.trim()))
      if (values.size > 1) {
        const other = filled.find(({ row }) => row[f]!.trim() !== filled[0].row[f]!.trim())!
        err(`\`${f}\` differs from row ${filled[0].n} of agreement ${id}.`, other.n)
      }
      if (filled.length) r[f] = filled[0].row[f]!.trim()
    }

    const exporters: string[] = []
    for (const e of split(r.exporters)) {
      const c = resolveCountry(e)
      if (!c) err(`Unknown exporter country "${e}".`)
      else if (!exporters.includes(c)) exporters.push(c)
    }
    if (!exporters.length) err('`exporters` lists no country.')
    else if (!exporters.some((c) => regimeOf(c))) {
      issues.push({ row: n, level: 'warning', message: `Agreement ${id} has no exporter in the EEA, the UK or Switzerland, so it is out of scope.` })
    }

    const role = (col: 'exporter_role' | 'importer_role'): Role => {
      const v = (r[col] ?? '').trim().toLowerCase()
      if (v === 'controller' || v === 'processor') return v
      err(`\`${col}\` must be controller or processor, not "${r[col] ?? ''}".`)
      return 'controller'
    }
    const exporterRole = role('exporter_role')
    const importerRole = role('importer_role')

    const statusRaw = (r.status ?? '').trim().toLowerCase() || 'live'
    let status: AgreementStatus = 'live'
    if (statusRaw === 'live' || statusRaw === 'onboarding' || statusRaw === 'ended') status = statusRaw
    else err(`\`status\` must be live, onboarding or ended, not "${r.status}".`)

    let goLive: string | undefined
    if ((r.go_live ?? '').trim()) {
      goLive = parseDate(r.go_live!)
      if (!goLive) err(`\`go_live\` "${r.go_live}" is not a date (use YYYY-MM-DD or DD.MM.YYYY).`)
    }

    const dataSubjects: DataSubject[] = []
    for (const s of split(r.data_subjects)) {
      const v = s.toLowerCase() as DataSubject
      if (DATA_SUBJECTS.includes(v)) dataSubjects.push(v)
      else err(`Unknown data subject "${s}". Use: ${DATA_SUBJECTS.join(', ')}.`)
    }
    const special = parseFlag(r.special_category, false)
    if (special === undefined) err(`\`special_category\` must be yes or no, not "${r.special_category}".`)
    const countRaw = (r.data_subject_count ?? '').replace(/[\s.,']/g, '')
    const subjectCount = countRaw ? Number(countRaw) : 0
    if (!Number.isInteger(subjectCount) || subjectCount < 0) err(`\`data_subject_count\` "${r.data_subject_count}" is not a whole number.`)

    const destinations: Destination[] = []
    const seen = new Set<string>()
    g.rows.forEach(({ row, n: rn }, i) => {
      const country = resolveCountry(row.destination_country ?? '')
      if (!country) {
        err(`Unknown destination country "${row.destination_country ?? ''}".`, rn)
        return
      }
      const typeRaw = (row.destination_type ?? '').trim().toLowerCase().replace(/[\s_]/g, '-')
      const kind = !typeRaw || typeRaw === 'importer' || typeRaw === 'supplier' ? 'importer' : typeRaw === 'sub-processor' || typeRaw === 'subprocessor' ? 'sub-processor' : undefined
      if (!kind) {
        err(`\`destination_type\` must be importer or sub-processor, not "${row.destination_type}".`, rn)
        return
      }
      const entity = (row.destination_entity ?? '').trim() || (kind === 'importer' ? (r.supplier ?? '').trim() : '')
      if (!entity) {
        err('`destination_entity` is needed for a sub-processor.', rn)
        return
      }
      const dupKey = `${entity.toLowerCase()}|${country}|${kind}`
      if (seen.has(dupKey)) {
        issues.push({ row: rn, level: 'warning', message: `Duplicate destination ${entity} in ${countryName(country)} skipped.` })
        return
      }
      seen.add(dupKey)
      const privateSector = parseFlag(row.private_sector, true)
      if (privateSector === undefined) err(`\`private_sector\` must be yes or no, not "${row.private_sector}".`, rn)
      const dpfTokens = split(row.dpf).map((t) => t.toUpperCase())
      const badDpf = dpfTokens.filter((t) => !['EU', 'UK', 'CH', 'HR'].includes(t))
      if (badDpf.length) err(`\`dpf\` may list EU, UK, CH and HR, not ${badDpf.join(', ')}.`, rn)
      if (dpfTokens.length && country !== 'US') {
        issues.push({ row: rn, level: 'warning', message: `DPF certification only matters for US importers; ignored for ${countryName(country)}.` })
      }
      const dest: Destination = { id: `${id}-d${i + 1}`, entity, country, kind, privateSector: privateSector ?? true }
      if (dpfTokens.length && country === 'US') {
        dest.dpf = {
          EU: dpfTokens.includes('EU'),
          UK: dpfTokens.includes('UK'),
          CH: dpfTokens.includes('CH'),
          hr: dpfTokens.includes('HR'),
        }
      }
      destinations.push(dest)
    })
    if (!destinations.some((d) => d.kind === 'importer') && destinations.length) {
      issues.push({ row: n, level: 'warning', message: `Agreement ${id} lists only sub-processors; add a row for the supplier itself.` })
    }

    const documents: Partial<Record<DocKey, DocRecord>> = {}
    for (const dc of DOC_COLUMNS) {
      const values = g.rows.map(({ row }) => (row[dc.date] ?? '').trim()).filter(Boolean)
      if (!values.length) continue
      if (new Set(values).size > 1) err(`\`${dc.date}\` has different dates on the rows of agreement ${id}.`)
      const date = parseDate(values[0])
      if (!date) {
        err(`\`${dc.date}\` "${values[0]}" is not a date (use YYYY-MM-DD or DD.MM.YYYY).`)
        continue
      }
      const rec: DocRecord = { state: 'approved', reminders: [], receivedOn: date, approvedOn: date }
      if (dc.extra) {
        const extra = g.rows.map(({ row }) => (row[dc.extra!] ?? '').trim()).find(Boolean) ?? ''
        if (dc.key === 'scc') {
          const mods = split(extra).map(Number)
          if (mods.some((m) => ![1, 2, 3, 4].includes(m))) err(`\`scc_modules\` must list modules 1 to 4, not "${extra}".`)
          rec.modules = mods.length ? mods : undefined
        } else {
          const covers: string[] = []
          for (const c of split(extra)) {
            const code = resolveCountry(c)
            if (code) covers.push(code)
            else err(`Unknown country "${c}" in \`${dc.extra}\`.`)
          }
          rec.covers = covers
        }
      }
      documents[dc.key] = rec
    }

    const agreement: Agreement = {
      id,
      supplier: (r.supplier ?? '').trim(),
      service: (r.service ?? '').trim() || (r.supplier ?? '').trim(),
      contactEmail: (r.contact_email ?? '').trim(),
      analyst: (r.analyst ?? '').trim(),
      status,
      goLive,
      exporters,
      exporterRole,
      importerRole,
      dataSubjects,
      specialCategory: special ?? false,
      subjectCount: Number.isInteger(subjectCount) ? subjectCount : 0,
      destinations,
      documents,
    }
    // An SCC record without modules is taken to cover what the agreement needs.
    const scc = agreement.documents.scc
    if (scc && !scc.modules) scc.modules = requirementsFor(agreement).find((q) => q.key === 'scc')?.modules
    const tia = agreement.documents.tia
    if (tia && !tia.covers?.length) {
      issues.push({ row: n, level: 'warning', message: `Agreement ${id}: \`tia_covers\` is empty, so the assessment covers no country yet.` })
    }
    agreements.push(agreement)
  }

  issues.sort((a, b) => a.row - b.row)
  return { agreements, issues, rowsRead: rows.length }
}

function dpfTokens(d: Destination): string[] {
  if (!d.dpf) return []
  const out: string[] = (['EU', 'UK', 'CH'] as const).filter((k) => d.dpf?.[k])
  if (d.dpf.hr) out.push('HR')
  return out
}

export function exportCsv(agreements: Agreement[]): string {
  const rows: Record<string, string>[] = []
  for (const a of agreements) {
    const docs: Record<string, string> = {}
    for (const dc of DOC_COLUMNS) {
      const r = a.documents[dc.key]
      if (r?.state !== 'approved' || !r.approvedOn) continue
      docs[dc.date] = r.approvedOn
      if (dc.key === 'scc' && r.modules) docs.scc_modules = r.modules.join(';')
      if ((dc.key === 'tia' || dc.key === 'subproc') && r.covers) docs[dc.extra!] = r.covers.join(';')
    }
    a.destinations.forEach((d, i) => {
      rows.push({
        agreement_id: a.id,
        supplier: a.supplier,
        service: a.service,
        contact_email: a.contactEmail,
        analyst: a.analyst,
        status: a.status,
        go_live: a.goLive ?? '',
        exporters: a.exporters.join(';'),
        exporter_role: a.exporterRole,
        importer_role: a.importerRole,
        data_subjects: a.dataSubjects.join(';'),
        special_category: a.specialCategory ? 'yes' : 'no',
        data_subject_count: String(a.subjectCount),
        destination_entity: d.entity,
        destination_country: d.country,
        destination_type: d.kind,
        private_sector: d.privateSector ? 'yes' : 'no',
        dpf: dpfTokens(d).join(';'),
        ...(i === 0 ? docs : {}),
      })
    })
  }
  return Papa.unparse({ fields: [...COLUMNS], data: rows.map((r) => COLUMNS.map((c) => r[c] ?? '')) })
}

/** A two-row example: a supplier in India with a US sub-processor. */
export const TEMPLATE_CSV = [
  COLUMNS.join(','),
  'AGR-2001,Example Payroll Ltd,Payroll,privacy@payroll.example,Your name,live,,DE;GB,controller,processor,employees,no,1200,,India,importer,yes,,2026-01-15,2026-01-15,2,2026-01-15,,,,2026-02-01,India,2026-02-01,',
  'AGR-2001,,,,,,,,,,,,,Example Cloud Inc,United States,sub-processor,yes,EU;UK;HR,,,,,,,,,,,2026-02-01',
].join('\n')
