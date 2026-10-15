import { useMemo, useState } from 'react'
import { copyText, plural, ProgressChip, RegimeTags } from '../components/ui'
import { logEmailSent } from '../domain/actions'
import { type AgreementView, BUCKET_LABEL, type Bucket, comparePriority, draftEmail, mailtoLink } from '../domain/documents'
import { TODAY, type Register } from '../state/store'

interface Props {
  reg: Register
  onOpen: (id: string) => void
}

const SECTIONS: { bucket: Bucket; intro: string }[] = [
  { bucket: 'exposed', intro: 'Data is already flowing. Each of these is a transfer or processing arrangement without its documents.' },
  { bucket: 'go-live', intro: 'Onboarding suppliers. Data should not flow until these are complete, so the go-live date sets the order.' },
  { bucket: 'housekeeping', intro: 'Checks that keep complete agreements complete.' },
]

export function FollowUps({ reg, onOpen }: Props) {
  const analysts = useMemo(() => [...new Set(reg.agreements.map((a) => a.analyst).filter(Boolean))].sort(), [reg.agreements])
  const [analyst, setAnalyst] = useState(reg.settings.me && analysts.includes(reg.settings.me) ? reg.settings.me : '')

  const queue = useMemo(
    () => reg.views.filter((v) => v.open.length && (!analyst || v.agreement.analyst === analyst)).sort(comparePriority),
    [reg.views, analyst],
  )

  return (
    <div className="page">
      <div className="toolbar">
        <p className="lede">
          Ordered by what matters most: live gaps before onboarding, transfer documents before other paperwork, then special-category data, then the number of people, then how long the supplier has been waiting.
        </p>
        <select value={analyst} onChange={(e) => setAnalyst(e.target.value)} aria-label="Analyst">
          <option value="">All analysts</option>
          {analysts.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>

      {SECTIONS.map(({ bucket, intro }) => {
        const items = queue.filter((v) => v.bucket === bucket)
        if (!items.length) return null
        return (
          <section key={bucket} className="followup-section">
            <h2>
              {BUCKET_LABEL[bucket]} <span className="count">{items.length}</span>
            </h2>
            <p className="muted">{intro}</p>
            <div className="cards">
              {items.map((v) => (
                <FollowUpCard key={v.agreement.id} view={v} reg={reg} onOpen={onOpen} />
              ))}
            </div>
          </section>
        )
      })}
      {queue.length === 0 && <p className="empty">Nothing to follow up{analyst ? ` for ${analyst}` : ''}.</p>}
    </div>
  )
}

function FollowUpCard({ view, reg, onOpen }: { view: AgreementView; reg: Register; onOpen: (id: string) => void }) {
  const a = view.agreement
  const email = draftEmail(view, reg.settings, TODAY)
  const [copied, setCopied] = useState(false)
  const supplierSide = view.open.filter((s) => s.requirement.supplierAction && s.progress !== 'review')
  const ourSide = view.open.filter((s) => !s.requirement.supplierAction || s.progress === 'review')

  return (
    <article className={`card ${view.escalate ? 'card-escalate' : ''}`}>
      <header>
        <div>
          <button className="link" onClick={() => onOpen(a.id)}>
            <strong>{a.supplier}</strong>
          </button>
          <div className="muted small">
            {a.service} · {a.analyst}
          </div>
        </div>
        <div className="card-flags">
          {view.escalate && <span className="chip progress-escalate">Escalate</span>}
          {!view.escalate && view.reminderDue && <span className="chip progress-waiting">Reminder due</span>}
        </div>
      </header>
      <p className="why-line small">{view.why.join(' · ')}</p>
      {supplierSide.length > 0 && (
        <>
          <h4>From the supplier</h4>
          <ul className="mini-docs">
            {supplierSide.map((s) => (
              <li key={s.requirement.key}>
                <span>
                  {s.requirement.label.split(' (')[0]} <RegimeTags regimes={s.requirement.regimes} />
                </span>
                <ProgressChip progress={s.progress} />
              </li>
            ))}
          </ul>
        </>
      )}
      {ourSide.length > 0 && (
        <>
          <h4>For us</h4>
          <ul className="mini-docs">
            {ourSide.map((s) => (
              <li key={s.requirement.key}>
                <span>{s.requirement.label.split(' (')[0]}</span>
                <ProgressChip progress={s.progress} />
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="btn-row small">
        {email && (
          <>
            <a className="btn primary" href={mailtoLink(email)}>
              {email.reminderNumber ? `Email reminder ${email.reminderNumber}` : 'Email request'}
            </a>
            <button className="btn" onClick={() => copyText(`Subject: ${email.subject}\n\n${email.body}`).then(setCopied)}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn" onClick={() => reg.update(logEmailSent(view, TODAY))} title={`Records ${plural(supplierItemsCount(view), 'document')} as requested or reminded today`}>
              Log as sent
            </button>
          </>
        )}
        <button className="btn ghost" onClick={() => onOpen(a.id)}>
          Details
        </button>
      </div>
    </article>
  )
}

function supplierItemsCount(view: AgreementView): number {
  return view.open.filter((s) => s.requirement.supplierAction && s.progress !== 'review' && s.progress !== 'stale').length
}
