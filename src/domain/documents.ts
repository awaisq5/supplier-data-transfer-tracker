/**
 * Document status, follow-up timing and priorities.
 *
 * Requirements say what an agreement needs; document records say what has been
 * asked for, received and approved. Comparing the two gives the open items, and
 * the follow-up rules say when to send a reminder and when to escalate.
 */

import type { Lists } from '../law/adequacy'
import { CURRENT_LISTS } from '../law/adequacy'
import { proseName } from '../law/countries'
import { assessFlows, DOC_ORDER, regimesOf, requirementsFor } from './rules'
import type {
  Agreement,
  DocRecord,
  FlowAssessment,
  Progress,
  Requirement,
  RequirementStatus,
  Settings,
  Tier,
} from './types'

const DAY = 86_400_000

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY)
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY).toISOString().slice(0, 10)
}

export function lastContact(record: DocRecord): string | undefined {
  return record.reminders.length ? record.reminders[record.reminders.length - 1] : record.requestedOn
}

export function statusOf(req: Requirement, record: DocRecord | undefined, settings: Settings, today: string): RequirementStatus {
  const base = { requirement: req, record }
  if (!record) return { ...base, progress: 'not-requested' }

  if (record.state === 'requested') {
    const contact = lastContact(record)
    const daysWaiting = contact ? daysBetween(contact, today) : 0
    return {
      ...base,
      progress: 'waiting',
      daysWaiting,
      reminderDue: daysWaiting >= settings.reminderDays,
      escalate: record.reminders.length >= settings.escalateAfter,
    }
  }

  if (record.state === 'received') return { ...base, progress: 'review' }

  // Approved: check it still covers what the agreement needs today.
  if (req.countries && (req.key === 'tia' || req.key === 'subproc')) {
    const covers = new Set(record.covers ?? [])
    const missing = req.countries.filter((c) => !covers.has(c))
    if (missing.length) {
      return { ...base, progress: 'incomplete', detail: `Does not cover ${andList(missing.map(proseName))}.` }
    }
  }
  if (req.modules && req.key === 'scc') {
    const have = new Set(record.modules ?? [])
    const missing = req.modules.filter((m) => !have.has(m))
    if (missing.length) {
      return { ...base, progress: 'incomplete', detail: `Signed for Module ${[...have].join(', ') || '?'}, but Module ${missing.join(', ')} is needed.` }
    }
  }
  if (req.key === 'dpf') {
    const age = record.approvedOn ? daysBetween(record.approvedOn, today) : Infinity
    if (age > settings.dpfRecheckDays) {
      return { ...base, progress: 'stale', detail: record.approvedOn ? `Last checked ${record.approvedOn}.` : 'No check date recorded.' }
    }
  }
  return { ...base, progress: 'done' }
}

export type Bucket = 'exposed' | 'go-live' | 'housekeeping' | 'compliant' | 'out-of-scope' | 'ended'

export const BUCKET_LABEL: Record<Bucket, string> = {
  exposed: 'Live with gaps',
  'go-live': 'Blocks go-live',
  housekeeping: 'Housekeeping',
  compliant: 'Complete',
  'out-of-scope': 'Out of scope',
  ended: 'Ended',
}

const TIER_RANK: Record<Tier, number> = { transfer: 0, processor: 1, policy: 2, verification: 3 }
const BUCKET_RANK: Record<Bucket, number> = { exposed: 0, 'go-live': 1, housekeeping: 2, compliant: 3, 'out-of-scope': 4, ended: 5 }

export interface AgreementView {
  agreement: Agreement
  flows: FlowAssessment[]
  statuses: RequirementStatus[]
  open: RequirementStatus[]
  bucket: Bucket
  worstTier?: Tier
  /** Longest wait on the supplier, in days. */
  maxWaiting: number
  reminderDue: boolean
  escalate: boolean
  /** Short reasons for the place in the queue, most important first. */
  why: string[]
}

export function viewOf(agreement: Agreement, settings: Settings, today: string, lists: Lists = CURRENT_LISTS): AgreementView {
  const flows = assessFlows(agreement, lists)
  const reqs = requirementsFor(agreement, lists).sort((a, b) => DOC_ORDER[a.key] - DOC_ORDER[b.key])
  const statuses = reqs.map((r) => statusOf(r, agreement.documents[r.key], settings, today))
  const open = statuses.filter((s) => s.progress !== 'done')
  const worstTier = open.map((s) => s.requirement.tier).sort((a, b) => TIER_RANK[a] - TIER_RANK[b])[0]
  const maxWaiting = Math.max(0, ...open.map((s) => s.daysWaiting ?? 0))

  let bucket: Bucket
  if (agreement.status === 'ended') bucket = 'ended'
  else if (regimesOf(agreement).length === 0) bucket = 'out-of-scope'
  else if (open.length === 0) bucket = 'compliant'
  else if (agreement.status === 'onboarding') bucket = 'go-live'
  else if (worstTier === 'transfer' || worstTier === 'processor') bucket = 'exposed'
  else bucket = 'housekeeping'

  const why: string[] = []
  if (bucket === 'exposed') {
    const gap = open.find((s) => s.requirement.tier === worstTier)!
    why.push(worstTier === 'transfer' ? `Live transfer without complete safeguards (${gap.requirement.label.split(' (')[0]})` : 'Live without signed processor terms')
  }
  if (bucket === 'go-live' && agreement.goLive) {
    const d = daysBetween(today, agreement.goLive)
    why.push(d < 0 ? `Go-live was ${-d} days ago` : `Go-live in ${d} days`)
  }
  if (bucket === 'housekeeping') {
    const item = open[0]
    why.push(`${item.requirement.label}${item.detail ? `: ${item.detail.charAt(0).toLowerCase()}${item.detail.slice(1).replace(/\.$/, '')}` : ''}`)
  }
  if (agreement.specialCategory) why.push('Special-category data')
  if (agreement.subjectCount >= 1000) why.push(`${agreement.subjectCount.toLocaleString('en-GB')} people`)
  if (maxWaiting > 0) why.push(`Waiting ${maxWaiting} days`)

  return {
    agreement,
    flows,
    statuses,
    open,
    bucket,
    worstTier,
    maxWaiting,
    reminderDue: open.some((s) => s.reminderDue),
    escalate: open.some((s) => s.escalate),
    why,
  }
}

/**
 * Follow-up order: live gaps first, then agreements about to go live, then
 * housekeeping. Within a group: the more serious gap, special-category data,
 * more people affected, and the longest wait come first. Plain sort keys
 * rather than a weighted score, so the order can be explained in one sentence.
 */
export function comparePriority(a: AgreementView, b: AgreementView): number {
  return (
    BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket] ||
    (a.bucket === 'go-live' ? (a.agreement.goLive ?? '9999').localeCompare(b.agreement.goLive ?? '9999') : 0) ||
    TIER_RANK[a.worstTier ?? 'verification'] - TIER_RANK[b.worstTier ?? 'verification'] ||
    Number(b.agreement.specialCategory) - Number(a.agreement.specialCategory) ||
    b.agreement.subjectCount - a.agreement.subjectCount ||
    b.maxWaiting - a.maxWaiting ||
    a.agreement.supplier.localeCompare(b.agreement.supplier)
  )
}

export const PROGRESS_LABEL: Record<Progress, string> = {
  'not-requested': 'Not requested',
  waiting: 'Waiting on supplier',
  review: 'Received, to review',
  incomplete: 'Needs update',
  stale: 'Check again',
  done: 'Done',
}

/** Items the supplier must act on: ask for the first time, chase, or ask for an update. */
export function supplierItems(view: AgreementView): RequirementStatus[] {
  return view.open.filter(
    (s) => s.requirement.supplierAction && (s.progress === 'not-requested' || s.progress === 'waiting' || s.progress === 'incomplete'),
  )
}

export interface Email {
  to: string
  subject: string
  body: string
  /** 0 for a first request. */
  reminderNumber: number
}

export function draftEmail(view: AgreementView, settings: Settings, today: string): Email | undefined {
  const items = supplierItems(view)
  if (!items.length) return undefined
  const a = view.agreement
  const reminderNumber = Math.max(0, ...items.map((s) => (s.progress === 'waiting' ? (s.record?.reminders.length ?? 0) + 1 : 0)))
  const due = addDays(today, settings.reminderDays)

  const lines = items.map((s) => {
    const r = s.requirement
    let line = `- ${r.label}`
    if (r.key === 'tia' && r.countries) line += `: please complete our questionnaire for ${andList(r.countries.map(proseName))}`
    if (r.key === 'subproc' && r.countries) line += `: copies or confirmation for your sub-processors in ${andList(r.countries.map(proseName))}`
    if (s.progress === 'incomplete' && s.detail) line += ` (update needed: ${s.detail.charAt(0).toLowerCase()}${s.detail.slice(1).replace(/\.$/, '')})`
    if (s.progress === 'waiting' && s.record?.requestedOn) line += ` (first requested ${s.record.requestedOn})`
    return line
  })

  const intro =
    reminderNumber === 0
      ? `To complete the data protection terms for "${a.service}", we need the following from you:`
      : `This is a reminder about the data protection documents for "${a.service}". We are still missing:`

  const body = [
    'Hello,',
    '',
    intro,
    '',
    ...lines,
    '',
    `Could you send them by ${due}? Our templates are attached; please reply to this email with any questions.`,
    '',
    'Kind regards,',
    settings.me || a.analyst,
  ].join('\n')

  const subject = `${a.service}: data protection documents${reminderNumber ? ` (reminder ${reminderNumber})` : ''}`
  return { to: a.contactEmail, subject, body, reminderNumber }
}

function andList(xs: string[]): string {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

export function mailtoLink(email: Email): string {
  return `mailto:${encodeURIComponent(email.to)}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`
}
