import { useMemo, useState } from 'react'
import { BasisChip, BucketChip, fmt, plural, RegimeTags, Stat } from '../components/ui'
import { WorldMap } from '../components/WorldMap'
import { comparePriority } from '../domain/documents'
import type { Basis } from '../domain/types'
import { ADEQUACY, CURRENT_LISTS } from '../law/adequacy'
import { countryName } from '../law/countries'
import { type Regime, REGIMES } from '../law/regimes'
import type { Register } from '../state/store'

interface Props {
  reg: Register
  onOpen: (id: string) => void
  onTab: (tab: string) => void
}

export function Overview({ reg, onOpen, onTab }: Props) {
  const [regime, setRegime] = useState<Regime>('EU')
  const [allDestinations, setAllDestinations] = useState(false)
  const active = reg.views.filter((v) => v.bucket !== 'ended' && v.bucket !== 'out-of-scope')
  const count = (b: string) => active.filter((v) => v.bucket === b).length
  const exposed = active.filter((v) => v.bucket === 'exposed')
  const special = exposed.filter((v) => v.agreement.specialCategory).length
  const statuses = active.flatMap((v) => v.open)
  const waiting = statuses.filter((s) => s.progress === 'waiting')
  const toReview = statuses.filter((s) => s.progress === 'review').length
  const reminders = active.filter((v) => v.reminderDue).length
  const escalations = active.filter((v) => v.escalate).length
  const complete = count('compliant')

  const queue = useMemo(() => active.filter((v) => v.open.length).sort(comparePriority).slice(0, 6), [active])

  const destinations = useMemo(() => {
    const rows = new Map<string, { agreements: Set<string>; people: number; basis: Partial<Record<Regime, Set<Basis>>>; open: Set<string> }>()
    for (const v of active) {
      const seen = new Set<string>()
      for (const f of v.flows) {
        if (f.basis === 'domestic' || f.basis === 'supplier-controller') continue
        const c = f.destination.country
        const row = rows.get(c) ?? { agreements: new Set(), people: 0, basis: {}, open: new Set() }
        if (!seen.has(c)) {
          row.people += v.agreement.subjectCount
          seen.add(c)
        }
        row.agreements.add(v.agreement.id)
        ;(row.basis[f.regime] ??= new Set()).add(f.basis)
        if (f.basis === 'safeguards' && v.open.some((s) => s.requirement.tier === 'transfer')) row.open.add(v.agreement.id)
        rows.set(c, row)
      }
    }
    return [...rows].sort((a, b) => b[1].agreements.size - a[1].agreements.size || b[1].people - a[1].people)
  }, [active])

  return (
    <div className="page">
      <section className="headline">
        <h1>
          {exposed.length
            ? `${plural(exposed.length, 'live agreement')} ${exposed.length === 1 ? 'sends' : 'send'} personal data abroad without complete safeguards${special ? `, ${special} of them with health or other special-category data` : ''}.`
            : 'Every live agreement has its transfer documents in place.'}
        </h1>
        <p className="muted">
          {plural(active.length, 'supplier agreement')} in scope across EU, UK and Swiss entities. Adequacy lists last checked against the{' '}
          <a href={ADEQUACY.EU.source} target="_blank" rel="noreferrer">
            Commission
          </a>
          ,{' '}
          <a href={ADEQUACY.UK.source} target="_blank" rel="noreferrer">
            ICO
          </a>{' '}
          and{' '}
          <a href={ADEQUACY.CH.source} target="_blank" rel="noreferrer">
            Swiss
          </a>{' '}
          lists on {ADEQUACY.EU.checkedOn}.
        </p>
      </section>

      <section className="stats">
        <Stat label="Complete" value={`${active.length ? Math.round((complete / active.length) * 100) : 0}%`} note={`${complete} of ${active.length} agreements`} tone="good" />
        <Stat label="Live with gaps" value={exposed.length} note={`${fmt(exposed.reduce((n, v) => n + v.agreement.subjectCount, 0))} people`} tone="bad" />
        <Stat label="Blocking go-live" value={count('go-live')} note="onboarding, documents open" tone="warn" />
        <Stat label="Waiting on suppliers" value={waiting.length} note={`documents · ${plural(reminders, 'reminder')} due`} />
        <Stat label="To review" value={toReview} note="received, not yet approved" />
        <Stat label="To escalate" value={escalations} note="no answer after repeated reminders" tone={escalations ? 'bad' : ''} />
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <h2>Where the data goes</h2>
            <div className="seg" role="tablist" aria-label="Exporting regime">
              {REGIMES.map((r) => (
                <button key={r} role="tab" aria-selected={regime === r} className={regime === r ? 'on' : ''} onClick={() => setRegime(r)}>
                  From {r === 'EU' ? 'EEA' : r === 'UK' ? 'UK' : 'Swiss'} entities
                </button>
              ))}
            </div>
          </div>
          <WorldMap regime={regime} lists={CURRENT_LISTS} views={active} />
          <p className="muted small">
            The same supplier can need different documents depending on which of our entities sends the data: Brazil has an EU adequacy decision but is on neither the UK nor the Swiss list; Japan is adequate for the EU and the UK but not for Switzerland.
          </p>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Chase first</h2>
            <button className="btn small" onClick={() => onTab('followups')}>
              All follow-ups
            </button>
          </div>
          <ol className="queue-mini">
            {queue.map((v) => (
              <li key={v.agreement.id}>
                <button className="link-row" onClick={() => onOpen(v.agreement.id)}>
                  <span className="queue-title">
                    <strong>{v.agreement.supplier}</strong>
                    <BucketChip bucket={v.bucket} />
                  </span>
                  <span className="muted small">{v.why.join(' · ')}</span>
                </button>
              </li>
            ))}
            {queue.length === 0 && <li className="muted">Nothing open.</li>}
          </ol>
        </section>
      </div>

      <section className="panel">
        <h2>Destinations outside the home territories</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Country</th>
                <th className="num">Agreements</th>
                <th className="num">People</th>
                {REGIMES.map((r) => (
                  <th key={r}>
                    <RegimeTags regimes={[r]} /> exporters
                  </th>
                ))}
                <th className="num">Open transfer documents</th>
              </tr>
            </thead>
            <tbody>
              {(allDestinations ? destinations : destinations.slice(0, 10)).map(([code, row]) => (
                <tr key={code}>
                  <td>{countryName(code)}</td>
                  <td className="num">{row.agreements.size}</td>
                  <td className="num">{fmt(row.people)}</td>
                  {REGIMES.map((r) => (
                    <td key={r}>
                      {row.basis[r] ? [...row.basis[r]!].map((b) => <BasisChip key={b} basis={b} />) : <span className="muted">–</span>}
                    </td>
                  ))}
                  <td className="num">{row.open.size ? <span className="bad-text">{plural(row.open.size, 'agreement')}</span> : <span className="muted">none</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {destinations.length > 10 && (
          <button className="btn small" onClick={() => setAllDestinations((x) => !x)}>
            {allDestinations ? 'Show the top 10' : `Show all ${destinations.length} countries`}
          </button>
        )}
      </section>
    </div>
  )
}
