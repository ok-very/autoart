import { db } from '../../db/client.js';
import type { UserSetting, NewUserSetting } from '../../db/schema.js';

export const SETTING_KEYS = {
  SHAREPOINT_REQUEST_URL: 'sharepoint_request_url',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export async function getSetting(
  userId: string,
  key: SettingKey
): Promise<unknown | null> {
  const setting = await db
    .selectFrom('user_settings')
    .select('setting_value')
    .where('user_id', '=', userId)
    .where('setting_key', '=', key)
    .executeTakeFirst();

  return setting?.setting_value ?? null;
}

export async function getSettings(userId: string): Promise<Record<string, unknown>> {
  const settings = await db
    .selectFrom('user_settings')
    .selectAll()
    .where('user_id', '=', userId)
    .execute();

  return settings.reduce(
    (acc, s) => ({ ...acc, [s.setting_key]: s.setting_value }),
    {} as Record<string, unknown>
  );
}

export async function setSetting(
  userId: string,
  key: SettingKey,
  value: unknown
): Promise<UserSetting> {
  const existing = await db
    .selectFrom('user_settings')
    .selectAll()
    .where('user_id', '=', userId)
    .where('setting_key', '=', key)
    .executeTakeFirst();

  if (existing) {
    return db
      .updateTable('user_settings')
      .set({ setting_value: value, updated_at: new Date() })
      .where('id', '=', existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  return db
    .insertInto('user_settings')
    .values({
      user_id: userId,
      setting_key: key,
      setting_value: value,
    } satisfies NewUserSetting)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteSetting(
  userId: string,
  key: SettingKey
): Promise<void> {
  await db
    .deleteFrom('user_settings')
    .where('user_id', '=', userId)
    .where('setting_key', '=', key)
    .execute();
}
