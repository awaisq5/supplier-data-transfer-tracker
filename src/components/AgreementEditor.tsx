import { useEffect, useMemo, useState } from 'react'
import { OUR_ENTITIES } from '../data/sample'
import { requirementsFor } from '../domain/rules'
import { type Agreement, type AgreementStatus, DATA_SUBJECTS, type DataSubject, type Destination, type Role, type Settings } from '../domain/types'
import { compareAgreement } from '../domain/whatif'
import { COUNTRIES, countryName } from '../law/countries'
import { regimeOf } from '../law/regimes'
import { BASIS_LABEL, RegimeTags } from './ui'

interface Props {
  original?: Agreement
  nextId: string
  settings: Settings
  today: string
  onSave: (a: Agreement) => void
  onCancel: () => void
}

let counter = 0
const newId = (agreementId: string) => `${agreementId}-n${Date.now().toString(36)}${counter++}`

function blank(id: string, analyst: string): Agreement {
  return {
    id,
    supplier: '',
    service: '',
    contactEmail: '',
    analyst,
    status: 'onboarding',
    exporters: ['DE'],
    exporterRole: 'controller',
    importerRole: 'processor',
    dataSubjects: ['employees'],
    specialCategory: false,
    subjectCount: 0,
    destinations: [{ id: newId(id), entity: '', country: 'IN', kind: 'importer', privateSector: true }],
    documents: {},
  }
}

export function AgreementEditor({ original, nextId, settings, today, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Agreement>(() => original ?? blank(nextId, settings.me))
  const [tried, setTried] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const set = <K extends keyof Agreement>(k: K, v: Agreement[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setDest = (id: string, patch: Partial<Destination>) =>
    setDraft((d) => ({ ...d, destinations: d.destinations.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))

  // Fill the supplier's own row with the supplier's name while it is blank.
  const withNames = useMemo<Agreement>(
    () => ({
      ...draft,
      destinations: draft.destinations.map((d) => (d.kind === 'importer' && !d.entity.trim() ? { ...d, entity: draft.supplier.trim() || 'Supplier' } : d)),
    }),
    [draft],
  )

  const errors: string[] = []
  if (!draft.supplier.trim()) errors.push('Enter the supplier’s name.')
  if (!draft.exporters.length) errors.push('Tick at least one of our entities.')
  if (!draft.destinations.some((d) => d.kind === 'importer')) errors.push('Add at least one place where the supplier itself processes data.')
  if (draft.destinations.some((d) => d.kind === 'sub-processor' && !d.entity.trim())) errors.push('Name every sub-processor.')
  if (draft.status === 'onboarding' && !draft.goLive) errors.push('Set the planned go-live date.')

  const impact = useMemo(() => (original ? compareAgreement(original, withNames, settings, today) : undefined), [original, withNames, settings, today])
  const reqs = useMemo(() => requirementsFor(withNames), [withNames])

  const entityCountries = [...new Set([...OUR_ENTITIES.map((e) => e.country), ...draft.exporters])]
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const save = () => {
    setTried(true)
    if (errors.length) return
    onSave({ ...withNames, supplier: draft.supplier.trim(), service: draft.service.trim() || draft.supplier.trim() })
  }

  return (
    <div className="drawer-backdrop" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={original ? `Edit ${original.supplier}` : 'New agreement'} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <div className="eyebrow">{draft.id}</div>
            <h2>{original ? 'Edit agreement' : 'New agreement'}</h2>
          </div>
          <button className="icon-btn" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </header>

        <div className="form-grid">
          <label>
            Supplier
            <input value={draft.supplier} onChange={(e) => set('supplier', e.target.value)} />
          </label>
          <label>
            Service
            <input value={draft.service} onChange={(e) => set('service', e.target.value)} />
          </label>
          <label>
            Supplier privacy contact
            <input type="email" value={draft.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
          </label>
          <label>
            Analyst
            <input value={draft.analyst} onChange={(e) => set('analyst', e.target.value)} />
          </label>
          <label>
            Status
            <select value={draft.status} onChange={(e) => set('status', e.target.value as AgreementStatus)}>
              <option value="onboarding">Onboarding</option>
              <option value="live">Live</option>
              <option value="ended">Ended</option>
            </select>
          </label>
          <label>
            Go-live
            <input type="date" value={draft.goLive ?? ''} onChange={(e) => set('goLive', e.target.value || undefined)} />
          </label>
        </div>

        <fieldset>
          <legend>Our entities sending data</legend>
          <div className="checks">
            {entityCountries.map((c) => (
              <label key={c} className="check">
                <input type="checkbox" checked={draft.exporters.includes(c)} onChange={() => set('exporters', toggle(draft.exporters, c))} />
                {countryName(c)} <RegimeTags regimes={regimeOf(c) ? [regimeOf(c)!] : []} />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-grid">
          <label>
            Our role
            <select value={draft.exporterRole} onChange={(e) => set('exporterRole', e.target.value as Role)}>
              <option value="controller">Controller</option>
              <option value="processor">Processor (for our clients)</option>
            </select>
          </label>
          <label>
            Supplier’s role
            <select value={draft.importerRole} onChange={(e) => set('importerRole', e.target.value as Role)}>
              <option value="processor">Processor</option>
              <option value="controller">Controller</option>
            </select>
          </label>
          <label>
            Number of people
            <input type="number" min={0} value={draft.subjectCount} onChange={(e) => set('subjectCount', Math.max(0, Math.round(Number(e.target.value) || 0)))} />
          </label>
        </div>

        <fieldset>
          <legend>Whose data</legend>
          <div className="checks">
            {DATA_SUBJECTS.map((s) => (
              <label key={s} className="check">
                <input type="checkbox" checked={draft.dataSubjects.includes(s)} onChange={() => set('dataSubjects', toggle<DataSubject>(draft.dataSubjects, s))} />
                {s}
              </label>
            ))}
            <label className="check strong">
              <input type="checkbox" checked={draft.specialCategory} onChange={(e) => set('specialCategory', e.target.checked)} />
              Special-category data (health, biometrics …)
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Where the supplier processes the data</legend>
          <div className="dest-list">
            {draft.destinations.map((d) => (
              <div key={d.id} className="dest-row">
                <select value={d.kind} onChange={(e) => setDest(d.id, { kind: e.target.value as Destination['kind'] })} aria-label="Type">
                  <option value="importer">Supplier</option>
                  <option value="sub-processor">Sub-processor</option>
                </select>
                <input
                  value={d.entity}
                  placeholder={d.kind === 'importer' ? draft.supplier || 'Supplier entity' : 'Sub-processor name'}
                  onChange={(e) => setDest(d.id, { entity: e.target.value })}
                  aria-label="Entity"
                />
                <select value={d.country} onChange={(e) => setDest(d.id, { country: e.target.value })} aria-label="Country">
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="check" title="Some adequacy findings (Canada, Japan) only cover private-sector organisations">
                  <input type="checkbox" checked={d.privateSector} onChange={(e) => setDest(d.id, { privateSector: e.target.checked })} />
                  Private sector
                </label>
                {d.country === 'US' && (
                  <span className="dpf-flags">
                    DPF:
                    {(['EU', 'UK', 'CH'] as const).map((k) => (
                      <label key={k} className="check">
                        <input type="checkbox" checked={!!d.dpf?.[k]} onChange={(e) => setDest(d.id, { dpf: { ...d.dpf, [k]: e.target.checked } })} />
                        {k}
                      </label>
                    ))}
                    <label className="check">
                      <input type="checkbox" checked={!!d.dpf?.hr} onChange={(e) => setDest(d.id, { dpf: { ...d.dpf, hr: e.target.checked } })} />
                      HR data
                    </label>
                  </span>
                )}
                <button className="icon-btn" onClick={() => set('destinations', draft.destinations.filter((x) => x.id !== d.id))} aria-label="Remove">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="btn-row small">
            <button className="btn" onClick={() => set('destinations', [...draft.destinations, { id: newId(draft.id), entity: '', country: 'US', kind: 'sub-processor', privateSector: true }])}>
              Add sub-processor
            </button>
            <button className="btn" onClick={() => set('destinations', [...draft.destinations, { id: newId(draft.id), entity: '', country: 'IN', kind: 'importer', privateSector: true }])}>
              Add supplier location
            </button>
          </div>
        </fieldset>

        <section className="impact">
          <h3>{original ? 'Effect of these changes' : 'What this agreement will need'}</h3>
          {impact ? (
            impact.flowChanges.length === 0 && impact.added.length === 0 && impact.dropped.length === 0 ? (
              <p className="muted">No change to transfers or documents.</p>
            ) : (
              <ul>
                {impact.flowChanges.map((f, i) => (
                  <li key={`f${i}`}>
                    <RegimeTags regimes={[f.regime]} /> {f.entity || 'New location'} in {countryName(f.country)}: {f.from === 'new' ? 'new flow' : BASIS_LABEL[f.from]} → <strong>{BASIS_LABEL[f.to]}</strong>
                  </li>
                ))}
                {impact.added.map((s) => (
                  <li key={`a${s.requirement.key}`} className="impact-add">
                    Needs: {s.requirement.label}
                    {s.detail ? ` (${s.detail.replace(/\.$/, '')})` : ''}
                  </li>
                ))}
                {impact.dropped.map((r) => (
                  <li key={`d${r.key}`} className="impact-drop">
                    No longer needed: {r.label}
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul>
              {reqs.map((r) => (
                <li key={r.key}>
                  {r.label} <RegimeTags regimes={r.regimes} />
                </li>
              ))}
              {reqs.length === 0 && <li className="muted">Nothing: no entity in the EEA, the UK or Switzerland is ticked.</li>}
            </ul>
          )}
        </section>

        {tried && errors.length > 0 && (
          <ul className="errors" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <footer className="drawer-foot">
          <button className="btn primary" onClick={save}>
            {original ? 'Save changes' : 'Add agreement'}
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}
