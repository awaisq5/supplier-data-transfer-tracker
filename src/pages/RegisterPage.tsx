import { useMemo, useState } from 'react'
import { BucketChip, fmt, RegimeTags } from '../components/ui'
import { BUCKET_LABEL, type Bucket, comparePriority } from '../domain/documents'
import { regimesOf } from '../domain/rules'
import { countryName } from '../law/countries'
import { type Regime, REGIMES } from '../law/regimes'
import type { Register } from '../state/store'

interface Props {
  reg: Register
  onOpen: (id: string) => void
  onNew: () => void
}

const BUCKETS: Bucket[] = ['exposed', 'go-live', 'housekeeping', 'compliant', 'out-of-scope', 'ended']

export function RegisterPage({ reg, onOpen, onNew }: Props) {
  const [q, setQ] = useState('')
  const [bucket, setBucket] = useState<Bucket | ''>('')
  const [regime, setRegime] = useState<Regime | ''>('')
  const [analyst, setAnalyst] = useState('')

  const analysts = useMemo(() => [...new Set(reg.agreements.map((a) => a.analyst).filter(Boolean))].sort(), [reg.agreements])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return reg.views
      .filter((v) => !bucket || v.bucket === bucket)
      .filter((v) => !regime || regimesOf(v.agreement).includes(regime))
      .filter((v) => !analyst || v.agreement.analyst === analyst)
      .filter((v) => {
        if (!needle) return true
        const a = v.agreement
        return [a.supplier, a.service, a.id, ...a.destinations.map((d) => `${d.entity} ${countryName(d.country)}`)].some((s) => s.toLowerCase().includes(needle))
      })
      .sort(comparePriority)
  }, [reg.views, q, bucket, regime, analyst])

  return (
    <div className="page">
      <div className="toolbar">
        <input className="search" placeholder="Search supplier, service, country …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select value={bucket} onChange={(e) => setBucket(e.target.value as Bucket | '')} aria-label="Status">
          <option value="">All statuses</option>
          {BUCKETS.map((b) => (
            <option key={b} value={b}>
              {BUCKET_LABEL[b]}
            </option>
          ))}
        </select>
        <select value={regime} onChange={(e) => setRegime(e.target.value as Regime | '')} aria-label="Regime">
          <option value="">EU, UK and Swiss</option>
          {REGIMES.map((r) => (
            <option key={r} value={r}>
              {r === 'EU' ? 'EU/EEA entities' : r === 'UK' ? 'UK entity' : 'Swiss entity'}
            </option>
          ))}
        </select>
        <select value={analyst} onChange={(e) => setAnalyst(e.target.value)} aria-label="Analyst">
          <option value="">All analysts</option>
          {analysts.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <button className="btn primary" onClick={onNew}>
          New agreement
        </button>
      </div>

      <div className="table-wrap panel flush">
        <table className="register">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Status</th>
              <th>From</th>
              <th>Processed in</th>
              <th>Documents</th>
              <th className="num">People</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const a = v.agreement
              const total = v.statuses.length
              const done = total - v.open.length
              const next = v.open[0]
              return (
                <tr key={a.id} onClick={() => onOpen(a.id)} className="clickable" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(a.id)}>
                  <td>
                    <strong>{a.supplier}</strong>
                    <div className="muted small">
                      {a.service} · {a.id}
                    </div>
                  </td>
                  <td>
                    <BucketChip bucket={v.bucket} />
                    {a.specialCategory && <div className="flag small">Special category</div>}
                  </td>
                  <td>
                    <RegimeTags regimes={regimesOf(a)} />
                  </td>
                  <td className="small">{[...new Set(a.destinations.map((d) => countryName(d.country)))].join(', ')}</td>
                  <td>
                    {total ? (
                      <div className="meter" title={`${done} of ${total} done`}>
                        <span style={{ width: `${(done / total) * 100}%` }} />
                        <em>
                          {done}/{total}
                        </em>
                      </div>
                    ) : (
                      <span className="muted">–</span>
                    )}
                  </td>
                  <td className="num">{fmt(a.subjectCount)}</td>
                  <td className="small">
                    {next ? (
                      <>
                        {nextStep(next.progress)} <span className="muted">{next.requirement.label.split(' (')[0]}</span>
                      </>
                    ) : (
                      <span className="muted">–</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty">No agreement matches these filters.</p>}
      </div>
    </div>
  )
}

function nextStep(p: string): string {
  switch (p) {
    case 'not-requested':
      return 'Request'
    case 'waiting':
      return 'Chase'
    case 'review':
      return 'Review'
    case 'incomplete':
      return 'Update'
    case 'stale':
      return 'Re-check'
    default:
      return ''
  }
}
