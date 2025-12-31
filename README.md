# AutoArt Process Management System

A powerful process management system with a 5-level hierarchy (Project → Process → Stage → Subprocess → Task), polymorphic records, and a hyperlink engine for `#record:field` references.

## Features

- **Deep Hierarchy**: Manage nested structures with Projects, Processes, Stages, Subprocesses, and Tasks
- **Polymorphic Records**: Create custom record types with user-defined schemas
- **Hyperlink Engine**: Reference records in task descriptions using `#recordname:fieldname` syntax
- **Static/Dynamic References**: Choose between snapshot values or live-linked data
- **Deep Cloning**: Clone entire project structures as templates
- **Rich Text Editing**: TipTap-based editor with mention autocomplete

## Tech Stack

- **Backend**: Fastify + TypeScript + Kysely + PostgreSQL
- **Frontend**: React + Vite + TailwindCSS + TipTap + Zustand + TanStack Query
- **Infrastructure**: Docker + Nginx

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Development Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd autoart_v02
   npm run install:all
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development servers**:
   ```bash
   # Linux/macOS
   npm run dev

   # Windows
   npm run dev:win
   ```

4. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Database: localhost:5432

### Demo Credentials

After seeding the database (`npm run seed`):
- Email: `demo@autoart.local`
- Password: `demo123`

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development servers (Linux/macOS) |
| `npm run dev:win` | Start development servers (Windows) |
| `npm run build` | Build for production |
| `npm run deploy` | Deploy to production |
| `npm run restart` | Restart production services |
| `npm run backup` | Backup database |
| `npm run restore <file>` | Restore database from backup |
| `npm run update` | Update all npm packages |
| `npm run health` | Check service health |
| `npm run logs` | View service logs |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed sample data |

## Project Structure

```
autoart_v02/
├── backend/                 # Fastify API
│   ├── src/
│   │   ├── config/         # Environment configuration
│   │   ├── db/             # Database client & migrations
│   │   ├── modules/        # Feature modules
│   │   │   ├── auth/       # JWT authentication
│   │   │   ├── hierarchy/  # Node CRUD & cloning
│   │   │   ├── records/    # Record definitions & instances
│   │   │   ├── references/ # Static/dynamic links
│   │   │   └── search/     # Full-text search
│   │   └── plugins/        # Fastify plugins
│   └── Dockerfile
│
├── frontend/                # React SPA
│   ├── src/
│   │   ├── api/            # API client & hooks
│   │   ├── components/     # React components
│   │   ├── stores/         # Zustand state stores
│   │   ├── types/          # TypeScript interfaces
│   │   └── pages/          # Route components
│   └── Dockerfile
│
├── config/                  # Configuration files
│   ├── nginx.conf          # Reverse proxy config
│   └── state-saves/        # UI state snapshots
│
├── scripts/                 # Utility scripts
│   ├── dev.sh              # Development startup
│   ├── build.sh            # Production build
│   ├── deploy.sh           # Production deployment
│   ├── backup.sh           # Database backup
│   └── ...
│
├── docker-compose.yml       # Development compose
└── docker-compose.prod.yml  # Production compose
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Hierarchy
- `GET /api/hierarchy/projects` - List projects
- `GET /api/hierarchy/:projectId` - Get project tree
- `POST /api/hierarchy/nodes` - Create node
- `PATCH /api/hierarchy/nodes/:id` - Update node
- `DELETE /api/hierarchy/nodes/:id` - Delete node
- `POST /api/hierarchy/clone` - Deep clone subtree

### Records
- `GET /api/records/definitions` - List record types
- `POST /api/records/definitions` - Create record type
- `POST /api/records/definitions/:id/clone` - Clone record type
- `GET /api/records` - List records
- `POST /api/records` - Create record
- `PATCH /api/records/:id` - Update record

### References
- `POST /api/references` - Create reference
- `POST /api/references/resolve` - Batch resolve values
- `PATCH /api/references/:id/mode` - Switch static/dynamic
- `GET /api/references/:id/drift` - Check for value drift

### Search
- `GET /api/search/resolve?q=...` - Search for `#` autocomplete

## Database Schema

The system uses PostgreSQL with the following core tables:

- `users` - User accounts
- `sessions` - JWT refresh tokens
- `hierarchy_nodes` - The 5-level tree structure
- `record_definitions` - Schema definitions for record types
- `records` - Actual record instances
- `task_references` - Links between tasks and records (static/dynamic)

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT signing (min 32 chars)
- `CORS_ORIGIN` - Allowed origins for CORS

### State Saves

UI state can be saved/restored from `config/state-saves/`. This includes:
- Sidebar and inspector widths
- Expanded nodes
- Selected views
- Theme preferences

## Production Deployment

1. **Configure environment**:
   ```bash
   cp .env.example .env
   # Set production values for DB_PASSWORD, JWT_SECRET, etc.
   ```

2. **Build and deploy**:
   ```bash
   npm run deploy -- --build
   ```

3. **Set up SSL** (recommended):
   ```bash
   certbot certonly --webroot -w /var/www/html -d yourdomain.com
   # Update nginx.conf to enable HTTPS
   ```

4. **Set up automated backups**:
   ```bash
   # Add to crontab
   0 2 * * * /path/to/autoart/scripts/backup.sh
   ```

## License

MIT
