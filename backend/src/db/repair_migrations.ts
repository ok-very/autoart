import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { Kysely, PostgresDialect } from 'kysely';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '..', '..', '.env');
dotenv.config({ path: envPath });

async function repair() {
  console.log('Starting migration repair...');

  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    }),
  });

  try {
    // 1. Get files from disk
    const migrationFolder = path.join(__dirname, 'migrations');
    const files = await fs.readdir(migrationFolder);
    
    // Filter for .ts or .js files and remove extension to get migration name
    const diskMigrations = files
      .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
      .map(f => path.basename(f, path.extname(f)));

    console.log(`Found ${diskMigrations.length} migrations on disk.`);

    // 2. Get executed migrations from DB
    // The table is 'kysely_migration' (default)
    const dbMigrations = await db
      .selectFrom('kysely_migration')
      .select('name')
      .execute();

    const dbMigrationNames = dbMigrations.map(m => m.name);
    console.log(`Found ${dbMigrationNames.length} executed migrations in DB.`);

    // 3. Find ghosts
    const ghosts = dbMigrationNames.filter(name => !diskMigrations.includes(name));

    if (ghosts.length === 0) {
      console.log('No corrupted migrations found. DB and Disk are in sync.');
    } else {
      console.log(`Found ${ghosts.length} corrupted (ghost) migrations:`);
      ghosts.forEach(g => console.log(` - ${g}`));

      console.log('Removing ghost migrations from database...');
      
      await db
        .deleteFrom('kysely_migration')
        .where('name', 'in', ghosts)
        .execute();
      
      console.log('Successfully removed ghost migrations.');
    }

  } catch (err) {
    console.error('Error during repair:', err);
  } finally {
    await db.destroy();
  }
}

repair();
