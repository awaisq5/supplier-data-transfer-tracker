import { geoArea, geoNaturalEarth1, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import { useMemo } from 'react'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import world from 'world-atlas/countries-110m.json'
import type { AgreementView } from '../domain/documents'
import type { Lists } from '../law/adequacy'
import { countryName, numericToCode } from '../law/countries'
import { isDomestic, type Regime } from '../law/regimes'
import { plural } from './ui'

const W = 960
const H = 470

const topo = world as unknown as Topology
const collection = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>
const shapes = collection.features.filter((f) => f.id !== '010') // Antarctica

const projection = geoNaturalEarth1().fitExtent(
  [
    [4, 4],
    [W - 4, H - 4],
  ],
  { type: 'FeatureCollection', features: shapes },
)
const path = geoPath(projection)

/** Small places the 1:110m map leaves out. */
const FALLBACK: Record<string, [number, number]> = {
  SG: [103.8, 1.35],
  BH: [50.55, 26.07],
  MT: [14.4, 35.9],
  AD: [1.52, 42.5],
  MC: [7.42, 43.73],
  GI: [-5.35, 36.14],
  JE: [-2.13, 49.21],
  GG: [-2.58, 49.45],
  IM: [-4.55, 54.23],
  FO: [-6.9, 62],
  LI: [9.55, 47.16],
  HK: [114.17, 22.32],
  MU: [57.55, -20.3],
}

/** Centre of a country's largest polygon, so France sits in Europe rather than near Guiana. */
function anchor(f: Feature<Geometry>): [number, number] | null {
  const g = f.geometry
  if (g.type === 'Polygon') return path.centroid(f)
  if (g.type !== 'MultiPolygon') return null
  const polys = (g as MultiPolygon).coordinates.map((coordinates): Feature<Polygon> => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } }))
  polys.sort((a, b) => geoArea(b) - geoArea(a))
  return path.centroid(polys[0])
}

const SHAPES = shapes.map((f) => ({ code: numericToCode(String(f.id)), name: f.properties.name, d: path(f) ?? '', feature: f }))
const ANCHORS = new Map<string, [number, number]>()
for (const s of SHAPES) {
  if (!s.code) continue
  const a = anchor(s.feature)
  if (a && Number.isFinite(a[0])) ANCHORS.set(s.code, a)
}
for (const [code, lonlat] of Object.entries(FALLBACK)) {
  if (!ANCHORS.has(code)) ANCHORS.set(code, projection(lonlat) as [number, number])
}

type Fill = 'home' | 'adequate' | 'partial' | 'restricted'

function fillOf(regime: Regime, lists: Lists, code: string | undefined): Fill {
  if (!code) return 'restricted'
  if (isDomestic(regime, code)) return 'home'
  const d = lists[regime].get(code)
  if (!d) return 'restricted'
  return d.scope === 'full' ? 'adequate' : 'partial'
}

const FILL_TEXT: Record<Fill, string> = {
  home: 'inside the territory',
  adequate: 'adequacy',
  partial: 'adequacy for some importers',
  restricted: 'no adequacy: transfers need safeguards',
}

interface Props {
  regime: Regime
  lists: Lists
  views: AgreementView[]
}

export function WorldMap({ regime, lists, views }: Props) {
  const { dots, arcs } = useMemo(() => {
    const byCountry = new Map<string, { agreements: Set<string>; gaps: Set<string>; safeguards: boolean }>()
    const pairs = new Map<string, { from: string; to: string; gap: boolean }>()
    for (const v of views) {
      if (v.bucket === 'ended' || v.bucket === 'out-of-scope') continue
      const transferGap = v.open.some((s) => s.requirement.tier === 'transfer' && s.requirement.regimes.includes(regime))
      for (const f of v.flows) {
        if (f.regime !== regime || f.basis === 'domestic' || f.basis === 'supplier-controller') continue
        const c = f.destination.country
        const e = byCountry.get(c) ?? { agreements: new Set(), gaps: new Set(), safeguards: false }
        e.agreements.add(v.agreement.id)
        const gap = f.basis === 'safeguards' && transferGap
        if (gap) e.gaps.add(v.agreement.id)
        if (f.basis === 'safeguards') e.safeguards = true
        byCountry.set(c, e)
        for (const x of v.agreement.exporters) {
          if (!isDomestic(regime, x)) continue
          const key = `${x}>${c}`
          const p = pairs.get(key) ?? { from: x, to: c, gap: false }
          p.gap ||= gap
          pairs.set(key, p)
        }
      }
    }
    return {
      dots: [...byCountry].map(([code, e]) => ({ code, count: e.agreements.size, gaps: e.gaps.size, safeguards: e.safeguards })),
      arcs: [...pairs.values()],
    }
  }, [views, regime])

  return (
    <figure className="map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`World map of where suppliers receive personal data from ${regime} entities`}>
        <g>
          {SHAPES.map((s, i) => {
            const fill = fillOf(regime, lists, s.code)
            return (
              <path key={i} d={s.d} className={`land land-${fill}`}>
                <title>{`${s.code ? countryName(s.code) : s.name}: ${FILL_TEXT[fill]}`}</title>
              </path>
            )
          })}
        </g>
        <g className="arcs">
          {arcs.map((a) => {
            const p = ANCHORS.get(a.from)
            const q = ANCHORS.get(a.to)
            if (!p || !q) return null
            const mx = (p[0] + q[0]) / 2
            const my = (p[1] + q[1]) / 2 - Math.min(90, Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.22)
            return <path key={`${a.from}${a.to}`} d={`M${p[0]},${p[1]} Q${mx},${my} ${q[0]},${q[1]}`} className={a.gap ? 'arc arc-gap' : 'arc'} />
          })}
        </g>
        <g>
          {dots.map((d) => {
            const p = ANCHORS.get(d.code)
            if (!p) return null
            const r = 3.5 + Math.sqrt(d.count) * 2.6
            return (
              <circle key={d.code} cx={p[0]} cy={p[1]} r={r} className={d.gaps ? 'dot dot-gap' : d.safeguards ? 'dot dot-ok' : 'dot dot-adequate'}>
                <title>{`${countryName(d.code)}: ${plural(d.count, 'agreement')}${d.gaps ? `, ${d.gaps} with open transfer documents` : ''}`}</title>
              </circle>
            )
          })}
        </g>
      </svg>
      <figcaption className="legend">
        <span><i className="sw land-home" /> Inside the {regime === 'EU' ? 'EEA' : regime === 'UK' ? 'UK' : 'Swiss'} territory</span>
        <span><i className="sw land-adequate" /> Adequacy</span>
        <span><i className="sw land-partial" /> Adequacy for some importers</span>
        <span><i className="sw land-restricted" /> Needs safeguards</span>
        <span><i className="sw dot-gap round" /> Suppliers with open transfer documents</span>
        <span><i className="sw dot-ok round" /> Safeguards complete</span>
        <span><i className="sw dot-adequate round" /> Covered by adequacy</span>
      </figcaption>
    </figure>
  )
}
