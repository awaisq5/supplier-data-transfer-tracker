import { useEffect, useState } from 'react'
import { approve, logEmailSent, receive, recordDpfCheck, reject, remind, request } from '../domain/actions'
import { type AgreementView, draftEmail, mailtoLink } from '../domain/documents'
import { MODULE_NAMES, moduleFor, regimesOf } from '../domain/rules'
import type { Agreement, RequirementStatus, Settings } from '../domain/types'
import { countryName } from '../law/countries'
import { REGIME_INFO, type Regime, regimeOf, turnoverShare } from '../law/regimes'
import { BasisChip, BucketChip, copyText, fmt, money, ProgressChip, RegimeTags } from './ui'

interface Props {
  view: AgreementView
  settings: Settings
  today: string
  onUpdate: (a: Agreement) => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}

export function AgreementDrawer({ view, settings, today, onUpdate, onEdit, onDelete, onClose }: Props) {
  const a = view.agreement
  const regimes = regimesOf(a)
  const email = draftEmail(view, settings, today)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setCopied(false)
    setConfirmDelete(false)
  }, [a.id])

  const module = moduleFor(a.exporterRole, a.importerRole)
  const openRegimes = (tier: 'transfer' | 'processor') =>
    [...new Set(view.open.filter((s) => s.requirement.tier === tier).flatMap((s) => s.requirement.regimes))] as Regime[]
  const transferRegimes = openRegimes('transfer')
  const processorRegimes = openRegimes('processor')

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${a.supplier} details`} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <div className="eyebrow">
              {a.id} · {a.analyst || 'unassigned'}
            </div>
            <h2>{a.supplier}</h2>
            <p className="muted">{a.service}</p>
          </div>
          <div className="drawer-head-side">
            <BucketChip bucket={view.bucket} />
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </header>

        {view.why.length > 0 && view.open.length > 0 && <p className="why-line">{view.why.join(' · ')}</p>}

        <section className="facts">
          <div>
            <span className="fact-label">Our entities sending data</span>
            {a.exporters.map((c) => (
              <span key={c} className="fact-entity">
                {countryName(c)} <RegimeTags regimes={regimeOf(c) ? [regimeOf(c)!] : []} />
              </span>
            ))}
          </div>
          <div>
            <span className="fact-label">Roles</span>
            Our entities: {a.exporterRole}; supplier: {a.importerRole}
            <span className="muted small">SCC Module {module}, {MODULE_NAMES[module]}</span>
          </div>
          <div>
            <span className="fact-label">Data</span>
            {a.dataSubjects.join(', ') || 'not recorded'} · {fmt(a.subjectCount)} people
            {a.specialCategory && <span className="flag">Special-category data (Art. 9)</span>}
          </div>
          <div>
            <span className="fact-label">Status</span>
            {a.status === 'onboarding' ? `Onboarding${a.goLive ? `, go-live ${a.goLive}` : ''}` : a.status === 'live' ? 'Live' : 'Ended'}
            <span className="muted small">{a.contactEmail}</span>
          </div>
        </section>

        <section>
          <h3>Where the data goes</h3>
          {regimes.length === 0 ? (
            <p className="muted">No entity in the EEA, the UK or Switzerland sends data under this agreement, so these rules do not apply.</p>
          ) : (
            <div className="table-wrap">
              <table className="flows">
                <thead>
                  <tr>
                    <th>Processed by</th>
                    {regimes.map((r) => (
                      <th key={r}>
                        From {r === 'EU' ? 'EEA' : r === 'UK' ? 'UK' : 'Swiss'} entities
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.destinations.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.entity}</strong>
                        <div className="muted small">
                          {countryName(d.country)}
                          {d.kind === 'sub-processor' ? ' · sub-processor' : ''}
                          {d.dpf && (d.dpf.EU || d.dpf.UK || d.dpf.CH) ? ` · DPF: ${(['EU', 'UK', 'CH'] as const).filter((k) => d.dpf?.[k]).join(', ')}${d.dpf.hr ? ' incl. HR' : ''}` : ''}
                        </div>
                      </td>
                      {regimes.map((r) => {
                        const f = view.flows.find((x) => x.regime === r && x.destination.id === d.id)!
                        return (
                          <td key={r} title={f.reason}>
                            <BasisChip basis={f.basis} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {view.flows.some((f) => f.basis !== 'domestic') && (
            <details className="reasons">
              <summary>Why</summary>
              <ul>
                {view.flows
                  .filter((f) => f.basis !== 'domestic')
                  .map((f) => (
                    <li key={`${f.regime}${f.destination.id}`}>
                      <RegimeTags regimes={[f.regime]} /> {f.destination.entity}: {f.reason}
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </section>

        {view.statuses.length > 0 && (
          <section>
            <h3>Documents</h3>
            <ul className="docs">
              {view.statuses.map((s) => (
                <DocItem key={s.requirement.key} status={s} agreement={a} today={today} onUpdate={onUpdate} />
              ))}
            </ul>
          </section>
        )}

        {email && (
          <section>
            <h3>{email.reminderNumber ? `Reminder ${email.reminderNumber} to the supplier` : 'Request to the supplier'}</h3>
            <div className="email">
              <div className="email-meta">
                <span>To: {email.to}</span>
                <span>Subject: {email.subject}</span>
              </div>
              <pre>{email.body}</pre>
            </div>
            <div className="btn-row">
              <a className="btn primary" href={mailtoLink(email)}>
                Open in mail app
              </a>
              <button className="btn" onClick={() => copyText(`Subject: ${email.subject}\n\n${email.body}`).then(setCopied)}>
                {copied ? 'Copied' : 'Copy text'}
              </button>
              <button className="btn" onClick={() => onUpdate(logEmailSent(view, today))}>
                Log as sent today
              </button>
            </div>
          </section>
        )}

        {(transferRegimes.length > 0 || processorRegimes.length > 0) && a.status !== 'ended' && (
          <section className="fines">
            <h3>What is at stake</h3>
            <ul>
              {transferRegimes.map((r) => (
                <li key={`t${r}`}>
                  <RegimeTags regimes={[r]} /> Transfers without valid safeguards: {REGIME_INFO[r].transferFine}.
                  <Ceiling regime={r} tier="transfer" settings={settings} />
                </li>
              ))}
              {processorRegimes.map((r) => (
                <li key={`p${r}`}>
                  <RegimeTags regimes={[r]} /> Processing without processor terms: {REGIME_INFO[r].processorFine}.
                  <Ceiling regime={r} tier="processor" settings={settings} />
                </li>
              ))}
            </ul>
            <p className="muted small">Statutory maximums, not expected fines: authorities weigh the circumstances of each case.</p>
          </section>
        )}

        <footer className="drawer-foot">
          <button className="btn" onClick={onEdit}>
            Edit agreement or sub-processors
          </button>
          {confirmDelete ? (
            <span className="confirm">
              Delete {a.id}?{' '}
              <button className="btn danger" onClick={onDelete}>
                Delete
              </button>
              <button className="btn" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </span>
          ) : (
            <button className="btn ghost" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
        </footer>
      </aside>
    </div>
  )
}

function Ceiling({ regime, tier, settings }: { regime: Regime; tier: 'transfer' | 'processor'; settings: Settings }) {
  if (!settings.turnoverEur || regime === 'CH') return null
  const share = turnoverShare(tier, settings.turnoverEur)
  const pct = tier === 'transfer' ? '4%' : '2%'
  if (regime === 'EU') {
    const fixed = tier === 'transfer' ? 20e6 : 10e6
    return <span className="ceiling"> {pct} of your turnover is {money(share, 'EUR')}, so the ceiling is {money(Math.max(fixed, share), 'EUR')}.</span>
  }
  return <span className="ceiling"> {pct} of your turnover is about {money(share, 'EUR')}.</span>
}

function DocItem({ status, agreement, today, onUpdate }: { status: RequirementStatus; agreement: Agreement; today: string; onUpdate: (a: Agreement) => void }) {
  const r = status.requirement
  const rec = status.record
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  const dates: string[] = []
  if (rec?.requestedOn) dates.push(`requested ${rec.requestedOn}`)
  if (rec?.reminders.length) dates.push(`${rec.reminders.length} reminder${rec.reminders.length > 1 ? 's' : ''}, last ${rec.reminders[rec.reminders.length - 1]}`)
  if (rec?.receivedOn && rec.state !== 'requested') dates.push(`received ${rec.receivedOn}`)
  if (rec?.approvedOn && rec.state === 'approved') dates.push(r.key === 'dpf' ? `checked ${rec.approvedOn}` : `approved ${rec.approvedOn}`)

  return (
    <li className={`doc doc-${status.progress}`}>
      <div className="doc-head">
        <div>
          <strong>{r.label}</strong> <RegimeTags regimes={r.regimes} />
          {r.countries && r.countries.length > 0 && (r.key === 'tia' || r.key === 'subproc') && (
            <div className="muted small">Must cover: {r.countries.map(countryName).join(', ')}</div>
          )}
        </div>
        <ProgressChip progress={status.progress} />
      </div>
      <p className="doc-why">{r.why}</p>
      {status.detail && <p className="doc-detail">{status.detail}</p>}
      {rec?.note && <p className="doc-detail">Sent back: {rec.note}</p>}
      {dates.length > 0 && <p className="muted small">{dates.join(' · ')}</p>}
      {status.progress === 'waiting' && (status.reminderDue || status.escalate) && (
        <p className="doc-alert">
          {status.escalate ? `No answer after ${rec?.reminders.length} reminders: escalate to the supplier’s account manager or our category manager.` : `No answer for ${status.daysWaiting} days: send a reminder.`}
        </p>
      )}
      <div className="btn-row small">
        {r.key === 'dpf' ? (
          <>
            <a className="btn" href="https://www.dataprivacyframework.gov/list" target="_blank" rel="noreferrer">
              Open the DPF list
            </a>
            {status.progress !== 'done' && (
              <button className="btn primary" onClick={() => onUpdate(recordDpfCheck(agreement, today))}>
                Record check today
              </button>
            )}
          </>
        ) : (
          <>
            {(status.progress === 'not-requested' || status.progress === 'incomplete') && (
              <button className="btn primary" onClick={() => onUpdate(request(agreement, r.key, today))}>
                {status.progress === 'incomplete' ? 'Request update' : 'Mark requested'}
              </button>
            )}
            {status.progress === 'waiting' && (
              <>
                <button className="btn" onClick={() => onUpdate(remind(agreement, r.key, today))}>
                  Log reminder
                </button>
                <button className="btn primary" onClick={() => onUpdate(receive(agreement, r.key, today))}>
                  Mark received
                </button>
              </>
            )}
            {status.progress === 'review' &&
              (rejecting ? (
                <span className="reject">
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs fixing?" aria-label="Reason for sending back" />
                  <button className="btn danger" disabled={!note.trim()} onClick={() => onUpdate(reject(agreement, r.key, today, note.trim()))}>
                    Send back
                  </button>
                  <button className="btn" onClick={() => setRejecting(false)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <>
                  <button className="btn primary" onClick={() => onUpdate(approve(agreement, r, today))}>
                    Approve
                  </button>
                  <button className="btn" onClick={() => setRejecting(true)}>
                    Send back
                  </button>
                </>
              ))}
          </>
        )}
      </div>
    </li>
  )
}
