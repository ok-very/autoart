# AutoHelper Connections System

How AutoHelper pairs with AutoArt, validates sessions, and proxies credentials.

---

## Architecture

AutoHelper maintains an ephemeral pairing session with AutoArt's backend. Sessions allow AutoHelper to fetch Monday API tokens without storing credentials locally — single source of truth pattern. Sessions are **in-memory only** with a 24-hour TTL.

---

## Data Structures

### PairingCode (ephemeral, 5-minute TTL)

```
code         6-digit string, collision-checked
userId       Owner who requested the code
expiresAt    Date (now + 5 min)
```

### AutoHelperSession (ephemeral, 24-hour TTL)

```
sessionId      64 hex chars (randomBytes(32))
displayId      First 8 chars (for UI)
userId         Owner
instanceName   Hostname or custom name
connectedAt    Date
lastSeen       Date (updated on every credentials fetch)
expiresAt      Date (connectedAt + 24h)
```

Both stored in `Map<string, T>` in `connections.service.ts`. Not persisted to database. Lost on backend restart (by design).

---

## Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /connections` | Optional | Status summary (monday, google, autohelper) |
| `POST /connections/autohelper/pair` | Required | Generate 6-digit pairing code |
| `POST /connections/autohelper/handshake` | None | Exchange code for sessionId |
| `GET /connections/autohelper/credentials` | Session header | Fetch Monday token + validate session |
| `POST /connections/autohelper/disconnect` | Session header | AutoHelper invalidates its own session |
| `GET /connections/autohelper` | Required | List connected instances for user |
| `DELETE /connections/autohelper/:displayId` | Required | User disconnects an instance |

Session auth uses `X-AutoHelper-Session` header. API key auth uses `X-API-Key` header.

---

## Pairing Sequence

```
1. User clicks "Pair" in Settings UI
   ├─ Frontend: POST /connections/autohelper/pair
   ├─ Backend: generatePairingCode(userId)
   └─ Returns { code: "123456", expiresAt: ... }

2. Code shown to user or auto-sent to AutoHelper

3. AutoHelper Python: POST /pair { code: "123456" }
   ├─ AutoHelper: POST /api/connections/autohelper/handshake
   ├─ Backend: validatePairingCode("123456", "hostname")
   │  ├─ Verify code not expired (< 5 min)
   │  ├─ Consume code (delete from map, single-use)
   │  ├─ Generate sessionId (64 hex)
   │  └─ Create AutoHelperSession (24hr TTL)
   └─ Returns { sessionId: "a1b2c3d4..." }

4. AutoHelper saves sessionId to config.json
   └─ Reinits ContextService with new session_id

5. Frontend polls GET /connections (every 5s)
   ├─ Backend: getAutoHelperSessions(userId)
   └─ UI updates: "Paired" badge
```

---

## Implicit Heartbeat

No dedicated heartbeat endpoint. Every `GET /credentials` call triggers `validateSession()`:

- Updates `session.lastSeen`
- Checks `expiresAt` — if expired, deletes session, returns `null` → 401
- AutoHelper receives 401 → knows to re-pair

---

## Session Expiry

| Trigger | Behavior |
|---------|----------|
| No API calls for 24h | `expiresAt` passes, next `validateSession()` deletes session |
| Backend restart | All in-memory sessions lost, AutoHelper gets 401 on next call |
| User clicks "Disconnect" | `DELETE /connections/autohelper/:displayId` removes session |
| AutoHelper unpairs | `POST /connections/autohelper/disconnect` removes session |

---

## Credential Flow

AutoHelper never stores Monday tokens locally.

```
AutoHelper needs Monday token
  ├─ GET /api/connections/autohelper/credentials
  │  Header: X-AutoHelper-Session: "a1b2c3d4..."
  ├─ Backend: validateSession("a1b2c3d4...")
  │  ├─ Find in map, check expiry, update lastSeen
  │  └─ Return userId
  ├─ Backend: getMondayToken(userId)
  │  └─ SELECT from connection_credentials WHERE provider='monday'
  └─ Returns { monday_api_token: "..." }
```

If user updates their Monday token in Settings, AutoHelper picks it up on the next fetch automatically.

---

## Frontend Polling

| Hook | Query Key | Interval |
|------|-----------|----------|
| `useConnections()` | `['connections']` | 5000ms |
| `useAutoHelperInstances()` | `['connections', 'autohelper']` | 5000ms |

---

## File Reference

| Layer | File | Purpose |
|-------|------|---------|
| Backend | `backend/src/modules/imports/connections.service.ts` | Session storage, validation, cleanup |
| Backend | `backend/src/modules/imports/connections.routes.ts` | HTTP endpoints |
| Frontend | `frontend/src/api/connections.ts` | React Query hooks |
| Frontend | `frontend/src/pages/settings/AutoHelperSection.tsx` | Settings UI |
| AutoHelper | `apps/autohelper/autohelper/modules/pairing/router.py` | Pair/unpair endpoints |
| AutoHelper | `apps/autohelper/autohelper/config/store.py` | Config persistence |
| AutoHelper | `apps/autohelper/autohelper/modules/context/autoart.py` | Backend API client |
| AutoHelper | `apps/autohelper/autohelper/modules/context/service.py` | Context/provider management |

---

## Known Gaps

- `cleanupExpiredAutohelperSessions()` exists but has no scheduled caller — expired sessions accumulate until next `validateSession()` check
- Frontend `GET /connections` counts sessions but never validates them — shows "Paired" for any non-empty session list, including expired ones
- No database persistence for sessions — backend restart breaks all pairings silently
