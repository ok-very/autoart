# AutoArt Setup Guide

This guide walks you through setting up AutoArt with a local PostgreSQL installation.

## Architecture Philosophy

AutoArt treats the database as a **designed system** - a machine assembled from instructions:

- **Structure** (tables, indexes, constraints) - versioned in migrations
- **Behavior** (functions, triggers) - versioned in migrations
- **Reference Data** (record definitions) - versioned in seeds
- **User Data** - disposable, not versioned

The database can be completely rebuilt from migrations alone. This ensures reproducibility across development, testing, and production environments.

---

## Prerequisites

### 1. Node.js 20+
Download from: https://nodejs.org/ (LTS version recommended)

```bash
node --version   # Should show v20.x.x or higher
npm --version    # Should show 10.x.x or higher
```

### 2. PostgreSQL 15+
Download from: https://www.postgresql.org/download/windows/

**During installation**:
- Remember the password you set for the `postgres` user
- Keep the default port `5432`
- "Stack Builder" is optional (not needed)

Verify PostgreSQL is running:
```bash
psql --version
```

---

## Step-by-Step Setup

### Step 1: Create the Database

Connect to PostgreSQL as the postgres superuser:

```bash
psql -U postgres
```

Run these SQL commands:
```sql
-- Create the database user
CREATE USER autoart WITH PASSWORD 'password';

-- Create the database
CREATE DATABASE autoart OWNER autoart;

-- Grant privileges (required for extensions)
GRANT ALL PRIVILEGES ON DATABASE autoart TO autoart;

-- Connect to the new database to grant schema privileges
\c autoart
GRANT ALL ON SCHEMA public TO autoart;

-- Exit
\q
```

### Step 2: Create Environment Configuration

```powershell
copy .env.example .env
```

Edit `.env` if your PostgreSQL uses different credentials:
```env
DATABASE_URL=postgresql://autoart:password@localhost:5432/autoart
JWT_SECRET=your-secret-key-change-in-production
```

### Step 3: Install Dependencies

From the project root:
```bash
npm run install:all
```

Or manually:
```bash
cd backend && npm install
cd ../frontend && npm install
```

### Step 4: Run Database Migrations

This creates all tables, indexes, functions, and triggers:

```bash
cd backend
npm run migrate
```

**Expected output** (8 migrations):
```
Migration "001_extensions" executed successfully
Migration "002_enums" executed successfully
Migration "003_users" executed successfully
Migration "004_record_definitions" executed successfully
Migration "005_hierarchy" executed successfully
Migration "006_records" executed successfully
Migration "007_references" executed successfully
Migration "008_functions" executed successfully
```

### Step 5: Seed Reference Data

**For production** (reference data only):
```bash
npm run seed
```

**For development** (reference data + sample project + demo user):
```bash
npm run seed:dev
```

### Step 6: Start Development Servers

**Option A: Using the dev script (recommended)**:
```powershell
# From project root
npm run dev
```

**Option B: Manual startup** (two terminals):

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### Step 7: Access the Application

Open: **http://localhost:5173**

**Demo credentials** (if you ran `seed:dev`):
- Email: `demo@autoart.local`
- Password: `demo123`

---

## Database Commands

| Command | Description |
|---------|-------------|
| `npm run migrate` | Run all pending migrations |
| `npm run migrate:down` | Roll back all migrations |
| `npm run seed` | Seed reference data only |
| `npm run seed:dev` | Seed reference + sample data |
| `npm run seed:reset` | Clear data and reseed with sample data |
| `npm run db:rebuild` | Full reset: down → migrate → seed:dev |

### From Backend Directory

```bash
cd backend

# Apply migrations
npm run migrate

# Roll back migrations
npm run migrate:down

# Seed reference data (production-safe)
npm run seed

# Seed with development sample data
npm run seed:dev

# Reset and reseed (clears all user data!)
npm run seed:reset

# Full database rebuild
npm run db:rebuild
```

---

## Utility Scripts

All scripts are in the `scripts/` directory and use PowerShell.

### Database Verification
Verifies your database can be rebuilt from migrations alone:
```powershell
.\scripts\db-verify.ps1
```

This will:
1. Roll back all migrations
2. Re-run all migrations
3. Seed reference data
4. Verify all tables exist

**Use this before deploying** to ensure your migrations are complete.

### Database Backup
```powershell
.\scripts\backup.ps1
```

Creates compressed backups in `backups/` with automatic cleanup of old files.

### Development Server
```powershell
.\scripts\dev.ps1
```

Starts both backend and frontend servers.

---

## Migration System

### Understanding Migrations

Migrations are numbered and executed in order:

```
001_extensions.ts   - PostgreSQL extensions (pgcrypto)
002_enums.ts        - Custom enum types
003_users.ts        - User authentication tables
004_record_definitions.ts - Schema registry
005_hierarchy.ts    - Tree structure (projects, processes, etc.)
006_records.ts      - Data records with JSONB
007_references.ts   - Link/reference system
008_functions.ts    - Database functions and triggers
```

### Creating New Migrations

1. Create a new file: `backend/src/db/migrations/009_feature_name.ts`
2. Export `up()` and `down()` functions
3. Run `npm run migrate`

**Example migration**:
```typescript
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('new_table')
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', col => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('new_table').execute();
}
```

### Migration Best Practices

- **Never modify existing migrations** in production
- **Always provide a `down()` function** for rollback
- **Include indexes** in the same migration as their table
- **Test migrations** with `npm run db:rebuild`

---

## Troubleshooting

### PostgreSQL service not running
Open Services (Win+R → `services.msc`), find "postgresql-x64-XX", right-click → Start

### psql command not found
Add PostgreSQL to PATH:
1. Find: `C:\Program Files\PostgreSQL\16\bin`
2. Add to System Environment Variables → Path

Or use full path:
```bash
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
```

### Permission denied for schema public
Connect as postgres and grant permissions:
```sql
\c autoart
GRANT ALL ON SCHEMA public TO autoart;
```

### Migration fails with "relation already exists"
Your database is in an inconsistent state. Reset it:
```bash
npm run db:rebuild
```

### Extension pgcrypto not available
Connect as postgres superuser and create it:
```sql
\c autoart
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Database connection refused
1. Verify PostgreSQL service is running
2. Check port in `.env` matches PostgreSQL config (default: 5432)
3. Check firewall isn't blocking localhost:5432

---

## Production Deployment

### Pre-deployment Checklist

1. **Verify migrations**: Run `.\scripts\db-verify.ps1`
2. **Update secrets**: Change JWT_SECRET in `.env`
3. **Backup existing data**: Run `.\scripts\backup.ps1`
4. **Test seed script**: Ensure `npm run seed` works (not seed:dev)

### Deployment Steps

1. Set up PostgreSQL on production server
2. Create database and user (Step 1 above)
3. Copy `.env` with production credentials
4. Run `npm run migrate`
5. Run `npm run seed` (reference data only)
6. Build frontend: `cd frontend && npm run build`
7. Build backend: `cd backend && npm run build`
8. Start backend: `cd backend && npm start`
9. Serve frontend static files via nginx/similar

---

## Database Management

### Manual Backup
```bash
pg_dump -U autoart -h localhost -F c autoart > backup.dump
```

### Restore from Backup
```bash
pg_restore -U autoart -h localhost -d autoart backup.dump
```

### Complete Reset (Warning: Deletes All Data)
```bash
psql -U postgres -c "DROP DATABASE autoart;"
psql -U postgres -c "CREATE DATABASE autoart OWNER autoart;"
cd backend
npm run migrate
npm run seed:dev
```

### Connect to Database Directly
```bash
psql -U autoart -d autoart
```

Useful psql commands:
```sql
\dt                 -- List tables
\d+ table_name      -- Describe table
\df                 -- List functions
\di                 -- List indexes
```
