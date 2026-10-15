import type { ReactNode } from 'react'
import { BUCKET_LABEL, type Bucket, PROGRESS_LABEL } from '../domain/documents'
import type { Basis, Progress } from '../domain/types'
import { countryName } from '../law/countries'
import type { Regime } from '../law/regimes'

export function BucketChip({ bucket }: { bucket: Bucket }) {
  return <span className={`chip bucket-${bucket}`}>{BUCKET_LABEL[bucket]}</span>
}

export function ProgressChip({ progress }: { progress: Progress }) {
  return <span className={`chip progress-${progress}`}>{PROGRESS_LABEL[progress]}</span>
}

export const BASIS_LABEL: Record<Basis, string> = {
  domestic: 'No transfer',
  adequacy: 'Adequacy',
  safeguards: 'Needs safeguards',
  'supplier-controller': 'Supplier’s own transfer',
}

export function BasisChip({ basis }: { basis: Basis }) {
  return <span className={`chip basis-${basis}`}>{BASIS_LABEL[basis]}</span>
}

export const REGIME_SHORT: Record<Regime, string> = { EU: 'EU', UK: 'UK', CH: 'CH' }

export function RegimeTags({ regimes }: { regimes: Regime[] }) {
  if (!regimes.length) return <span className="muted small">outside EU, UK and CH rules</span>
  return (
    <span className="regime-tags">
      {regimes.map((r) => (
        <span key={r} className={`regime regime-${r}`} title={r === 'EU' ? 'EU/EEA (GDPR)' : r === 'UK' ? 'United Kingdom (UK GDPR)' : 'Switzerland (FADP)'}>
          {REGIME_SHORT[r]}
        </span>
      ))}
    </span>
  )
}

export function Countries({ codes }: { codes: string[] }) {
  return <>{codes.map(countryName).join(', ')}</>
}

export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: string }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  )
}

export const fmt = (n: number) => n.toLocaleString('en-GB')

export function money(n: number, currency: 'EUR' | 'GBP' | 'CHF'): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : 'CHF '
  if (n >= 1e9) return `${symbol}${(n / 1e9).toFixed(1)} bn`
  if (n >= 1e6) return `${symbol}${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)} m`
  return `${symbol}${fmt(Math.round(n))}`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${fmt(n)} ${n === 1 ? one : many}`
}

export function copyText(text: string): Promise<boolean> {
  try {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    )
  } catch {
    return Promise.resolve(false)
  }
}

export function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
