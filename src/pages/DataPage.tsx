import { useState } from 'react'
import { download, plural } from '../components/ui'
import { exportCsv, importCsv, type ImportResult, TEMPLATE_CSV } from '../domain/csv'
import type { Settings } from '../domain/types'
import { isBackup, TODAY, type Register } from '../state/store'

export function DataPage({ reg }: { reg: Register }) {
  const [result, setResult] = useState<ImportResult>()
  const [pasted, setPasted] = useState('')
  const [message, setMessage] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  const readFile = (file: File, then: (text: string) => void) => {
    file.text().then(then, () => setMessage('That file could not be read.'))
  }

  const errors = result?.issues.filter((i) => i.level === 'error') ?? []
  const warnings = result?.issues.filter((i) => i.level === 'warning') ?? []

  return (
    <div className="page">
      {!reg.persisted && <p className="banner">This browser is not saving changes (private mode or blocked storage). Download a backup before you close the tab.</p>}
      {message && (
        <p className="banner ok" role="status">
          {message}
        </p>
      )}

      <div className="two-col even">
        <section className="panel">
          <h2>Import a register</h2>
          <p className="muted">
            One row per place where a supplier or its sub-processor handles the data. Agreement columns repeat on each of its rows, or are filled on one row only. Countries can be names or ISO codes, dates ISO or DD.MM.YYYY. Approval dates carry over; request history does not.
          </p>
          <div className="btn-row">
            <label className="btn">
              Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) readFile(f, (t) => setResult(importCsv(t)))
                  e.target.value = ''
                }}
              />
            </label>
            <button className="btn ghost" onClick={() => download('register-template.csv', TEMPLATE_CSV, 'text/csv')}>
              Download template
            </button>
          </div>
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="…or paste CSV here" rows={5} aria-label="CSV text" />
          <div className="btn-row">
            <button className="btn" disabled={!pasted.trim()} onClick={() => setResult(importCsv(pasted))}>
              Check pasted CSV
            </button>
          </div>

          {result && (
            <div className="import-result">
              <p>
                <strong>
                  {plural(result.rowsRead, 'row')} read, {plural(result.agreements.length, 'agreement')}
                </strong>
                {errors.length ? `, ${plural(errors.length, 'error')} to fix first` : ''}
                {warnings.length ? `, ${plural(warnings.length, 'warning')}` : ''}.
              </p>
              {result.issues.length > 0 && (
                <ul className="issues">
                  {result.issues.slice(0, 50).map((i, k) => (
                    <li key={k} className={i.level}>
                      Row {i.row}: {i.message}
                    </li>
                  ))}
                  {result.issues.length > 50 && <li>… and {result.issues.length - 50} more.</li>}
                </ul>
              )}
              <div className="btn-row">
                <button
                  className="btn primary"
                  disabled={errors.length > 0 || result.agreements.length === 0}
                  onClick={() => {
                    reg.replaceAll(result.agreements)
                    setMessage(`Register replaced with ${plural(result.agreements.length, 'agreement')}.`)
                    setResult(undefined)
                    setPasted('')
                  }}
                >
                  Replace the register
                </button>
                <button className="btn" onClick={() => setResult(undefined)}>
                  Discard
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Export and backup</h2>
          <div className="btn-row">
            <button className="btn" onClick={() => download(`supplier-register-${TODAY}.csv`, exportCsv(reg.agreements), 'text/csv')}>
              Export register (CSV)
            </button>
            <button
              className="btn"
              onClick={() => download(`transfer-tracker-backup-${TODAY}.json`, JSON.stringify({ agreements: reg.agreements, settings: reg.settings }, null, 2), 'application/json')}
            >
              Download full backup (JSON)
            </button>
            <label className="btn">
              Restore backup
              <input
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f)
                    readFile(f, (t) => {
                      try {
                        const parsed: unknown = JSON.parse(t)
                        if (!isBackup(parsed)) throw new Error()
                        reg.restore(parsed)
                        setMessage(`Backup restored: ${plural(parsed.agreements.length, 'agreement')}.`)
                      } catch {
                        setMessage('That file is not a backup from this tracker.')
                      }
                    })
                  e.target.value = ''
                }}
              />
            </label>
          </div>
          <p className="muted small">The register is kept in this browser only. Nothing is sent anywhere.</p>

          <h3>Sample data</h3>
          <p className="muted small">A fictional company with 38 invented suppliers, dated relative to today.</p>
          {confirmReset ? (
            <span className="confirm">
              Replace your register with the sample?{' '}
              <button
                className="btn danger"
                onClick={() => {
                  reg.reset()
                  setConfirmReset(false)
                  setMessage('Sample register loaded.')
                }}
              >
                Replace
              </button>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button className="btn" onClick={() => setConfirmReset(true)}>
              Load the sample register
            </button>
          )}
        </section>
      </div>

      <SettingsPanel settings={reg.settings} onChange={reg.setSettings} />
    </div>
  )
}

function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const num = (k: keyof Settings, min: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(min, Math.round(Number(e.target.value) || 0))
    onChange({ ...settings, [k]: v })
  }
  return (
    <section className="panel">
      <h2>Settings</h2>
      <div className="form-grid">
        <label>
          Your name (signs emails, filters follow-ups)
          <input value={settings.me} onChange={(e) => onChange({ ...settings, me: e.target.value })} />
        </label>
        <label>
          Remind suppliers after (days)
          <input type="number" min={1} value={settings.reminderDays} onChange={num('reminderDays', 1)} />
        </label>
        <label>
          Escalate after (reminders)
          <input type="number" min={1} value={settings.escalateAfter} onChange={num('escalateAfter', 1)} />
        </label>
        <label>
          Re-check DPF listings after (days)
          <input type="number" min={30} value={settings.dpfRecheckDays} onChange={num('dpfRecheckDays', 30)} />
        </label>
        <label>
          Annual worldwide turnover (EUR, optional)
          <input type="number" min={0} step={1000000} value={settings.turnoverEur || ''} placeholder="e.g. 25000000000" onChange={num('turnoverEur', 0)} />
        </label>
      </div>
      <p className="muted small">Turnover is used only to show the share-based fine ceilings next to open gaps.</p>
    </section>
  )
}
