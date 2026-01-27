# Poll - Meeting Time Finder

A when2meet-style availability polling tool. Deployed to `poll.autoart.work`.

## Architecture

Poll follows the same pattern as Intake - a separate Vite build target within the frontend package.

```
frontend/
├── poll/                    # Vite build root (index.html, entry)
│   ├── index.html
│   ├── main.tsx             # Entry point (imports from src/poll/)
│   └── public/              # Static assets
├── src/poll/                # Source code
│   ├── App.tsx              # React app shell with routes
│   ├── api.ts               # API functions (talks to /public/poll endpoints)
│   ├── index.css            # Styles (imports tailwindcss)
│   └── components/          # UI components
│       ├── PollPage.tsx     # Main poll view (availability grid)
│       ├── CreatePoll.tsx   # Poll creation (dates, time range)
│       ├── ResultsPage.tsx  # Aggregated availability view
│       └── ...
├── vite.poll.config.ts      # Build config
└── package.json             # Scripts: dev:poll, build:poll, preview:poll
```

## How It Works

### Two-Part System

1. **Dashboard (main frontend)** - Poll creator creates polls, gets shareable links
2. **Public App (this)** - Recipients visit link, mark availability, see results

### Data Flow

```
Dashboard                          poll.autoart.work
┌─────────────┐                   ┌─────────────────┐
│ Create Poll │ ─── generates ──► │ /:pollId        │
│ (settings,  │                   │ (mark avail)    │
│  dates)     │                   │                 │
└─────────────┘                   │ /:pollId/results│
       │                          │ (view overlap)  │
       ▼                          └────────┬────────┘
   POST /api/polls                         │
       │                                   │
       ▼                                   ▼
┌─────────────────────────────────────────────────────┐
│                    Backend API                       │
│  GET/POST /public/polls/:id  (no auth required)     │
└─────────────────────────────────────────────────────┘
```

### Public Endpoints (no auth)

The poll app uses `/public/poll/*` endpoints that don't require authentication:

- `GET /public/poll/:id` - Fetch poll config and existing responses
- `POST /public/poll/:id/respond` - Submit availability response
- `GET /public/poll/:id/results` - Get aggregated availability

## Development

```bash
# Start poll dev server (port 5175)
pnpm --filter autoart-frontend dev:poll

# Build for production
pnpm --filter autoart-frontend build:poll

# Preview production build
pnpm --filter autoart-frontend preview:poll
```

## Deployment

Build output: `dist-poll/`
Deploy target: `poll.autoart.work`

Requires SPA fallback rewrite (see `public/_redirects`).

## Key Differences from Intake

| Aspect | Intake | Poll |
|--------|--------|------|
| Purpose | Form submission | Availability polling |
| Interaction | One-time submit | Multiple responses, real-time updates |
| Data | Form fields → submission | Time grid → responses |
| Results | Confirmation page | Aggregated availability heatmap |

## UI Components

Core components needed:

- **TimeGrid** - Interactive grid for marking availability (drag to select)
- **DatePicker** - Select which dates to poll
- **ResponseList** - Show who has responded
- **AvailabilityHeatmap** - Visualize overlap (darker = more available)
- **ShareLink** - Copy link to clipboard
