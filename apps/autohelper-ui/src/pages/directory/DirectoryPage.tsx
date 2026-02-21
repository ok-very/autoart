import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks'
import { Nav } from '@/components/Nav'
import { CategoryBadge } from '@/components/CategoryBadge'
import { ScoreBar } from '@/components/ScoreBar'
import { GapPills } from '@/components/GapPills'
import { api } from '@/lib/api'
import { DetailPanel } from './DetailPanel'
import { ICO } from './icons'
import type { ArtistListItem, ArtistManifest } from '@/lib/types'

const INDIGENOUS_TERMS = ['indigenous', 'first nations', 'métis', 'metis', 'inuit', 'two-spirit']

const PILLS = [
  { key: 'indigenous', label: 'Indigenous', type: 'identity' as const },
  { key: 'public', label: 'Public Art', type: 'category' as const },
  { key: 'private', label: 'Private Art', type: 'category' as const },
  { key: 'corporate', label: 'Corporate Art', type: 'category' as const },
]

type SortKey = 'display_name' | 'primary_identity' | 'completeness' | 'gap_count'

interface ParsedSearch {
  text: string[]
  identity: string[]
  project: string[]
  city: string[]
  category: string[]
  scoreOp: string | null
  scoreVal: number | null
}

function parseSearch(raw: string): ParsedSearch {
  const filters: ParsedSearch = { text: [], identity: [], project: [], city: [], category: [], scoreOp: null, scoreVal: null }
  const tokens = raw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? []

  for (const tok of tokens) {
    const lower = tok.toLowerCase()
    if (lower.startsWith('identity:')) {
      filters.identity.push(tok.slice(9).replace(/"/g, ''))
    } else if (lower.startsWith('project:')) {
      filters.project.push(tok.slice(8).replace(/"/g, ''))
    } else if (lower.startsWith('city:')) {
      filters.city.push(tok.slice(5).replace(/"/g, ''))
    } else if (lower.startsWith('category:')) {
      filters.category.push(tok.slice(9).replace(/"/g, ''))
    } else if (lower.startsWith('score:')) {
      const m = tok.slice(6).match(/^([<>]=?)(\d+)$/)
      if (m) { filters.scoreOp = m[1]; filters.scoreVal = parseInt(m[2], 10) }
    } else {
      filters.text.push(lower.replace(/"/g, ''))
    }
  }
  return filters
}

function gapList(a: ArtistListItem): string[] {
  const g: string[] = []
  if (!a.has_bio) g.push('Bio')
  if (!a.has_cv) g.push('CV')
  if (!a.has_tearsheet) g.push('Tearsheet')
  if (!a.has_contact) g.push('Email')
  if (!a.has_images) g.push('Images')
  return g
}

function DataIcons({ artist }: { artist: ArtistListItem }) {
  const items: [string, boolean, string][] = [
    [ICO.fileText, artist.has_bio, 'Bio'],
    [ICO.clipboard, artist.has_cv, 'CV'],
    [ICO.sheet, artist.has_tearsheet, 'Tearsheet'],
    [ICO.mail, artist.has_contact, 'Contact'],
    [ICO.image, artist.has_images, 'Images'],
  ]
  return (
    <div class="data-icons">
      {items.map(([ico, has, title]) => (
        <span key={title} class={`data-icon ${has ? 'has' : 'missing'}`} title={title} dangerouslySetInnerHTML={{ __html: ico }} />
      ))}
    </div>
  )
}

export function DirectoryPage() {
  const [allArtists, setAllArtists] = useState<ArtistListItem[]>([])
  const [searchRaw, setSearchRaw] = useState('')
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set())
  const [activeIdentities, setActiveIdentities] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('display_name')
  const [sortDir, setSortDir] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<{ manifest: ArtistManifest; bioText: string } | null>(null)
  const searchTimer = useRef<number | null>(null)

  const loadArtists = useCallback(async () => {
    try {
      const data = await api.artists.list()
      const enriched = (Array.isArray(data) ? data : []).map(a => {
        a.gap_count = [a.has_bio, a.has_cv, a.has_tearsheet, a.has_contact, a.has_images].filter(x => !x).length
        a._all_identity = [...(a.nations ?? []), ...(a.identity_tags ?? [])]
        a.primary_identity = a._all_identity[0] ?? ''
        return a
      })
      setAllArtists(enriched)
    } catch (e) { console.error('Artists:', e) }
  }, [])

  const reload = useCallback(async () => {
    await loadArtists()
  }, [loadArtists])

  useEffect(() => { reload() }, [reload])

  // Deep-link from URL hash
  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1))
      if (id) setTimeout(() => openDetail(id), 500)
    }
  }, [])

  // Filter + sort
  const filtered = useMemo(() => {
    const pf = parseSearch(searchRaw)
    let result = allArtists.filter(a => {
      if (pf.text.length) {
        const name = a.display_name.toLowerCase()
        const allId = a._all_identity.map(t => t.toLowerCase()).join(' ')
        if (!pf.text.every(t => name.includes(t) || allId.includes(t))) return false
      }
      if (pf.identity.length) {
        const allId = a._all_identity.map(t => t.toLowerCase())
        if (!pf.identity.every(f => allId.some(t => t.includes(f.toLowerCase())))) return false
      }
      if (pf.city.length) {
        const allId = a._all_identity.map(t => t.toLowerCase())
        if (!pf.city.every(c => allId.some(t => t.includes(c.toLowerCase())))) return false
      }
      if (pf.category.length) {
        const cats = (a.categories ?? []).map(c => c.toLowerCase())
        if (!pf.category.every(c => cats.some(cat => cat.includes(c.toLowerCase())))) return false
      }
      if (pf.scoreOp && pf.scoreVal !== null) {
        const pct = Math.round(a.completeness * 100)
        if (pf.scoreOp === '<' && pct >= pf.scoreVal) return false
        if (pf.scoreOp === '<=' && pct > pf.scoreVal) return false
        if (pf.scoreOp === '>' && pct <= pf.scoreVal) return false
        if (pf.scoreOp === '>=' && pct < pf.scoreVal) return false
      }
      if (activeCategories.size > 0) {
        if (!(a.categories ?? []).some(c => activeCategories.has(c))) return false
      }
      if (activeIdentities.size > 0) {
        const allId = a._all_identity.map(t => t.toLowerCase())
        if (activeIdentities.has('indigenous')) {
          if (!INDIGENOUS_TERMS.some(term => allId.some(t => t.includes(term)))) return false
        }
      }
      return true
    })

    result.sort((a, b) => {
      const va = a[sortKey] as string | number
      const vb = b[sortKey] as string | number
      if (typeof va === 'string') return (va as string).localeCompare(vb as string) * sortDir
      return (((va as number) ?? 0) - ((vb as number) ?? 0)) * sortDir
    })

    return result
  }, [allArtists, searchRaw, activeCategories, activeIdentities, sortKey, sortDir])

  const togglePill = (key: string, type: 'category' | 'identity') => {
    const store = type === 'identity' ? activeIdentities : activeCategories
    const setter = type === 'identity' ? setActiveIdentities : setActiveCategories
    const next = new Set(store)
    if (next.has(key)) next.delete(key); else next.add(key)
    setter(next)
  }

  const clearFilters = () => {
    setSearchRaw('')
    setActiveCategories(new Set())
    setActiveIdentities(new Set())
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(1) }
  }

  const openDetail = async (artistId: string) => {
    setSelectedId(artistId)
    location.hash = encodeURIComponent(artistId)
    try {
      const [mRes, bRes] = await Promise.all([
        api.artists.get(artistId),
        api.artists.bioContent(artistId),
      ])
      setDetailData({ manifest: mRes, bioText: bRes.content })
    } catch {
      setDetailData(null)
    }
  }

  const closeDetail = () => {
    setSelectedId(null)
    setDetailData(null)
    location.hash = ''
  }

  const refreshDetail = () => {
    if (selectedId) openDetail(selectedId)
    loadArtists()
  }

  const onSearchInput = (e: Event) => {
    const val = (e.target as HTMLInputElement).value
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => setSearchRaw(val), 250)
  }

  const sortIcon = (key: SortKey) => {
    if (key === sortKey) return <span class="sort-icon active">{sortDir === 1 ? '\u2191' : '\u2193'}</span>
    return <span class="sort-icon">{'\u21C5'}</span>
  }

  return (
    <>
      <Nav active="directory" />

      <header class="header">
        <h1>Artist Directory</h1>
        <div class="header-actions">
          <button class="btn btn-ghost" onClick={reload} title="Reload data">&#x27F3; Reload</button>
        </div>
      </header>

      {/* Search */}
      <div class="toolbar">
        <input
          type="text"
          class="search-input"
          placeholder='Search: name, identity:tag, project:name, city:name, category:type, score:<40'
          onInput={onSearchInput}
          defaultValue={searchRaw}
        />
        <button class="btn btn-ghost" onClick={clearFilters}>Clear</button>
        <div class="toolbar-spacer" />
        <span class="result-count">{filtered.length} artist{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Pill filters */}
      <div class="pill-filters">
        {PILLS.map(p => {
          const store = p.type === 'identity' ? activeIdentities : activeCategories
          const isActive = store.has(p.key)
          return (
            <button
              key={p.key}
              class={`pill${isActive ? ` active active-${p.key}` : ''}`}
              onClick={() => togglePill(p.key, p.type)}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div class="main-layout">
        <div class="table-wrap">
          <table class="artist-table">
            <thead>
              <tr>
                <th class="sortable" onClick={() => handleSort('display_name')}>Artist {sortIcon('display_name')}</th>
                <th>Categories</th>
                <th class="sortable" onClick={() => handleSort('primary_identity')}>Identity {sortIcon('primary_identity')}</th>
                <th class="sortable" onClick={() => handleSort('completeness')}>Score {sortIcon('completeness')}</th>
                <th class="sortable" onClick={() => handleSort('gap_count')}>Gaps {sortIcon('gap_count')}</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} class="empty">No artists match your search.</td></tr>
              ) : (
                filtered.map(a => (
                  <tr
                    key={a.artist_id}
                    class={a.artist_id === selectedId ? 'selected' : ''}
                    onClick={() => openDetail(a.artist_id)}
                  >
                    <td>{a.display_name}</td>
                    <td>{(a.categories ?? []).map(c => <CategoryBadge key={c} category={c} />)}</td>
                    <td>
                      <div class="identity-tags">
                        {a._all_identity.map(t => {
                          const isNation = (a.nations ?? []).includes(t)
                          return <span key={t} class={`identity-tag ${isNation ? 'identity-nation' : 'identity-tag-self'}`}>{t}</span>
                        })}
                      </div>
                    </td>
                    <td><ScoreBar score={a.completeness} /></td>
                    <td><GapPills gaps={gapList(a)} /></td>
                    <td><DataIcons artist={a} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selectedId && detailData && (
          <DetailPanel
            manifest={detailData.manifest}
            bioText={detailData.bioText}
            onClose={closeDetail}
            onRefresh={refreshDetail}
          />
        )}
      </div>
    </>
  )
}
