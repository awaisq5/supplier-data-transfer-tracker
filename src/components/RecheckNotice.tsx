import { listAges } from '../law/adequacy'
import type { Regime } from '../law/regimes'
import { TODAY } from '../state/store'

const SHORT: Record<Regime, string> = { EU: 'Commission', UK: 'ICO', CH: 'Swiss' }

/** Shown once any adequacy list is older than the re-check interval. */
export function RecheckNotice() {
  const overdue = listAges(TODAY).filter((a) => a.overdue)
  if (!overdue.length) return null
  const sameDate = overdue.every((a) => a.list.checkedOn === overdue[0].list.checkedOn)
  return (
    <p className="banner" role="status">
      <strong>Re-check the adequacy lists.</strong> The{' '}
      {overdue.map((a, i) => (
        <span key={a.list.regime}>
          {i > 0 && (i === overdue.length - 1 ? ' and ' : ', ')}
          <a href={a.list.source} target="_blank" rel="noreferrer">
            {SHORT[a.list.regime]}
          </a>
          {!sameDate && ` (${a.list.checkedOn})`}
        </span>
      ))}{' '}
      {overdue.length === 1 ? 'list was' : 'lists were'} last checked
      {sameDate ? ` on ${overdue[0].list.checkedOn}, ${overdue[0].days} days ago` : ' over six months ago'}. Decisions are
      added and struck down, so check the sources before relying on these results.
    </p>
  )
}
