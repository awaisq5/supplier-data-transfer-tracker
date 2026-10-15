import type { Regime } from '../law/regimes'

export type Role = 'controller' | 'processor'

export type DataSubject = 'employees' | 'candidates' | 'contractors' | 'customers' | 'supplier contacts' | 'visitors'

export const DATA_SUBJECTS: DataSubject[] = [
  'employees',
  'candidates',
  'contractors',
  'customers',
  'supplier contacts',
  'visitors',
]

/** Data about the workforce counts as HR data under the Data Privacy Framework. */
export const HR_SUBJECTS = new Set<DataSubject>(['employees', 'candidates', 'contractors'])

/** Where the supplier, or one of its sub-processors, processes the data. */
export interface Destination {
  id: string
  entity: string
  country: string
  kind: 'importer' | 'sub-processor'
  /** Private-sector (commercial) organisation. Some adequacy decisions cover only these. */
  privateSector: boolean
  /** Data Privacy Framework certifications held, for US importers. */
  dpf?: {
    EU?: boolean
    UK?: boolean
    CH?: boolean
    /** The certification covers HR data. */
    hr?: boolean
  }
}

export type AgreementStatus = 'onboarding' | 'live' | 'ended'

export interface Agreement {
  id: string
  supplier: string
  service: string
  contactEmail: string
  /** Who in procurement follows this supplier up. */
  analyst: string
  status: AgreementStatus
  goLive?: string
  /** Countries of our own entities that send data under this agreement. */
  exporters: string[]
  exporterRole: Role
  importerRole: Role
  dataSubjects: DataSubject[]
  /** Special categories under Art. 9 GDPR, such as health data. */
  specialCategory: boolean
  subjectCount: number
  destinations: Destination[]
  documents: Partial<Record<DocKey, DocRecord>>
}

/** Documents the tracker knows how to ask for. */
export type DocKey = 'pdpa' | 'scc' | 'uk' | 'ch' | 'tia' | 'toms' | 'subproc' | 'dpf'

export type DocState = 'requested' | 'received' | 'approved'

export interface DocRecord {
  state: DocState
  requestedOn?: string
  /** Reminder dates, oldest first. */
  reminders: string[]
  receivedOn?: string
  approvedOn?: string
  /** Countries an approved assessment covers. */
  covers?: string[]
  /** Modules an approved SCC covers. */
  modules?: number[]
  note?: string
}

/** How a flow to one destination is lawful under one regime. */
export type Basis = 'domestic' | 'adequacy' | 'safeguards' | 'supplier-controller'

export interface FlowAssessment {
  regime: Regime
  destination: Destination
  basis: Basis
  /** Plain-language reason, citing the rule. */
  reason: string
  /** Adequacy that would apply but for an unmet condition, e.g. no DPF certification. */
  failedCondition?: string
}

/** How serious a missing document is. */
export type Tier = 'transfer' | 'processor' | 'policy' | 'verification'

export interface Requirement {
  key: DocKey
  label: string
  why: string
  tier: Tier
  regimes: Regime[]
  /** Countries an assessment must cover, or sub-processor countries needing terms. */
  countries?: string[]
  modules?: number[]
  /** The supplier has to send something (as opposed to internal work). */
  supplierAction: boolean
}

export type Progress = 'not-requested' | 'waiting' | 'review' | 'incomplete' | 'stale' | 'done'

export interface RequirementStatus {
  requirement: Requirement
  record?: DocRecord
  progress: Progress
  /** What is wrong, for incomplete or stale documents. */
  detail?: string
  /** Days since the supplier was last contacted, while waiting. */
  daysWaiting?: number
  reminderDue?: boolean
  escalate?: boolean
}

export interface Settings {
  reminderDays: number
  escalateAfter: number
  dpfRecheckDays: number
  /** Annual worldwide turnover in EUR, for the fine ceilings. 0 hides them. */
  turnoverEur: number
  me: string
}

export const DEFAULT_SETTINGS: Settings = {
  reminderDays: 14,
  escalateAfter: 3,
  dpfRecheckDays: 365,
  turnoverEur: 0,
  me: '',
}
