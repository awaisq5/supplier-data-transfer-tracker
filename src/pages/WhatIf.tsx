import { useMemo, useState } from 'react'
import { BASIS_LABEL, download, fmt, plural, RegimeTags, Stat } from '../components/ui'
import type { Override } from '../law/adequacy'
import { CURRENT_LISTS } from '../law/adequacy'
import { COUNTRIES, countryName, proseName } from '../law/countries'
import { EEA, type Regime, REGIMES } from '../law/regimes'
import { describeOverride, PRESETS, runScenario } from '../domain/whatif'
import { TODAY, type Register } from '../state/store'

interface Props {
  reg: Register
  onOpen: (id: string) => void
}

export function WhatIf({ reg, onOpen }: Props) {
  const [overrides, setOverrides] = useState<Override[]>(PRESETS[0].overrides)
  const [preset, setPreset] = useState(PRESETS[0].id)
  const [regime, setRegime] = useState<Regime>('EU')
  const [country, setCountry] = useState('IN')

  const scenario = useMemo(() => runScenario(reg.agreements, overrides, reg.settings, TODAY), [reg.agreements, overrides, reg.settings])
  const hasDecision = CURRENT_LISTS[regime].has(country)
  const home = (regime === 'EU' && EEA.has(country)) || (regime === 'UK' && country === 'GB') || (regime === 'CH' && country === 'CH')

  const addOverride = () => {
    const o: Override = { regime, country, adequate: !hasDecision }
    setOverrides((x) => [...x.filter((y) => !(y.regime === o.regime && y.country === o.country)), o])
    setPreset('')
  }

  const exportCsv = () => {
    const lines = [['agreement_id', 'supplier', 'status', 'people', 'flow_changes', 'documents_needed', 'no_longer_needed'].join(',')]
    for (const i of scenario.impacts) {
      const q = (s: string) => `"${s.replace(/"/g, '""')}"`
      lines.push(
        [
          i.agreement.id,
          q(i.agreement.supplier),
          i.agreement.status,
          i.agreement.subjectCount,
          q(i.flowChanges.map((f) => `${f.regime} ${countryName(f.country)}: ${f.from} -> ${f.to}`).join('; ')),
          q(i.added.map((s) => s.requirement.label).join('; ')),
          q(i.dropped.map((r) => r.label).join('; ')),
        ].join(','),
      )
    }
    download('what-if-impact.csv', lines.join('\n'), 'text/csv')
  }

  const current = PRESETS.find((p) => p.id === preset)

  return (
    <div className="page">
      <section className="panel">
        <h2>What if an adequacy finding changes?</h2>
        <p className="muted">
          When the Privacy Shield was struck down in July 2020, transfers that relied on it needed new safeguards straight away. Pick a scenario to see, before it happens, which suppliers it touches and what you would have to ask them for.
        </p>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={`preset ${preset === p.id ? 'on' : ''}`}
              onClick={() => {
                setPreset(p.id)
                setOverrides(p.overrides)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {current && <p className="small">{current.description}</p>}

        <div className="override-builder">
          <span>Or build your own:</span>
          <select value={regime} onChange={(e) => setRegime(e.target.value as Regime)} aria-label="Regime">
            {REGIMES.map((r) => (
              <option key={r} value={r}>
                {r === 'EU' ? 'EU list' : r === 'UK' ? 'UK list' : 'Swiss list'}
              </option>
            ))}
          </select>
          <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn" onClick={addOverride} disabled={home}>
            {home ? 'Home territory' : hasDecision ? 'Withdraw finding' : 'Add finding'}
          </button>
        </div>

        {overrides.length > 0 && (
          <div className="overrides">
            {overrides.map((o) => (
              <span key={`${o.regime}${o.country}`} className={`override ${o.adequate ? 'add' : 'remove'}`}>
                {describeOverride(o)}
                <button
                  aria-label="Remove"
                  onClick={() => {
                    setOverrides((x) => x.filter((y) => y !== o))
                    setPreset('')
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="stats">
        <Stat label="Agreements needing new documents" value={scenario.agreements} tone={scenario.agreements ? 'bad' : 'good'} />
        <Stat label="Of them live" value={scenario.live} note="data already flowing" tone={scenario.live ? 'bad' : ''} />
        <Stat label="With special-category data" value={scenario.specialCategory} />
        <Stat label="People affected" value={fmt(scenario.people)} />
        <Stat label="Documents to request" value={scenario.documentsToRequest} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Affected agreements</h2>
          {scenario.impacts.length > 0 && (
            <button className="btn small" onClick={exportCsv}>
              Download CSV
            </button>
          )}
        </div>
        {scenario.impacts.length === 0 ? (
          <p className="muted">{overrides.length ? 'No agreement in the register is affected.' : 'Pick a scenario.'}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Flows that change</th>
                  <th>Would need</th>
                  <th>No longer needed</th>
                </tr>
              </thead>
              <tbody>
                {scenario.impacts.map((i) => (
                  <tr key={i.agreement.id} className="clickable" onClick={() => onOpen(i.agreement.id)}>
                    <td>
                      <strong>{i.agreement.supplier}</strong>
                      <div className="muted small">
                        {i.agreement.status} · {plural(i.agreement.subjectCount, 'person', 'people')}
                        {i.agreement.specialCategory ? ' · special category' : ''}
                      </div>
                    </td>
                    <td className="small">
                      {i.flowChanges.map((f, k) => (
                        <div key={k}>
                          <RegimeTags regimes={[f.regime]} /> {f.entity}: {f.from === 'new' ? 'new' : BASIS_LABEL[f.from]} → {BASIS_LABEL[f.to]}
                        </div>
                      ))}
                    </td>
                    <td className="small">
                      {i.added.length ? (
                        <ul className="plain">
                          {i.added.map((s) => (
                            <li key={s.requirement.key}>
                              {s.requirement.label.split(' (')[0]}
                              {i.widened[s.requirement.key] ? ` (extend to ${i.widened[s.requirement.key]!.map(proseName).join(', ')})` : s.progress === 'incomplete' ? ' (update)' : ''}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="muted">{i.flowChanges.length ? 'Nothing new: documents already in progress cover it' : '–'}</span>
                      )}
                    </td>
                    <td className="small">
                      {i.dropped.length ? (
                        <ul className="plain">
                          {i.dropped.map((r) => (
                            <li key={r.key}>{r.label.split(' (')[0]}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="muted">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
