import { useState, useEffect, useCallback } from 'preact/hooks'
import { Nav } from '@/components/Nav'
import { CategoryBadge } from '@/components/CategoryBadge'
import { GapPills } from '@/components/GapPills'
import { ScoreBar } from '@/components/ScoreBar'
import { api } from '@/lib/api'
import type {
  ArtistStats,
  HealthReport,
  HealthRankingItem,
  GapAnalysisField,
  BrokenItem,
  EnrichmentItem,
  ReviewQueueItem,
} from '@/lib/types'

export function HealthPage() {
  const [stats, setStats] = useState<ArtistStats | null>(null)
  const [health, setHealth] = useState<HealthReport | null>(null)

  const reload = useCallback(async () => {
    const [s, h] = await Promise.all([
      api.artists.stats().catch(() => null),
      api.artists.health().catch(() => null),
    ])
    if (s) setStats(s)
    if (h) setHealth(h)
  }, [])

  useEffect(() => { reload() }, [reload])

  const gapCount = health?.ranking
    ? health.ranking.filter(a => a.score < 1.0).length
    : (stats ? stats.total - (stats.by_review_status?.approved ?? 0) : 0)

  return (
    <>
      <Nav active="health" />

      <header class="header">
        <h1>Lists Health</h1>
        <div class="header-actions">
          <button class="btn btn-ghost" onClick={reload}>&#x27F3; Reload</button>
        </div>
      </header>

      {stats && <StatsSection stats={stats} gapCount={gapCount} />}

      <div class="health-grid">
        <RankingCard ranking={health?.ranking ?? []} />
        <GapAnalysisCard gaps={health?.gap_analysis ?? {}} />
        <BrokenCard items={health?.broken ?? []} onReload={reload} />
        <EnrichmentCard items={health?.enrichment ?? []} />
        <ReviewQueueCard items={health?.review_queue ?? []} onReload={reload} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Stats Section
// ---------------------------------------------------------------------------

function StatsSection({ stats, gapCount }: { stats: ArtistStats; gapCount: number }) {
  const fields = stats.completeness_by_field ?? {}
  const labels: Record<string, string> = {
    has_bio: 'Bio',
    has_cv: 'CV',
    has_tearsheet: 'Tearsheet',
    has_contact: 'Email',
    has_images: 'Images',
  }

  return (
    <div class="stats-section">
      <div class="stat-cards">
        <StatCard value={stats.total} label="Total Artists" />
        <StatCard value={`${Math.round(stats.avg_completeness * 100)}%`} label="Avg Completeness" />
        <StatCard value={gapCount} label="With Gaps" />
        <StatCard value={stats.needs_review ?? 0} label="Needs Review" />
      </div>
      <div class="completeness-chart">
        {Object.entries(labels).map(([k, l]) => {
          const pct = Math.round((fields[k] ?? 0) * 100)
          return (
            <div key={k} class="chart-row">
              <span class="chart-label">{l}</span>
              <div class="chart-bar-track">
                <div class="chart-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span class="chart-pct">{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div class="stat-card">
      <div class="stat-value">{value}</div>
      <div class="stat-label">{label}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

function RankingCard({ ranking }: { ranking: HealthRankingItem[] }) {
  return (
    <div class="health-card full-width">
      <h3>
        Completeness Ranking{' '}
        <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--fg-secondary)' }}>(worst first)</span>
      </h3>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <table class="ranking-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Artist</th>
              <th>Categories</th>
              <th>Score</th>
              <th>Gaps</th>
            </tr>
          </thead>
          <tbody>
            {ranking.length === 0 ? (
              <tr><td colSpan={5} class="empty">No artists scanned yet</td></tr>
            ) : (
              ranking.map((a, i) => (
                <tr key={a.artist_id}>
                  <td>{i + 1}</td>
                  <td>
                    <a class="clickable-name" href={`/artists-dashboard#${encodeURIComponent(a.artist_id)}`}>
                      {a.display_name}
                    </a>
                  </td>
                  <td>{(a.categories ?? []).map(c => <CategoryBadge key={c} category={c} />)}</td>
                  <td><ScoreBar score={a.score} /></td>
                  <td><GapPills gaps={a.gaps ?? []} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Gap Analysis
// ---------------------------------------------------------------------------

const GAP_LABELS: Record<string, string> = {
  bio: 'Bio', cv: 'CV', tearsheet: 'Tearsheet', email: 'Email',
  phone: 'Phone', website: 'Website', images: 'Images', pronouns: 'Pronouns',
}

function GapAnalysisCard({ gaps }: { gaps: Record<string, GapAnalysisField> }) {
  return (
    <div class="health-card full-width">
      <h3>Gap Analysis</h3>
      <div class="gap-grid">
        {Object.keys(gaps).length === 0 ? (
          <p class="empty">No data</p>
        ) : (
          Object.entries(GAP_LABELS).map(([key, label]) => {
            const data = gaps[key] ?? { missing: 0, total: 0 }
            const pct = data.total > 0 ? Math.round(data.missing / data.total * 100) : 0
            return (
              <div key={key} class="gap-field-card">
                <h4>{label}</h4>
                <div class="gap-count">{data.missing}</div>
                <div class="gap-pct">{pct}% missing</div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Broken
// ---------------------------------------------------------------------------

function BrokenCard({ items, onReload }: { items: BrokenItem[]; onReload: () => void }) {
  const rescan = async (artistId: string) => {
    await api.artists.rescan(artistId)
    onReload()
  }

  return (
    <div class="health-card">
      <h3>Broken / Unindexed</h3>
      {items.length === 0 ? (
        <p class="empty">No broken items</p>
      ) : (
        items.map(b => (
          <div key={b.artist_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ flex: 1 }}>
              {b.display_name}{' '}
              <span style={{ color: 'var(--fg-disabled)', fontSize: '11px' }}>{b.reason}</span>
            </span>
            <button class="btn btn-sm" onClick={() => rescan(b.artist_id)}>Rescan</button>
          </div>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

function EnrichmentCard({ items }: { items: EnrichmentItem[] }) {
  return (
    <div class="health-card">
      <h3>Enrichment Opportunities</h3>
      {items.length === 0 ? (
        <p class="empty">All artists well-enriched</p>
      ) : (
        items.slice(0, 50).map(a => (
          <div key={a.artist_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
            <a class="clickable-name" href={`/artists-dashboard#${encodeURIComponent(a.artist_id)}`} style={{ flex: 1 }}>
              {a.display_name}
            </a>
            <GapPills gaps={a.missing ?? []} />
          </div>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Review Queue
// ---------------------------------------------------------------------------

function ReviewQueueCard({ items, onReload }: { items: ReviewQueueItem[]; onReload: () => void }) {
  const setStatus = async (artistId: string, status: string) => {
    await api.artists.updateReview(artistId, status)
    onReload()
  }

  return (
    <div class="health-card full-width">
      <h3>Review Queue</h3>
      {items.length === 0 ? (
        <p class="empty">No items pending review</p>
      ) : (
        <table class="ranking-table">
          <thead>
            <tr><th>Artist</th><th>Status</th><th>Notes</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.map(a => (
              <tr key={a.artist_id}>
                <td>
                  <a class="clickable-name" href={`/artists-dashboard#${encodeURIComponent(a.artist_id)}`}>
                    {a.display_name}
                  </a>
                </td>
                <td><span class="status-badge badge-review">{a.review_status}</span></td>
                <td style={{ fontSize: '12px', color: 'var(--fg-secondary)' }}>{a.note_count} note(s)</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button class="btn btn-sm btn-success" onClick={() => setStatus(a.artist_id, 'approved')}>Approve</button>{' '}
                  <button class="btn btn-sm btn-warning" onClick={() => setStatus(a.artist_id, 'flagged')}>Flag</button>{' '}
                  <button class="btn btn-sm btn-danger" onClick={() => setStatus(a.artist_id, 'rejected')}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
