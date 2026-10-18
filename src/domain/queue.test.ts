import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import { sampleRegister } from '../data/sample'
import { DEFAULT_SETTINGS } from './types'
import { comparePriority, viewOf } from './documents'
import { QUEUE_COLUMNS, queueCsv } from './queue'

const TODAY = '2026-10-15'
const views = sampleRegister(TODAY)
  .map((a) => viewOf(a, DEFAULT_SETTINGS, TODAY))
  .filter((v) => v.open.length)
  .sort(comparePriority)

function parse(csv: string) {
  return Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ''), { header: true, skipEmptyLines: true })
}

describe('queueCsv', () => {
  it('starts with a byte order mark so Excel reads it as UTF-8', () => {
    expect(queueCsv(views).charCodeAt(0)).toBe(0xfeff)
  })

  it('writes one row per agreement in the order given, with every column', () => {
    const { data, meta } = parse(queueCsv(views))
    expect(meta.fields).toEqual([...QUEUE_COLUMNS])
    expect(data).toHaveLength(views.length)
    expect(data.map((r) => r.supplier)).toEqual(views.map((v) => v.agreement.supplier))
    expect(data.map((r) => Number(r.rank))).toEqual(views.map((_, i) => i + 1))
  })

  it('lists what is missing on each side with its progress', () => {
    const { data } = parse(queueCsv(views))
    const i = views.findIndex((v) => v.open.some((s) => s.requirement.supplierAction && s.progress !== 'review'))
    expect(data[i].from_supplier).toMatch(/: (not requested|waiting on supplier|needs update|check again)/)
    expect(data[i].why).toBe(views[i].why.join('; '))
  })

  it('writes only the header for an empty queue', () => {
    expect(parse(queueCsv([])).data).toEqual([])
  })
})
