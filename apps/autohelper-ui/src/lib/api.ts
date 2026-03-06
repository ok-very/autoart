import type {
  ArtistListItem,
  ArtistManifest,
  ArtistStats,
  HealthReport,
  ReconciliationData,
  AdminFile,
  AppConfig,
  ScanStatus,
  Lexicon,
} from './types'

const API = '/artists'
const CONFIG_API = '/config'

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path}: ${res.status}`)
  return res.json() as Promise<T>
}

function post(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
}

function put(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const api = {
  artists: {
    list: (limit = 5000) =>
      fetchJson<ArtistListItem[]>(`${API}?limit=${limit}`),

    get: (id: string) =>
      fetchJson<ArtistManifest>(`${API}/${id}`),

    bioContent: (id: string) =>
      fetchJson<{ content: string }>(`${API}/${id}/bio-content`),

    stats: () =>
      fetchJson<ArtistStats>(`${API}/stats`),

    health: () =>
      fetchJson<HealthReport>(`${API}/health`),

    reconciliation: () =>
      fetchJson<ReconciliationData>(`${API}/reconciliation`),

    adminFiles: () =>
      fetchJson<AdminFile[]>(`${API}/admin-files`),

    updateReview: (id: string, status: string) =>
      put(`${API}/${id}/review`, { status }),

    saveManifest: (id: string, data: { identity: Partial<ArtistManifest['identity']>; contact: Partial<ArtistManifest['contact']> }) =>
      put(`${API}/${id}/manifest`, data),

    rescan: (id: string) =>
      post(`${API}/${id}/rescan`),

    resolveNote: (id: string, index: number) =>
      post(`${API}/${id}/resolve-note`, { index }),

    addPanel: (id: string, entry: { date: string; project: string; role: string }) =>
      post(`${API}/${id}/panel`, entry),

    addProject: (id: string, project: { project_name: string; developer?: string | null; year?: string | null; role?: string | null; status?: string }) =>
      post(`${API}/${id}/project`, project),

    openFolder: (id: string) =>
      fetch(`${API}/${id}/open-folder`),

    openFile: (path: string) =>
      fetch(`${API}/open-file?path=${encodeURIComponent(path)}`),

    attributeFile: (fileId: string, artistId: string) =>
      post(`${API}/admin-files/${encodeURIComponent(fileId)}/attribute`, { artist_id: artistId }),

    resolveRecon: (body: Record<string, unknown>) =>
      post(`${API}/reconciliation/resolve`, body),

    merge: (keepId: string, removeId: string) =>
      post(`${API}/reconciliation/merge`, { keep_id: keepId, remove_id: removeId }).then(r => r.json()),

    autoMerge: (threshold: number, dryRun: boolean) =>
      post(`${API}/reconciliation/auto-merge`, { threshold, dry_run: dryRun }).then(r => r.json()),
  },

  scan: {
    trigger: () => post(`${API}/scan`),
    stop: () => post(`${API}/scan/stop`),
    status: () => fetchJson<ScanStatus>(`${API}/scan/status`),
    logUrl: `${API}/scan/log`,
  },

  lexicon: {
    get: () => fetchJson<Lexicon>(`${API}/lexicon`),
    save: (data: Lexicon) => put(`${API}/lexicon`, data),
  },

  config: {
    get: () => fetchJson<AppConfig>(CONFIG_API),
    save: (data: Partial<AppConfig>) => put(CONFIG_API, data),
    selectFolder: () => post(`${CONFIG_API}/select-folder`).then(r => r.json() as Promise<{ path: string | null }>),
  },

  clickup: {
    validate: () => fetchJson<{ ok: boolean; workspace?: string; error?: string }>('/clickup/validate'),
    artistSync: (listId: string, dryRun: boolean, artistIds?: string[]) =>
      post(`/clickup/artist-sync?list_id=${encodeURIComponent(listId)}&dry_run=${dryRun}`, { artist_ids: artistIds ?? null }).then(r => r.json()),
  },

  contacts: {
    status: () => fetchJson<Record<string, unknown>>('/contacts/status'),
    history: () => fetchJson<Record<string, unknown>[]>('/contacts/history'),
    testExchange: () => post('/contacts/exchange/test').then(r => r.json()),
    sync: () => post('/contacts/sync').then(r => r.json()),
  },

  health: () => fetchJson<Record<string, unknown>>('/health'),
  status: () => fetchJson<Record<string, unknown>>('/status'),
}
