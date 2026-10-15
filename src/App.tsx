import { useCallback, useEffect, useMemo, useState } from 'react'
import { AgreementDrawer } from './components/AgreementDrawer'
import { AgreementEditor } from './components/AgreementEditor'
import { DataPage } from './pages/DataPage'
import { FollowUps } from './pages/FollowUps'
import { Overview } from './pages/Overview'
import { RegisterPage } from './pages/RegisterPage'
import { Rules } from './pages/Rules'
import { WhatIf } from './pages/WhatIf'
import { TODAY, useRegister } from './state/store'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'register', label: 'Register' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'rules', label: 'Transfer check' },
  { id: 'whatif', label: 'What if' },
  { id: 'data', label: 'Data' },
] as const

type Tab = (typeof TABS)[number]['id']

function initialTab(): Tab {
  const h = window.location.hash.slice(1)
  return (TABS.find((t) => t.id === h)?.id ?? 'overview') as Tab
}

export function App() {
  const reg = useRegister()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [openId, setOpenId] = useState<string>()
  const [editing, setEditing] = useState<{ id?: string } | undefined>()

  useEffect(() => {
    const onHash = () => {
      setTab(initialTab())
      setOpenId(undefined)
      setEditing(undefined)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((t: string) => {
    window.location.hash = t
    setTab(t as Tab)
    setOpenId(undefined)
    window.scrollTo(0, 0)
  }, [])

  const openView = useMemo(() => reg.views.find((v) => v.agreement.id === openId), [reg.views, openId])
  const editAgreement = editing?.id ? reg.agreements.find((a) => a.id === editing.id) : undefined
  const nextId = useMemo(() => {
    const n = Math.max(1000, ...reg.agreements.map((a) => Number(/(\d+)$/.exec(a.id)?.[1] ?? 0)))
    return `AGR-${n + 1}`
  }, [reg.agreements])

  const closeDrawer = useCallback(() => setOpenId(undefined), [])
  const closeEditor = useCallback(() => setEditing(undefined), [])
  const open = tab === 'overview' || tab === 'register' || tab === 'followups' || tab === 'whatif'

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <circle cx="6" cy="12" r="3.2" />
              <circle cx="18" cy="6" r="2.6" />
              <circle cx="18" cy="18" r="2.6" />
              <path d="M8.8 10.6 15.6 7.2M8.8 13.4l6.8 3.4" />
            </svg>
          </span>
          <div>
            <div className="brand-name">Supplier data transfer tracker</div>
            <div className="brand-sub">GDPR, UK GDPR and Swiss FADP transfers to suppliers · demo with synthetic data</div>
          </div>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={(e) => (e.preventDefault(), go(t.id))}>
              {t.label}
            </a>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'overview' && <Overview reg={reg} onOpen={setOpenId} onTab={go} />}
        {tab === 'register' && <RegisterPage reg={reg} onOpen={setOpenId} onNew={() => setEditing({})} />}
        {tab === 'followups' && <FollowUps reg={reg} onOpen={setOpenId} />}
        {tab === 'rules' && <Rules />}
        {tab === 'whatif' && <WhatIf reg={reg} onOpen={setOpenId} />}
        {tab === 'data' && <DataPage reg={reg} />}
      </main>

      <footer className="foot">
        Not legal advice. The rules are simplified to what supplier onboarding needs; derogations (Art. 49 GDPR), binding corporate rules and importers already subject to the GDPR are not modelled.{' '}
        <a href="https://github.com/awaisq5/supplier-data-transfer-tracker">Source on GitHub</a>
      </footer>

      {open && openView && !editing && (
        <AgreementDrawer
          view={openView}
          settings={reg.settings}
          today={TODAY}
          onUpdate={reg.update}
          onEdit={() => setEditing({ id: openView.agreement.id })}
          onDelete={() => {
            reg.remove(openView.agreement.id)
            setOpenId(undefined)
          }}
          onClose={closeDrawer}
        />
      )}
      {editing && (
        <AgreementEditor
          key={editing.id ?? 'new'}
          original={editAgreement}
          nextId={nextId}
          settings={reg.settings}
          today={TODAY}
          onSave={(a) => {
            reg.update(a)
            setEditing(undefined)
            setOpenId(a.id)
          }}
          onCancel={closeEditor}
        />
      )}
    </div>
  )
}
