# AutoHelper

Local-first Python filesystem orchestration service for AutoArt integration.

## Features

- **Path Safety**: Root allowlist, canonicalization, symlink blocking
- **SQLite Index**: WAL mode, FTS5 search, migration system
- **Audit Logging**: Append-only log with idempotency support
- **FastAPI**: Health/status endpoints, request context tracing

## Quick Start

From the **monorepo root**:

```bash
# Linux/Mac
pnpm --filter autohelper install:deps
pnpm --filter autohelper dev

# Windows (PowerShell)
pnpm --filter autohelper install:deps:win
pnpm --filter autohelper dev:win
```

Or as part of the full monorepo setup:

```bash
# Linux/Mac
pnpm build:all

# Windows
pnpm build:all:win
```

The `install:deps` script creates a `.venv/` directory and installs the package with dev dependencies.

### Manual Setup (not recommended)

If you need to run outside the monorepo:

```bash
cd apps/autohelper
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -e ".[dev]"
```

### Running

```bash
# With local data directory (dev mode)
pnpm --filter autohelper dev      # or dev:win

# With default data directory
pnpm --filter autohelper start    # or start:win
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `install:deps` / `install:deps:win` | Create venv and install dependencies |
| `dev` / `dev:win` | Run with `./data` as data directory |
| `start` / `start:win` | Run with default data directory |
| `lint` / `lint:win` | Run ruff linter |
| `format` / `format:win` | Auto-fix lint issues |
| `clean:venv` / `clean:venv:win` | Delete the virtual environment |

## API Endpoints

### Health
- `GET /health` - Simple health check
- `GET /status` - Detailed status with DB, migrations, roots

### Index (M1)
- `POST /index/rebuild` - Full index rebuild
- `POST /index/rescan` - Incremental rescan
- `GET /index/status` - Index run status

### Search (M2)
- `GET /search` - Search files by path/name/content

### References (M3)
- `POST /reference/register` - Register file reference
- `POST /reference/resolve` - Resolve references

## Configuration

Environment variables (prefix `AUTOHELPER_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | 127.0.0.1 | Server host |
| `PORT` | 8100 | Server port |
| `DB_PATH` | ./data/autohelper.db | SQLite database path |
| `ALLOWED_ROOTS` | (empty) | Comma-separated root paths |
| `BLOCK_SYMLINKS` | true | Block symlink traversal |
| `LOG_LEVEL` | INFO | Logging level |
| `CORS_ORIGINS` | localhost:5173,localhost:3000 | CORS origins |

## Project Structure

```
autohelper/
├── app.py              # FastAPI app factory
├── main.py             # Uvicorn entrypoint
├── config/             # Settings (pydantic-settings)
├── shared/             # Types, errors, logging (shared across modules)
├── infra/
│   ├── fs/             # Filesystem protocols, path safety
│   └── audit/          # Audit logging
├── db/
│   ├── conn.py         # SQLite connection
│   ├── migrate.py      # Migration runner
│   └── migrations/     # SQL migration files
└── modules/
    ├── health/         # Health/status endpoints
    ├── index/          # Indexer (M1)
    ├── search/         # Search (M2)
    └── ...
```

## Integration

AutoArt calls AutoHelper for filesystem operations. AutoHelper treats `work_item_id` and `context_id` as opaque IDs from AutoArt.

Headers for tracing:
- `X-Request-ID` - Request identifier
- `X-Work-Item-ID` - AutoArt work item
- `X-Context-ID` - AutoArt context
- `X-Idempotency-Key` - Idempotency key for retries
