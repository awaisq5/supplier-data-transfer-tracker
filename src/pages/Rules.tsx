import { useMemo, useState } from 'react'
import { RecheckNotice } from '../components/RecheckNotice'
import { BasisChip, RegimeTags } from '../components/ui'
import { assessFlows, MODULE_NAMES, requirementsFor } from '../domain/rules'
import type { Agreement, Role } from '../domain/types'
import { ADEQUACY, type AdequacyDecision, CURRENT_LISTS, TIMELINE } from '../law/adequacy'
import { COUNTRIES, countryName } from '../law/countries'
import { EEA, type Regime, REGIME_INFO, REGIMES } from '../law/regimes'

const ENTITY: Record<Regime, string> = { EU: 'DE', UK: 'GB', CH: 'CH' }

export function Rules() {
  const [regimes, setRegimes] = useState<Regime[]>(['EU', 'UK', 'CH'])
  const [exporterRole, setExporterRole] = useState<Role>('controller')
  const [importerRole, setImporterRole] = useState<Role>('processor')
  const [hr, setHr] = useState(true)
  const [country, setCountry] = useState('JP')
  const [privateSector, setPrivateSector] = useState(true)
  const [dpf, setDpf] = useState({ EU: false, UK: false, CH: false, hr: false })

  const probe: Agreement = useMemo(
    () => ({
      id: 'check',
      supplier: 'Supplier',
      service: 'Check',
      contactEmail: '',
      analyst: '',
      status: 'onboarding',
      exporters: regimes.map((r) => ENTITY[r]),
      exporterRole,
      importerRole,
      dataSubjects: hr ? ['employees'] : ['customers'],
      specialCategory: false,
      subjectCount: 0,
      destinations: [{ id: 'd', entity: 'The supplier', country, kind: 'importer', privateSector, dpf: country === 'US' ? dpf : undefined }],
      documents: {},
    }),
    [regimes, exporterRole, importerRole, hr, country, privateSector, dpf],
  )
  const flows = assessFlows(probe)
  const reqs = requirementsFor(probe)
  const partial = ['CA', 'JP'].includes(country)

  return (
    <div className="page">
      <section className="panel">
        <h2>Check a transfer</h2>
        <p className="muted">Pick where the data comes from and where it goes. The answer uses the same rules as the register.</p>
        <div className="checker">
          <div className="checker-form">
            <fieldset>
              <legend>Our entities sending data</legend>
              <div className="checks">
                {REGIMES.map((r) => (
                  <label key={r} className="check">
                    <input type="checkbox" checked={regimes.includes(r)} onChange={() => setRegimes((x) => (x.includes(r) ? x.filter((y) => y !== r) : REGIMES.filter((y) => y === r || x.includes(y))))} />
                    {REGIME_INFO[r].name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-grid">
              <label>
                Supplier’s country
                <select value={country} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Our role
                <select value={exporterRole} onChange={(e) => setExporterRole(e.target.value as Role)}>
                  <option value="controller">Controller</option>
                  <option value="processor">Processor</option>
                </select>
              </label>
              <label>
                Supplier’s role
                <select value={importerRole} onChange={(e) => setImporterRole(e.target.value as Role)}>
                  <option value="processor">Processor</option>
                  <option value="controller">Controller</option>
                </select>
              </label>
            </div>
            <div className="checks">
              <label className="check">
                <input type="checkbox" checked={hr} onChange={(e) => setHr(e.target.checked)} />
                Workforce (HR) data
              </label>
              {partial && (
                <label className="check">
                  <input type="checkbox" checked={privateSector} onChange={(e) => setPrivateSector(e.target.checked)} />
                  Supplier is a private-sector business
                </label>
              )}
            </div>
            {country === 'US' && (
              <fieldset>
                <legend>Supplier’s Data Privacy Framework certifications</legend>
                <div className="checks">
                  {(['EU', 'UK', 'CH'] as const).map((k) => (
                    <label key={k} className="check">
                      <input type="checkbox" checked={dpf[k]} onChange={(e) => setDpf({ ...dpf, [k]: e.target.checked })} />
                      {k === 'EU' ? 'EU-US DPF' : k === 'UK' ? 'UK Extension' : 'Swiss-US DPF'}
                    </label>
                  ))}
                  <label className="check">
                    <input type="checkbox" checked={dpf.hr} onChange={(e) => setDpf({ ...dpf, hr: e.target.checked })} />
                    Covers HR data
                  </label>
                </div>
              </fieldset>
            )}
          </div>

          <div className="checker-result">
            {regimes.length === 0 && <p className="muted">Tick at least one of our entities.</p>}
            {flows.map((f) => (
              <div key={f.regime} className="verdict">
                <div className="verdict-head">
                  <RegimeTags regimes={[f.regime]} /> <BasisChip basis={f.basis} />
                </div>
                <p>{f.reason}</p>
              </div>
            ))}
            {reqs.length > 0 && (
              <>
                <h3>Documents needed</h3>
                <ol className="req-list">
                  {reqs.map((r) => (
                    <li key={r.key}>
                      <strong>{r.label}</strong> <RegimeTags regimes={r.regimes} />
                      <p className="muted small">{r.why}</p>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>The three lists side by side</h2>
        <p className="muted">
          Each regime keeps its own list, and they differ. EEA states are adequate for UK and Swiss exporters and are not repeated here. Checked against the{' '}
          {REGIMES.map((r, i) => (
            <span key={r}>
              <a href={ADEQUACY[r].source} target="_blank" rel="noreferrer">
                {ADEQUACY[r].authority}
              </a>{' '}
              ({ADEQUACY[r].checkedOn})
              {i < 2 ? (i === 1 ? ' and ' : ', ') : '.'}
            </span>
          ))}
        </p>
        <RecheckNotice />
        <ListsTable />
      </section>

      <section className="panel">
        <h2>Which SCC module</h2>
        <div className="table-wrap">
          <table className="compact">
            <thead>
              <tr>
                <th>Our role</th>
                <th>Supplier’s role</th>
                <th>Module</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['controller', 'controller', 1],
                  ['controller', 'processor', 2],
                  ['processor', 'processor', 3],
                  ['processor', 'controller', 4],
                ] as const
              ).map(([e, i, m]) => (
                <tr key={m}>
                  <td>{e}</td>
                  <td>{i}</td>
                  <td>
                    Module {m}: {MODULE_NAMES[m]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          UK exporters add the ICO’s Addendum to the EU SCCs, or sign the UK IDTA instead. Swiss exporters use the EU SCCs with amendments for the FADP. Text of the SCCs:{' '}
          <a href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj" target="_blank" rel="noreferrer">
            Commission Implementing Decision (EU) 2021/914
          </a>
          .
        </p>
      </section>

      <section className="panel">
        <h2>How the rules changed</h2>
        <ol className="timeline">
          {[...TIMELINE].reverse().map((t) => (
            <li key={t.date + t.text}>
              <time>{t.date}</time>
              {t.regime !== 'all' && <RegimeTags regimes={[t.regime]} />}
              <span>{t.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function cell(d: AdequacyDecision | undefined) {
  if (!d) return <span className="muted">–</span>
  const text = d.scope === 'full' ? 'Adequate' : d.scope === 'private-sector' ? 'Private sector' : 'DPF-certified only'
  return (
    <span className={`chip ${d.scope === 'full' ? 'basis-adequacy' : 'basis-partial'}`} title={d.note}>
      {text}
    </span>
  )
}

const isHome = (r: Regime, code: string) => (r === 'UK' && code === 'GB') || (r === 'CH' && code === 'CH')

function ListsTable() {
  const codes = [...new Set(REGIMES.flatMap((r) => [...CURRENT_LISTS[r].keys()]))].filter((c) => !EEA.has(c))
  const rows = codes
    .map((c) => ({ code: c, cells: REGIMES.map((r) => CURRENT_LISTS[r].get(c)) }))
    .map((r) => ({
      ...r,
      differs: new Set(r.cells.map((x, i) => (isHome(REGIMES[i], r.code) ? 'full' : (x?.scope ?? 'none')))).size > 1,
    }))
    .sort((a, b) => Number(b.differs) - Number(a.differs) || countryName(a.code).localeCompare(countryName(b.code)))
  return (
    <div className="table-wrap">
      <table className="compact lists">
        <thead>
          <tr>
            <th>Country</th>
            {REGIMES.map((r) => (
              <th key={r}>For {r === 'EU' ? 'EEA' : r === 'UK' ? 'UK' : 'Swiss'} exporters</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className={r.differs ? 'differs' : ''}>
              <td>
                {countryName(r.code)}
                {r.differs && <span className="differs-tag">lists differ</span>}
              </td>
              {r.cells.map((d, i) => (
                <td key={i}>{isHome(REGIMES[i], r.code) ? <span className="muted">home</span> : cell(d)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
