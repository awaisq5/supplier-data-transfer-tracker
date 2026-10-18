/**
 * The follow-up queue as a spreadsheet, for a weekly meeting or for an analyst
 * who works from Excel. One row per agreement, in priority order.
 */

import Papa from 'papaparse'
import { type AgreementView, BUCKET_LABEL, PROGRESS_LABEL } from './documents'

export const QUEUE_COLUMNS = [
  'rank',
  'section',
  'supplier',
  'service',
  'analyst',
  'contact_email',
  'status',
  'go_live',
  'from_supplier',
  'for_us',
  'longest_wait_days',
  'reminder_due',
  'escalate',
  'why',
] as const

const describe = (items: AgreementView['open']) =>
  items.map((s) => `${s.requirement.label.split(' (')[0]}: ${PROGRESS_LABEL[s.progress].toLowerCase()}`).join('; ')

/** `views` must already be filtered and sorted as on the page. */
export function queueCsv(views: AgreementView[]): string {
  const rows = views.map((v, i) => {
    const a = v.agreement
    const supplierSide = v.open.filter((s) => s.requirement.supplierAction && s.progress !== 'review')
    const ourSide = v.open.filter((s) => !s.requirement.supplierAction || s.progress === 'review')
    return [
      i + 1,
      BUCKET_LABEL[v.bucket],
      a.supplier,
      a.service,
      a.analyst,
      a.contactEmail,
      a.status,
      a.goLive ?? '',
      describe(supplierSide),
      describe(ourSide),
      v.maxWaiting,
      v.reminderDue ? 'yes' : 'no',
      v.escalate ? 'yes' : 'no',
      v.why.join('; '),
    ]
  })
  // The byte order mark tells Excel the file is UTF-8, so "Müller GmbH" stays readable.
  return '﻿' + Papa.unparse({ fields: [...QUEUE_COLUMNS], data: rows })
}
