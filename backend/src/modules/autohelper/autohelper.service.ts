/**
 * AutoHelper Service
 *
 * Manages settings, status, and command queue for the AutoHelper bridge.
 * Enables web UI to control AutoHelper even when it runs on a different machine.
 */

import { db } from '../../db/client.js';
import type {
  AutoHelperInstance,
  AutoHelperCommand,
  NewAutoHelperCommand,
} from '../../db/schema.js';

// ============================================================================
// TYPES
// ============================================================================

/** Settings shape stored in autohelper_instances.settings */
export interface AutoHelperSettings {
  allowed_roots?: string[];
  excludes?: string[];
  mail_enabled?: boolean;
  mail_poll_interval?: number;
  crawl_depth?: number;
  min_width?: number;
  max_width?: number;
  min_height?: number;
  max_height?: number;
  min_filesize_kb?: number;
  max_filesize_kb?: number;
}

/** Status shape stored in autohelper_instances.status */
export interface AutoHelperStatus {
  database?: { connected: boolean; path: string; migration_status: string };
  roots?: Array<{ path: string; accessible: boolean; file_count?: number }>;
  runner?: { active: boolean; current_runner?: string };
  mail?: { enabled: boolean; running: boolean };
  index?: { status: string; total_files?: number; last_run?: string };
  gc?: { enabled: boolean; last_run?: string };
}

/** Command types that can be queued */
export type CommandType =
  | 'rescan_index'
  | 'rebuild_index'
  | 'run_collector'
  | 'start_mail'
  | 'stop_mail'
  | 'run_gc';

/** Payload varies by command type */
export interface CommandPayload {
  url?: string;
  output_path?: string;
}

// ============================================================================
// SETTINGS
// ============================================================================

/**
 * Get or create AutoHelper instance for a user.
 */
export async function getOrCreateInstance(
  userId: string
): Promise<AutoHelperInstance> {
  
  // Try to get existing
  const existing = await db
    .selectFrom('autohelper_instances')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (existing) {
    return existing;
  }

  // Create new with default settings
  const defaultSettings: AutoHelperSettings = {
    allowed_roots: [],
    excludes: ['pyc', '__pycache__', '.git', '.idea', 'node_modules'],
    mail_enabled: false,
    mail_poll_interval: 30,
    crawl_depth: 20,
    min_width: 100,
    max_width: 5000,
    min_height: 100,
    max_height: 5000,
    min_filesize_kb: 100,
    max_filesize_kb: 12000,
  };

  const [instance] = await db
    .insertInto('autohelper_instances')
    .values({
      user_id: userId,
      settings: JSON.stringify(defaultSettings),
      status: JSON.stringify({}),
    })
    .returningAll()
    .execute();

  return instance;
}

/**
 * Get settings for a user.
 */
export async function getSettings(
  userId: string
): Promise<{ settings: AutoHelperSettings; version: number }> {
  const instance = await getOrCreateInstance(userId);
  return {
    settings: instance.settings as AutoHelperSettings,
    version: instance.settings_version,
  };
}

/**
 * Update settings (partial merge), bump version.
 */
export async function updateSettings(
  userId: string,
  updates: Partial<AutoHelperSettings>
): Promise<{ settings: AutoHelperSettings; version: number }> {
  
  // Get current
  const instance = await getOrCreateInstance(userId);
  const currentSettings = instance.settings as AutoHelperSettings;

  // Merge
  const newSettings: AutoHelperSettings = {
    ...currentSettings,
    ...updates,
  };

  // Update with version bump
  const [updated] = await db
    .updateTable('autohelper_instances')
    .set({
      settings: JSON.stringify(newSettings),
      settings_version: instance.settings_version + 1,
      updated_at: new Date(),
    })
    .where('user_id', '=', userId)
    .returningAll()
    .execute();

  return {
    settings: updated.settings as AutoHelperSettings,
    version: updated.settings_version,
  };
}

// ============================================================================
// STATUS
// ============================================================================

/**
 * Get cached status + last seen for a user.
 */
export async function getStatus(userId: string): Promise<{
  status: AutoHelperStatus;
  lastSeen: Date | null;
  pendingCommands: Array<{ id: string; type: string; status: string }>;
}> {
  
  const instance = await getOrCreateInstance(userId);

  // Get pending/running commands
  const commands = await db
    .selectFrom('autohelper_commands')
    .select(['id', 'command_type', 'status'])
    .where('user_id', '=', userId)
    .where('status', 'in', ['pending', 'running'])
    .orderBy('created_at', 'asc')
    .execute();

  return {
    status: instance.status as AutoHelperStatus,
    lastSeen: instance.last_seen,
    pendingCommands: commands.map((c) => ({
      id: c.id,
      type: c.command_type,
      status: c.status,
    })),
  };
}

/**
 * Update cached status (called by AutoHelper heartbeat).
 */
export async function updateStatus(
  userId: string,
  status: AutoHelperStatus
): Promise<void> {
  
  await getOrCreateInstance(userId);

  await db
    .updateTable('autohelper_instances')
    .set({
      status: JSON.stringify(status),
      last_seen: new Date(),
      updated_at: new Date(),
    })
    .where('user_id', '=', userId)
    .execute();
}

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Queue a command for execution.
 */
export async function queueCommand(
  userId: string,
  commandType: CommandType,
  payload: CommandPayload = {}
): Promise<AutoHelperCommand> {
  
  const newCommand: NewAutoHelperCommand = {
    user_id: userId,
    command_type: commandType,
    payload: JSON.stringify(payload),
    status: 'pending',
  };

  const [command] = await db
    .insertInto('autohelper_commands')
    .values(newCommand)
    .returningAll()
    .execute();

  return command;
}

/**
 * Get a command by ID.
 */
export async function getCommand(
  commandId: string
): Promise<AutoHelperCommand | undefined> {
  
  return db
    .selectFrom('autohelper_commands')
    .selectAll()
    .where('id', '=', commandId)
    .executeTakeFirst();
}

/**
 * Get pending commands for a user (called by AutoHelper poll).
 */
export async function getPendingCommands(
  userId: string
): Promise<AutoHelperCommand[]> {
  
  return db
    .selectFrom('autohelper_commands')
    .selectAll()
    .where('user_id', '=', userId)
    .where('status', '=', 'pending')
    .orderBy('created_at', 'asc')
    .execute();
}

/**
 * Mark command as running.
 */
export async function markCommandRunning(commandId: string): Promise<void> {
  
  await db
    .updateTable('autohelper_commands')
    .set({ status: 'running' })
    .where('id', '=', commandId)
    .execute();
}

/**
 * Acknowledge command completion.
 */
export async function acknowledgeCommand(
  commandId: string,
  success: boolean,
  result?: unknown
): Promise<void> {
  
  await db
    .updateTable('autohelper_commands')
    .set({
      status: success ? 'completed' : 'failed',
      result: result ? JSON.stringify(result) : null,
      acknowledged_at: new Date(),
    })
    .where('id', '=', commandId)
    .execute();
}

/**
 * Clean up old acknowledged commands (older than 1 hour).
 * Called periodically to prevent table bloat.
 */
export async function cleanupOldCommands(): Promise<number> {
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const result = await db
    .deleteFrom('autohelper_commands')
    .where('acknowledged_at', '<', oneHourAgo)
    .executeTakeFirst();

  return Number(result.numDeletedRows);
}

// ============================================================================
// POLL (AutoHelper-facing)
// ============================================================================

/**
 * Combined poll response for AutoHelper.
 * Returns settings + pending commands in one call.
 */
export async function poll(userId: string): Promise<{
  settings: AutoHelperSettings;
  settingsVersion: number;
  commands: AutoHelperCommand[];
}> {
  const { settings, version } = await getSettings(userId);
  const commands = await getPendingCommands(userId);

  return {
    settings,
    settingsVersion: version,
    commands,
  };
}
