import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Activity, Settings, MousePointerClick, Terminal, Link2 } from 'lucide-react'
import { CardShell } from '@/components/settings/CardShell'
import { StatusBadge } from '@/components/settings/StatusBadge'
import { FieldRow } from '@/components/settings/FieldRow'
import { ConnectedValue } from '@/components/settings/ConnectedValue'
import { FeedbackMessage } from '@/components/FeedbackMessage'
import { api } from '@/lib/api'

export function SystemSettingsPage() {
  return (
    <div className="system-settings">
      <a href="/" className="system-settings-back">
        <ArrowLeft size={14} /> Home
      </a>
      <div className="system-settings-header">
        <h1>System Settings</h1>
      </div>
      <div className="system-settings-cards">
        <ServiceStatusCard />
        <GeneralSettingsCard />
        <ClickUpCard />
        <ConsoleCard />
        <PairingCard />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Service Status
// ---------------------------------------------------------------------------

function ServiceStatusCard() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null)
  const [status, setStatus] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([
      api.health().catch(() => null),
      api.status().catch(() => null),
    ]).then(([h, s]) => {
      setHealth(h)
      setStatus(s)
      if (!h && !s) setError(true)
    })
  }, [])

  const isOk = health !== null && !error
  const mode = (status?.mode as string) ?? 'unknown'
  const dbOk = (health?.database as string) === 'ok' || (health?.db as string) === 'ok'

  return (
    <CardShell
      icon={<Activity size={20} />}
      iconBg={isOk ? 'icon-green' : 'icon-red'}
      title="Service Status"
      badge={<StatusBadge ok={isOk} label={isOk ? 'Healthy' : 'Error'} />}
    >
      <FieldRow label="Service">{isOk ? 'Running' : 'Unreachable'}</FieldRow>
      <FieldRow label="Mode">{mode}</FieldRow>
      <FieldRow label="Database">
        <StatusBadge ok={dbOk} label={dbOk ? 'Connected' : 'Unknown'} />
      </FieldRow>
      {health?.version != null && <FieldRow label="Version">{String(health.version)}</FieldRow>}
    </CardShell>
  )
}

// ---------------------------------------------------------------------------
// General Settings
// ---------------------------------------------------------------------------

function GeneralSettingsCard() {
  const [logLevel, setLogLevel] = useState('INFO')
  const [roots, setRoots] = useState<string[]>([])
  const [excludes, setExcludes] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackErr, setFeedbackErr] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.config.get().then(cfg => {
      setLogLevel((cfg.log_level as string) ?? 'INFO')
      setRoots((cfg.allowed_roots as string[]) ?? [])
      const ex = cfg.excludes
      setExcludes(Array.isArray(ex) ? ex.join(', ') : (ex as string) ?? '')
    }).catch(() => {
      setFeedback('\u2717 Could not load config')
      setFeedbackErr(true)
    })
  }, [])

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    setFeedback('')
    try {
      const r = await api.config.save(patch)
      if (r.ok) { setFeedback('\u2713 Saved'); setFeedbackErr(false) }
      else { setFeedback('\u2717 Error'); setFeedbackErr(true) }
    } catch {
      setFeedback('\u2717 Network error'); setFeedbackErr(true)
    }
    setSaving(false)
  }

  const addRoot = async () => {
    const d = await api.config.selectFolder()
    if (d.path && !roots.includes(d.path)) {
      const next = [...roots, d.path]
      setRoots(next)
      await save({ allowed_roots: next })
    }
  }

  const removeRoot = (idx: number) => {
    const next = roots.filter((_, i) => i !== idx)
    setRoots(next)
    save({ allowed_roots: next })
  }

  return (
    <CardShell icon={<Settings size={20} />} iconBg="icon-blue" title="General">
      <FieldRow label="Log Level">
        <select
          className="setting-input"
          value={logLevel}
          onChange={e => { setLogLevel(e.target.value); save({ log_level: e.target.value }) }}
          style={{ width: '140px' }}
        >
          {['DEBUG', 'INFO', 'WARNING', 'ERROR'].map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </FieldRow>

      <div>
        <span className="field-row-label" style={{ display: 'block', marginBottom: '8px' }}>Allowed Roots</span>
        {roots.length === 0 ? (
          <span className="not-configured">No roots configured</span>
        ) : (
          roots.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="configured-value" style={{ flex: 1, wordBreak: 'break-all' }}>{r}</span>
              <button className="btn btn-sm btn-danger" onClick={() => removeRoot(i)}>&times;</button>
            </div>
          ))
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button className="btn btn-sm" onClick={addRoot}>+ Browse</button>
          <button className="btn btn-sm" onClick={() => {
            const path = prompt('Enter folder path:')
            if (path?.trim() && !roots.includes(path.trim())) {
              const next = [...roots, path.trim()]
              setRoots(next)
              save({ allowed_roots: next })
            }
          }}>+ Type Path</button>
        </div>
      </div>

      <FieldRow label="Excludes">
        <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
          <input
            type="text"
            className="setting-input"
            value={excludes}
            onChange={e => setExcludes(e.target.value)}
            placeholder="pattern1, pattern2"
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-sm btn-primary"
            disabled={saving}
            onClick={() => save({ excludes: excludes.split(',').map(s => s.trim()).filter(Boolean) })}
          >
            Save
          </button>
        </div>
      </FieldRow>

      <FeedbackMessage message={feedback} isError={feedbackErr} />
    </CardShell>
  )
}

// ---------------------------------------------------------------------------
// ClickUp Integration
// ---------------------------------------------------------------------------

function ClickUpCard() {
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [connected, setConnected] = useState<boolean | null>(null)
  const [workspace, setWorkspace] = useState('')
  const [testing, setTesting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackErr, setFeedbackErr] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.config.get().then(cfg => {
      setConfig(cfg)
      const hasToken = Boolean(cfg.clickup_token)
      if (hasToken) {
        api.clickup.validate().then(v => {
          setConnected(v.ok)
          if (v.workspace) setWorkspace(v.workspace)
        }).catch(() => setConnected(false))
      } else {
        setConnected(false)
      }
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const testConnection = async () => {
    setTesting(true)
    setFeedback('')
    try {
      const v = await api.clickup.validate()
      setConnected(v.ok)
      if (v.ok) {
        setFeedback('\u2713 Connection successful')
        setFeedbackErr(false)
        if (v.workspace) setWorkspace(v.workspace)
      } else {
        setFeedback(`\u2717 ${v.error ?? 'Validation failed'}`)
        setFeedbackErr(true)
      }
    } catch {
      setFeedback('\u2717 Network error')
      setFeedbackErr(true)
    }
    setTesting(false)
  }

  const saveField = async (key: string, value: string) => {
    try {
      const r = await api.config.save({ [key]: value })
      if (r.ok) {
        setConfig(prev => ({ ...prev, [key]: value }))
        setFeedback('\u2713 Saved')
        setFeedbackErr(false)
      }
    } catch {
      setFeedback('\u2717 Save failed')
      setFeedbackErr(true)
    }
  }

  if (!loaded) return null

  return (
    <CardShell
      icon={<MousePointerClick size={20} />}
      iconBg="icon-purple"
      title="ClickUp"
      badge={connected !== null ? <StatusBadge ok={connected} label={connected ? 'Connected' : 'Not connected'} /> : undefined}
    >
      <FieldRow label="API Token">
        <ConnectedValue
          value={(config.clickup_token as string) ?? ''}
          password
          placeholder="pk_..."
          onSave={v => saveField('clickup_token', v)}
          onClear={async () => { await saveField('clickup_token', ''); setConnected(false) }}
        />
      </FieldRow>

      {connected && workspace && (
        <FieldRow label="Workspace">{workspace}</FieldRow>
      )}

      <FieldRow label="Workspace ID">
        <ConnectedValue
          value={String(config.clickup_workspace_id ?? '')}
          placeholder="9014240887"
          onSave={v => saveField('clickup_workspace_id', v)}
        />
      </FieldRow>

      <FieldRow label="Space ID">
        <ConnectedValue
          value={String(config.clickup_space_id ?? '')}
          placeholder="90141234567"
          onSave={v => saveField('clickup_space_id', v)}
        />
      </FieldRow>

      <FieldRow label="Template List ID">
        <ConnectedValue
          value={String(config.clickup_template_list_id ?? '')}
          placeholder="901414366813"
          onSave={v => saveField('clickup_template_list_id', v)}
        />
      </FieldRow>

      <FieldRow label="Template Sync">
        <label className="toggle">
          <input
            type="checkbox"
            checked={Boolean(config.clickup_template_sync)}
            onChange={e => saveField('clickup_template_sync', String(e.target.checked))}
          />
          <span className="toggle-slider" />
        </label>
      </FieldRow>

      <FieldRow label="Artist List ID">
        <ConnectedValue
          value={String(config.clickup_artist_list_id ?? '')}
          placeholder="901400000000"
          onSave={v => saveField('clickup_artist_list_id', v)}
        />
      </FieldRow>

      <ArtistSyncRow listId={String(config.clickup_artist_list_id ?? '')} connected={connected === true} />

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button className="btn btn-sm" onClick={testConnection} disabled={testing}>
          {testing ? 'Testing\u2026' : 'Test Connection'}
        </button>
        <FeedbackMessage message={feedback} isError={feedbackErr} />
      </div>
    </CardShell>
  )
}

function ArtistSyncRow({ listId, connected }: { listId: string; connected: boolean }) {
  const [syncing, setSyncing] = useState(false)
  const [preview, setPreview] = useState<{ created: number; updated: number; unchanged: number; errors: string[] } | null>(null)
  const [feedback, setFeedback] = useState('')
  const [feedbackErr, setFeedbackErr] = useState(false)

  const dryRun = async () => {
    if (!listId) { setFeedback('\u2717 Set Artist List ID first'); setFeedbackErr(true); return }
    setSyncing(true); setFeedback('')
    try {
      const result = await api.clickup.artistSync(listId, true)
      setPreview(result)
      setFeedback(`Will create ${result.created}, update ${result.updated}, ${result.unchanged} unchanged`)
      setFeedbackErr(false)
    } catch (e) {
      setFeedback(`\u2717 ${e}`); setFeedbackErr(true)
    }
    setSyncing(false)
  }

  const apply = async () => {
    if (!listId) return
    setSyncing(true); setFeedback('')
    try {
      const result = await api.clickup.artistSync(listId, false)
      setPreview(null)
      setFeedback(`\u2713 Created ${result.created}, updated ${result.updated}${result.errors.length ? `, ${result.errors.length} errors` : ''}`)
      setFeedbackErr(result.errors.length > 0)
    } catch (e) {
      setFeedback(`\u2717 ${e}`); setFeedbackErr(true)
    }
    setSyncing(false)
  }

  if (!connected) return null

  return (
    <FieldRow label="Artist Sync">
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={dryRun} disabled={syncing || !listId}>
          {syncing ? 'Syncing\u2026' : 'Preview Sync'}
        </button>
        {preview && (
          <button className="btn btn-sm btn-primary" onClick={apply} disabled={syncing}>
            Apply Sync
          </button>
        )}
        <FeedbackMessage message={feedback} isError={feedbackErr} />
      </div>
    </FieldRow>
  )
}

// ---------------------------------------------------------------------------
// Console (log viewer)
// ---------------------------------------------------------------------------

function ConsoleCard() {
  const [lines, setLines] = useState<string[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const autoScroll = useRef(true)

  useEffect(() => {
    // Load initial logs
    fetch('/logs?limit=100')
      .then(r => r.ok ? r.json() : [])
      .then((data: string[]) => { if (Array.isArray(data)) setLines(data) })
      .catch(() => {})

    // Stream new logs
    const es = new EventSource('/logs/stream')
    es.onmessage = (e) => {
      setLines(prev => {
        const next = [...prev, e.data]
        return next.length > 500 ? next.slice(-500) : next
      })
    }
    return () => es.close()
  }, [])

  useEffect(() => {
    if (autoScroll.current && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [lines])

  const onScroll = useCallback(() => {
    if (!logRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = logRef.current
    autoScroll.current = scrollHeight - scrollTop - clientHeight < 40
  }, [])

  return (
    <CardShell icon={<Terminal size={20} />} iconBg="icon-blue" title="Console">
      <div
        ref={logRef}
        className="console-log"
        onScroll={onScroll}
      >
        {lines.length === 0
          ? 'No log entries.'
          : lines.map((line, i) => <div key={i}>{line}</div>)
        }
      </div>
    </CardShell>
  )
}

// ---------------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------------

function PairingCard() {
  const [paired, setPaired] = useState<boolean | null>(null)
  const [pairCode, setPairCode] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackErr, setFeedbackErr] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/pair/status')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setPaired(Boolean(data.paired))
      })
      .catch(() => setPaired(null))
  }, [])

  const doPair = async () => {
    if (!pairCode.trim()) return
    setLoading(true)
    setFeedback('')
    try {
      const r = await fetch('/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairCode.trim() }),
      })
      const data = await r.json()
      if (r.ok && data.ok) {
        setPaired(true)
        setFeedback('\u2713 Paired successfully')
        setFeedbackErr(false)
        setPairCode('')
      } else {
        setFeedback(`\u2717 ${data.error ?? 'Pairing failed'}`)
        setFeedbackErr(true)
      }
    } catch {
      setFeedback('\u2717 Network error')
      setFeedbackErr(true)
    }
    setLoading(false)
  }

  const doUnpair = async () => {
    if (!confirm('Unpair from AutoArt? You will need a new code to re-pair.')) return
    setLoading(true)
    try {
      const r = await fetch('/pair', { method: 'DELETE' })
      if (r.ok) {
        setPaired(false)
        setFeedback('\u2713 Unpaired')
        setFeedbackErr(false)
      }
    } catch {
      setFeedback('\u2717 Error')
      setFeedbackErr(true)
    }
    setLoading(false)
  }

  return (
    <CardShell
      icon={<Link2 size={20} />}
      iconBg="icon-blue"
      title="AutoArt Pairing"
      badge={paired !== null ? <StatusBadge ok={paired} label={paired ? 'Paired' : 'Not paired'} /> : undefined}
    >
      {paired ? (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-sm btn-danger" onClick={doUnpair} disabled={loading}>Unpair</button>
          <FeedbackMessage message={feedback} isError={feedbackErr} />
        </div>
      ) : (
        <>
          <FieldRow label="Pair Code">
            <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
              <input
                type="text"
                className="setting-input"
                value={pairCode}
                onChange={e => setPairCode(e.target.value)}
                placeholder="Enter pairing code"
                style={{ flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter') doPair() }}
              />
              <button className="btn btn-primary btn-sm" onClick={doPair} disabled={loading || !pairCode.trim()}>
                {loading ? 'Pairing\u2026' : 'Pair'}
              </button>
            </div>
          </FieldRow>
          <FeedbackMessage message={feedback} isError={feedbackErr} />
        </>
      )}
    </CardShell>
  )
}
