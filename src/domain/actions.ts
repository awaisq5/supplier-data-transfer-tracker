/**
 * State changes on an agreement's documents. Every function returns a new
 * agreement and leaves the old one untouched.
 */

import { supplierItems, type AgreementView } from './documents'
import type { Agreement, DocKey, DocRecord, Requirement } from './types'

function withDoc(a: Agreement, key: DocKey, record: DocRecord | undefined): Agreement {
  const documents = { ...a.documents }
  if (record) documents[key] = record
  else delete documents[key]
  return { ...a, documents }
}

export function request(a: Agreement, key: DocKey, today: string): Agreement {
  return withDoc(a, key, { state: 'requested', requestedOn: today, reminders: [] })
}

export function remind(a: Agreement, key: DocKey, today: string): Agreement {
  const r = a.documents[key]
  if (!r || r.state !== 'requested') return a
  return withDoc(a, key, { ...r, reminders: [...r.reminders, today] })
}

export function receive(a: Agreement, key: DocKey, today: string): Agreement {
  const r = a.documents[key] ?? { state: 'requested' as const, reminders: [] }
  return withDoc(a, key, { ...r, state: 'received', receivedOn: today })
}

/** Approve a document; assessments and sub-processor terms cover the countries required today. */
export function approve(a: Agreement, req: Requirement, today: string): Agreement {
  const r = a.documents[req.key] ?? { state: 'requested' as const, reminders: [] }
  return withDoc(a, req.key, {
    ...r,
    state: 'approved',
    receivedOn: r.receivedOn ?? today,
    approvedOn: today,
    covers: req.countries ?? r.covers,
    modules: req.modules ?? r.modules,
    note: undefined,
  })
}

/** Send a received document back; the request starts again from today. */
export function reject(a: Agreement, key: DocKey, today: string, note: string): Agreement {
  const r = a.documents[key]
  if (!r) return a
  return withDoc(a, key, { state: 'requested', requestedOn: r.requestedOn ?? today, reminders: [...r.reminders, today], note })
}

export function clear(a: Agreement, key: DocKey): Agreement {
  return withDoc(a, key, undefined)
}

/** Record that the supplier's Data Privacy Framework listing was checked today. */
export function recordDpfCheck(a: Agreement, today: string): Agreement {
  return withDoc(a, 'dpf', { state: 'approved', reminders: [], approvedOn: today })
}

/**
 * Log that the drafted email went out: first requests become requests,
 * waiting items get a reminder, and documents that need an update are asked for again.
 */
export function logEmailSent(view: AgreementView, today: string): Agreement {
  let a = view.agreement
  for (const s of supplierItems(view)) {
    const key = s.requirement.key
    if (s.progress === 'waiting') a = remind(a, key, today)
    else a = request(a, key, today)
  }
  return a
}
