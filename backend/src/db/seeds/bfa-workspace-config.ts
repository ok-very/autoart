/**
 * BFA Monday Workspace Configuration Seed
 *
 * Seeds the Monday workspace, board, and column configs for the
 * BFA "Current Projects Overview" board.
 *
 * Idempotent: checks for existing BFA workspace before inserting.
 *
 * NOT wired into run.ts — this is BFA-specific config.
 * Run manually: `npx tsx src/db/seeds/bfa-workspace-config.ts`
 * Or add to a `seed:bfa` script later.
 */

import { type Kysely, sql } from 'kysely';

import type { Database } from '../schema.js';

/** Stable workspace name used for idempotent check */
const BFA_WORKSPACE_NAME = 'Ballard Fine Art';
const BFA_BOARD_NAME = '1. Current Projects Overview';
const BFA_BOARD_ROLE = 'overview_board';

/**
 * BFA column definitions mapped from config.py EXCEL_COLUMN_MAP.
 * Each entry: [columnKey, columnTitle, columnType, semanticRole, localFieldKey?]
 */
const BFA_COLUMNS: Array<[string, string, string, string, string?]> = [
  ['col_A', 'Name', 'text', 'title', 'name'],
  ['col_D', 'Person', 'people', 'assignee', 'fields.bfa_lead'],
  ['col_E', 'DP Issuance Date', 'date', 'fact', 'fields.dp_issuance_date'],
  ['col_F', 'SP1', 'date', 'fact', 'fields.milestone_sp1'],
  ['col_G', 'Artist Orientation', 'date', 'fact', 'fields.artist_orientation'],
  ['col_H', 'SP2', 'date', 'fact', 'fields.milestone_sp2'],
  ['col_I', 'Project Kickoff Meeting w/ Artist', 'date', 'fact', 'fields.project_kickoff'],
  ['col_J', 'Selection Process', 'text', 'fact', 'fields.selection_process'],
  ['col_K', 'Artist Contract Signed', 'date', 'fact', 'fields.artist_contract_signed'],
  ['col_L', 'Project State', 'status', 'status', 'project_state'],
  ['col_M', 'Project Phase', 'status', 'status', 'bfa_phase_canonical'],
  ['col_P', 'Municipality', 'text', 'fact', 'fields.city'],
  ['col_Q', 'Project Address', 'text', 'fact', 'fields.address'],
  ['col_R', 'Billing Entity', 'text', 'fact', 'fields.billing_entity'],
  ['col_S', 'Selection Panel', 'text', 'note', 'fields.selection_panel'],
  ['col_T', 'Community Advisors', 'text', 'note', 'fields.community_advisors'],
  ['col_U', 'Shortlisted Artists', 'text', 'note', 'fields.shortlisted_artists'],
  ['col_V', 'Artist', 'text', 'note', 'artists_text'],
  ['col_W', 'Artwork Title', 'text', 'note', 'sections.artwork_title'],
  ['col_X', 'Fabricator', 'text', 'note', 'contacts_text.Fabricator'],
  ['col_Y', 'Developer Contact', 'text', 'note', 'contacts_text.Contact'],
  ['col_Z', 'Architect', 'text', 'note', 'contacts_text.Architect'],
  ['col_AA', 'Landscape Architect', 'text', 'note', 'contacts_text.Landscape'],
  ['col_AC', 'Project Budget (Total)', 'numbers', 'metric', 'fields.total_budget'],
  ['col_AD', 'Artist Fee/Artwork Budget', 'numbers', 'metric', 'fields.art_budget'],
  ['col_AE', 'Target Completion Date', 'date', 'due_date', 'fields.install_date'],
  ['col_AF', 'Consultant Fee', 'numbers', 'metric', 'fields.consultant_fee'],
  ['col_AG', 'Building Occupancy', 'date', 'fact', 'fields.building_occupancy'],
  ['col_AH', 'Target Completion - Start', 'date', 'due_date', 'fields.target_completion_start'],
];

export async function seedBfaWorkspaceConfig(db: Kysely<Database>): Promise<void> {
  // Idempotent: check for existing BFA workspace
  const existing = await db
    .selectFrom('monday_workspaces')
    .select('id')
    .where('name', '=', BFA_WORKSPACE_NAME)
    .executeTakeFirst();

  if (existing) {
    console.log(`  [SKIP] BFA workspace already exists (${existing.id})`);
    return;
  }

  // Create workspace
  const workspace = await db
    .insertInto('monday_workspaces')
    .values({
      name: BFA_WORKSPACE_NAME,
      settings: sql`${{ defaultSyncDirection: 'pull' }}::jsonb`,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  console.log(`  [OK] Created BFA workspace: ${workspace.id}`);

  // Create board config
  const boardConfig = await db
    .insertInto('monday_board_configs')
    .values({
      workspace_id: workspace.id,
      board_id: 'bfa_overview',
      board_name: BFA_BOARD_NAME,
      role: BFA_BOARD_ROLE,
      sync_direction: 'pull',
      sync_enabled: true,
      settings: sql`${{
        treatSubitemsAs: 'ignore',
        defaultGroupRole: 'ignore',
      }}::jsonb`,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  console.log(`  [OK] Created BFA board config: ${boardConfig.id}`);

  // Create column configs
  const columnValues = BFA_COLUMNS.map(([columnId, columnTitle, columnType, semanticRole, localFieldKey]) => ({
    board_config_id: boardConfig.id,
    column_id: columnId,
    column_title: columnTitle,
    column_type: columnType,
    semantic_role: semanticRole,
    local_field_key: localFieldKey ?? null,
    is_required: false,
    multi_valued: false,
  }));

  await db
    .insertInto('monday_column_configs')
    .values(columnValues)
    .execute();

  console.log(`  [OK] Created ${columnValues.length} BFA column configs`);

  // Create group configs for the standard BFA board groups
  await db
    .insertInto('monday_group_configs')
    .values([
      {
        board_config_id: boardConfig.id,
        group_id: 'active_projects',
        group_title: 'Active Projects',
        role: 'phase',
        stage_order: 0,
      },
      {
        board_config_id: boardConfig.id,
        group_id: 'completed_projects',
        group_title: 'Completed Projects',
        role: 'archive',
      },
    ])
    .execute();

  console.log('  [OK] Created BFA group configs');
}

// Allow direct execution
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') ?? '')) {
  import('dotenv').then(async (dotenv) => {
    const { Kysely, PostgresDialect } = await import('kysely');
    const { Pool } = await import('pg');
    const path = await import('path');
    const { fileURLToPath } = await import('url');

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.join(__dirname, '..', '..', '..', '..', '.env');
    dotenv.config({ path: envPath });

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    });

    try {
      console.log('Seeding BFA workspace config...');
      await seedBfaWorkspaceConfig(db);
      console.log('Done.');
    } finally {
      await db.destroy();
    }
  });
}
