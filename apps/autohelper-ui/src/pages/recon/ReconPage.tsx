import { useState, useEffect, useCallback } from 'preact/hooks'
import { Nav } from '@/components/Nav'
import { CategoryBadge } from '@/components/CategoryBadge'
import { api } from '@/lib/api'
import { capitalize } from '@/lib/helpers'
import type {
  ReconciliationData,
  AdminFile,
  ReconOrphan,
  ReconStalled,
  ReconFuzzy,
  ReconPanelGap,
  ReconDuplicate,
  ReconVariant,
  ReconAliasConflict,
} from '@/lib/types'

type TabKey = keyof ReconciliationData | 'unattributed_files'

const ENGAGEMENT_TABS: { key: TabKey; label: string; countId: string }[] = [
  { key: 'orphan_eois', label: 'Orphan EOIs', countId: 'eois' },
  { key: 'orphan_proposals', label: 'Orphan Proposals', countId: 'proposals' },
  { key: 'stalled_projects', label: 'Stalled', countId: 'stalled' },
  { key: 'fuzzy_matches', label: 'Fuzzy Matches', countId: 'fuzzy' },
  { key: 'panel_gaps', label: 'Panel Gaps', countId: 'panels' },
]

const QUALITY_TABS: { key: TabKey; label: string; countId: string }[] = [
  { key: 'duplicate_artists', label: 'Duplicate Names', countId: 'dupes' },
  { key: 'affiliation_variants', label: 'Affiliation Variants', countId: 'affs' },
  { key: 'identity_inconsistencies', label: 'Identity Dupes', countId: 'ids' },
  { key: 'alias_conflicts', label: 'Alias Conflicts', countId: 'aliases' },
  { key: 'location_variants', label: 'Location Variants', countId: 'locs' },
]

function artistLink(id: string, name: string) {
  return (
    <span class="recon-name">
      <a class="clickable-name" href={`/artists-dashboard#${encodeURIComponent(id)}`}>{name}</a>
    </span>
  )
}

export function ReconPage() {
  const [reconData, setReconData] = useState<ReconciliationData | null>(null)
  const [adminFiles, setAdminFiles] = useState<AdminFile[]>([])
  const [activeTab, setActiveTab] = useState<TabKey>('orphan_eois')

  const load = useCallback(async () => {
    const [r, a] = await Promise.all([
      api.artists.reconciliation().catch(() => null),
      api.artists.adminFiles().catch(() => []),
    ])
    if (r) setReconData(r)
    setAdminFiles(a)
  }, [])

  useEffect(() => { load() }, [load])

  const reconAction = async (action: string, artistId: string, projectName: string, projectIndex?: number, newStatus?: string) => {
    const body: Record<string, unknown> = { action, artist_id: artistId }
    if (projectName) { body.project_name = projectName; body.eoi_name = projectName }
    if (projectIndex !== undefined) body.project_index = projectIndex
    if (newStatus) body.new_status = newStatus
    await api.artists.resolveRecon(body)
    load()
  }

  const mergeValues = async (action: string, oldValue: string, newValue: string) => {
    await api.artists.resolveRecon({ action, old_value: oldValue, new_value: newValue })
    load()
  }

  const attributeFile = async (fileId: string, artistId: string) => {
    await api.artists.attributeFile(fileId, artistId)
    load()
  }

  const attributeFileSearch = async (fileId: string) => {
    const query = prompt('Search for artist name:')
    if (!query) return
    try {
      const res = await fetch(`/artists?q=${encodeURIComponent(query)}&limit=10`)
      const artists = await res.json()
      if (!artists.length) { alert('No artists found for: ' + query); return }
      const choices = artists.map((a: { display_name: string; artist_id: string }, i: number) =>
        `${i + 1}. ${a.display_name} (${a.artist_id})`
      ).join('\n')
      const pick = prompt('Select artist:\n' + choices + '\n\nEnter number:')
      if (!pick) return
      const idx = parseInt(pick, 10) - 1
      if (idx >= 0 && idx < artists.length) {
        await attributeFile(fileId, artists[idx].artist_id)
      }
    } catch { /* ignore */ }
  }

  function getCount(key: TabKey): number {
    if (key === 'unattributed_files') return adminFiles.length
    return (reconData?.[key as keyof ReconciliationData] as unknown[] ?? []).length
  }

  return (
    <>
      <Nav active="recon" />

      <header class="header">
        <h1>Reconciliation</h1>
        <div class="header-actions">
          <button class="btn btn-ghost" onClick={load}>&#x27F3; Reload</button>
        </div>
      </header>

      <div class="health-card full-width" style={{ marginBottom: '16px' }}>
        <h3>Engagement Pipeline</h3>
        <TabBar tabs={ENGAGEMENT_TABS} active={activeTab} onSelect={setActiveTab} getCount={getCount} />

        <p style={{ fontSize: '11px', color: 'var(--fg-disabled)', margin: '8px 0' }}>Data quality</p>
        <TabBar tabs={QUALITY_TABS} active={activeTab} onSelect={setActiveTab} getCount={getCount} />

        <p style={{ fontSize: '11px', color: 'var(--fg-disabled)', margin: '8px 0' }}>Unattributed</p>
        <TabBar
          tabs={[{ key: 'unattributed_files' as TabKey, label: 'Unattributed Files', countId: 'unattributed' }]}
          active={activeTab}
          onSelect={setActiveTab}
          getCount={getCount}
        />

        <div>
          <TabContent
            tab={activeTab}
            reconData={reconData}
            adminFiles={adminFiles}
            reconAction={reconAction}
            mergeValues={mergeValues}
            attributeFile={attributeFile}
            attributeFileSearch={attributeFileSearch}
          />
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Tab Bar
// ---------------------------------------------------------------------------

function TabBar({ tabs, active, onSelect, getCount }: {
  tabs: { key: TabKey; label: string; countId: string }[]
  active: TabKey
  onSelect: (key: TabKey) => void
  getCount: (key: TabKey) => number
}) {
  return (
    <div class="recon-tabs">
      {tabs.map(t => (
        <button
          key={t.key}
          class={`recon-tab${t.key === active ? ' active' : ''}`}
          onClick={() => onSelect(t.key)}
        >
          {t.label} <span class="recon-count">{getCount(t.key)}</span>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab Content Router
// ---------------------------------------------------------------------------

function TabContent({ tab, reconData, adminFiles, reconAction, mergeValues, attributeFile, attributeFileSearch }: {
  tab: TabKey
  reconData: ReconciliationData | null
  adminFiles: AdminFile[]
  reconAction: (action: string, artistId: string, projectName: string, projectIndex?: number, newStatus?: string) => void
  mergeValues: (action: string, oldValue: string, newValue: string) => void
  attributeFile: (fileId: string, artistId: string) => void
  attributeFileSearch: (fileId: string) => void
}) {
  if (!reconData && tab !== 'unattributed_files') return <p class="empty">Loading...</p>

  switch (tab) {
    case 'orphan_eois': return <OrphanList items={reconData!.orphan_eois} reconAction={reconAction} />
    case 'orphan_proposals': return <OrphanList items={reconData!.orphan_proposals} reconAction={reconAction} showDeveloper />
    case 'stalled_projects': return <StalledList items={reconData!.stalled_projects} reconAction={reconAction} />
    case 'fuzzy_matches': return <FuzzyList items={reconData!.fuzzy_matches} reconAction={reconAction} />
    case 'panel_gaps': return <PanelGapList items={reconData!.panel_gaps} />
    case 'duplicate_artists': return <DuplicateList items={reconData!.duplicate_artists} />
    case 'affiliation_variants': return <VariantList items={reconData!.affiliation_variants} actionType="merge_affiliation" mergeValues={mergeValues} reconAction={reconAction} />
    case 'identity_inconsistencies': return <VariantList items={reconData!.identity_inconsistencies} actionType="merge_identity" mergeValues={mergeValues} reconAction={reconAction} />
    case 'alias_conflicts': return <AliasConflictList items={reconData!.alias_conflicts} />
    case 'location_variants': return <VariantList items={reconData!.location_variants} actionType="merge_location" mergeValues={mergeValues} reconAction={reconAction} />
    case 'unattributed_files': return <UnattributedList items={adminFiles} attributeFile={attributeFile} attributeFileSearch={attributeFileSearch} />
    default: return <p class="empty">Unknown tab</p>
  }
}

// ---------------------------------------------------------------------------
// Engagement renderers
// ---------------------------------------------------------------------------

function OrphanList({ items, reconAction, showDeveloper }: {
  items: ReconOrphan[]
  reconAction: (action: string, artistId: string, projectName: string) => void
  showDeveloper?: boolean
}) {
  if (!items.length) return <p class="empty">No items</p>
  return (
    <>
      {items.map((item, i) => (
        <div key={i} class="recon-item">
          {artistLink(item.artist_id, item.display_name)}
          <span class="recon-meta">
            {item.project_name}
            {showDeveloper && item.developer ? ` — ${item.developer}` : ''}
          </span>
          <button class="btn btn-sm btn-primary" onClick={() => reconAction('link_eoi', item.artist_id, item.project_name)}>Link</button>
          <button class="btn btn-sm" onClick={() => reconAction('dismiss', item.artist_id, '')}>Dismiss</button>
        </div>
      ))}
    </>
  )
}

function StalledList({ items, reconAction }: {
  items: ReconStalled[]
  reconAction: (action: string, artistId: string, projectName: string, projectIndex?: number, newStatus?: string) => void
}) {
  if (!items.length) return <p class="empty">No items</p>
  return (
    <>
      {items.map((item, i) => (
        <div key={i} class="recon-item">
          {artistLink(item.artist_id, item.display_name)}
          <span class="recon-meta">{item.project_name} [{item.status}]</span>
          <button class="btn btn-sm btn-primary" onClick={() => reconAction('advance_status', item.artist_id, '', item.project_index, 'completed')}>Complete</button>
          <button class="btn btn-sm" onClick={() => reconAction('dismiss', item.artist_id, '')}>Dismiss</button>
        </div>
      ))}
    </>
  )
}

function FuzzyList({ items, reconAction }: {
  items: ReconFuzzy[]
  reconAction: (action: string, artistId: string, projectName: string) => void
}) {
  if (!items.length) return <p class="empty">No items</p>
  return (
    <>
      {items.map((item, i) => (
        <div key={i} class="recon-item">
          {artistLink(item.artist_id, item.display_name)}
          <span class="recon-meta">{item.source_name} &rarr; {item.match_name}</span>
          <span class="recon-match-score">{Math.round(item.score * 100)}%</span>
          <button class="btn btn-sm btn-primary" onClick={() => reconAction('link_eoi', item.artist_id, item.source_name)}>Link</button>
          <button class="btn btn-sm" onClick={() => reconAction('dismiss', item.artist_id, '')}>Dismiss</button>
        </div>
      ))}
    </>
  )
}

function PanelGapList({ items }: { items: ReconPanelGap[] }) {
  if (!items.length) return <p class="empty">No items</p>
  return (
    <>
      {items.map((item, i) => (
        <div key={i} class="recon-item">
          {artistLink(item.artist_id, item.display_name)}
          <span class="recon-meta">{item.panel_count} panel(s), no projects</span>
        </div>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Data quality renderers
// ---------------------------------------------------------------------------

function DuplicateList({ items }: { items: ReconDuplicate[] }) {
  if (!items.length) return <p class="empty">No items</p>
  return (
    <>
      {items.map((item, i) => (
        <div key={i} class="recon-item">
          <a class="clickable-name" href={`/artists-dashboard#${encodeURIComponent(item.artist_id_a)}`}>{item.name_a}</a>
          <span class="recon-meta">&harr;</span>
          <a class="clickable-name" href={`/artists-dashboard#${encodeURIComponent(item.artist_id_b)}`}>{item.name_b}</a>
          <span class="recon-match-score">{Math.round(item.score * 100)}%</span>
        </div>
      ))}
    </>
  )
}

function VariantList({ items, actionType, mergeValues, reconAction }: {
  items: ReconVariant[]
  actionType: string
  mergeValues: (action: string, oldValue: string, newValue: string) => void
  reconAction: (action: string, artistId: string, projectName: string) => void
}) {
  if (!items.length) return <p class="empty">No items</p>
  return (
    <>
      {items.map((item, i) => (
        <div key={i} class="recon-item">
          <span class="recon-name">
            {item.value_a} <span style={{ color: 'var(--fg-disabled)', fontSize: '11px' }}>({item.count_a})</span>
          </span>
          <span class="recon-meta">&harr;</span>
          <span class="recon-name">
            {item.value_b} <span style={{ color: 'var(--fg-disabled)', fontSize: '11px' }}>({item.count_b})</span>
          </span>
          <span class="recon-match-score">{Math.round(item.score * 100)}%</span>
          <button class="btn btn-sm btn-primary" onClick={() => mergeValues(actionType, item.value_b, item.value_a)}>Keep "{item.value_a}"</button>
          <button class="btn btn-sm" onClick={() => mergeValues(actionType, item.value_a, item.value_b)}>Keep "{item.value_b}"</button>
          <button class="btn btn-sm" onClick={() => reconAction('dismiss', '', '')}>Dismiss</button>
        </div>
      ))}
    </>
  )
}

function AliasConflictList({ items }: { items: ReconAliasConflict[] }) {
  if (!items.length) return <p class="empty">No items</p>
  return (
    <>
      {items.map((item, i) => (
        <div key={i} class="recon-item">
          <span class="recon-name" style={{ fontWeight: 600 }}>{item.shared_name}</span>
          <span class="recon-meta">
            shared by:{' '}
            {item.artists.map((a, j) => (
              <span key={a.artist_id}>
                {j > 0 && ', '}
                <a class="clickable-name" href={`/artists-dashboard#${encodeURIComponent(a.artist_id)}`}>{a.display_name}</a>
                {' '}({a.type})
              </span>
            ))}
          </span>
        </div>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Unattributed files
// ---------------------------------------------------------------------------

function UnattributedList({ items, attributeFile, attributeFileSearch }: {
  items: AdminFile[]
  attributeFile: (fileId: string, artistId: string) => void
  attributeFileSearch: (fileId: string) => void
}) {
  if (!items.length) return <p class="empty">No unattributed files</p>
  return (
    <table class="ranking-table">
      <thead>
        <tr>
          <th>File</th>
          <th>Folder</th>
          <th>Category</th>
          <th>Type</th>
          <th>Candidate</th>
          <th>Score</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map(f => (
          <tr key={f.file_id}>
            <td title={f.file_path} style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.file_name}
            </td>
            <td>{f.folder_name}</td>
            <td><CategoryBadge category={f.category} /></td>
            <td style={{ fontSize: '11px' }}>{f.file_type}</td>
            <td>
              {f.candidate_display_name ? (
                <a class="clickable-name" href={`/artists-dashboard#${encodeURIComponent(f.candidate_artist_id!)}`}>
                  {f.candidate_display_name}
                </a>
              ) : (
                <span style={{ color: 'var(--fg-disabled)' }}>None</span>
              )}
            </td>
            <td>{f.match_score ? `${Math.round(f.match_score * 100)}%` : '—'}</td>
            <td style={{ whiteSpace: 'nowrap' }}>
              {f.candidate_artist_id && (
                <button class="btn btn-sm btn-primary" onClick={() => attributeFile(f.file_id, f.candidate_artist_id!)}>Accept</button>
              )}{' '}
              <button class="btn btn-sm" onClick={() => attributeFileSearch(f.file_id)}>Search</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
