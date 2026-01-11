/**
 * Migration 035: Rename owner field key to assignee
 *
 * Updates the field key from 'owner' to 'assignee' across:
 * - record_definitions.schema_config (field definitions)
 * - records.data (record data)
 * - hierarchy_nodes.metadata (node metadata)
 * - actions.field_bindings (action field bindings)
 * - events.payload (event payloads containing fieldKey)
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
    // 1. Update record_definitions.schema_config - rename field key in fields array
    await sql`
        UPDATE record_definitions
        SET schema_config = jsonb_set(
            schema_config,
            '{fields}',
            (
                SELECT COALESCE(
                    jsonb_agg(
                        CASE
                            WHEN field->>'key' = 'owner'
                            THEN jsonb_set(field, '{key}', '"assignee"')
                            ELSE field
                        END
                    ),
                    '[]'::jsonb
                )
                FROM jsonb_array_elements(schema_config->'fields') AS field
            )
        )
        WHERE schema_config->'fields' @> '[{"key": "owner"}]'
    `.execute(db);

    // 2. Update records.data - rename 'owner' key to 'assignee'
    await sql`
        UPDATE records
        SET data = (data - 'owner') || jsonb_build_object('assignee', data->'owner')
        WHERE data ? 'owner'
    `.execute(db);

    // 3. Update hierarchy_nodes.metadata - rename 'owner' key to 'assignee'
    await sql`
        UPDATE hierarchy_nodes
        SET metadata = (metadata - 'owner') || jsonb_build_object('assignee', metadata->'owner')
        WHERE metadata ? 'owner'
    `.execute(db);

    // 4. Update actions.field_bindings - rename fieldKey in array
    await sql`
        UPDATE actions
        SET field_bindings = (
            SELECT COALESCE(
                jsonb_agg(
                    CASE
                        WHEN binding->>'fieldKey' = 'owner'
                        THEN jsonb_set(binding, '{fieldKey}', '"assignee"')
                        ELSE binding
                    END
                ),
                '[]'::jsonb
            )
            FROM jsonb_array_elements(field_bindings) AS binding
        )
        WHERE field_bindings @> '[{"fieldKey": "owner"}]'
    `.execute(db);

    // 5. Update events.payload - rename fieldKey and fieldName references
    await sql`
        UPDATE events
        SET payload = jsonb_set(payload, '{fieldKey}', '"assignee"')
        WHERE payload->>'fieldKey' = 'owner'
    `.execute(db);

    await sql`
        UPDATE events
        SET payload = jsonb_set(payload, '{fieldName}', '"assignee"')
        WHERE payload->>'fieldName' = 'owner'
    `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    // Reverse: assignee -> owner

    // 1. Revert record_definitions.schema_config
    await sql`
        UPDATE record_definitions
        SET schema_config = jsonb_set(
            schema_config,
            '{fields}',
            (
                SELECT COALESCE(
                    jsonb_agg(
                        CASE
                            WHEN field->>'key' = 'assignee'
                            THEN jsonb_set(field, '{key}', '"owner"')
                            ELSE field
                        END
                    ),
                    '[]'::jsonb
                )
                FROM jsonb_array_elements(schema_config->'fields') AS field
            )
        )
        WHERE schema_config->'fields' @> '[{"key": "assignee"}]'
    `.execute(db);

    // 2. Revert records.data
    await sql`
        UPDATE records
        SET data = (data - 'assignee') || jsonb_build_object('owner', data->'assignee')
        WHERE data ? 'assignee'
    `.execute(db);

    // 3. Revert hierarchy_nodes.metadata
    await sql`
        UPDATE hierarchy_nodes
        SET metadata = (metadata - 'assignee') || jsonb_build_object('owner', metadata->'assignee')
        WHERE metadata ? 'assignee'
    `.execute(db);

    // 4. Revert actions.field_bindings
    await sql`
        UPDATE actions
        SET field_bindings = (
            SELECT COALESCE(
                jsonb_agg(
                    CASE
                        WHEN binding->>'fieldKey' = 'assignee'
                        THEN jsonb_set(binding, '{fieldKey}', '"owner"')
                        ELSE binding
                    END
                ),
                '[]'::jsonb
            )
            FROM jsonb_array_elements(field_bindings) AS binding
        )
        WHERE field_bindings @> '[{"fieldKey": "assignee"}]'
    `.execute(db);

    // 5. Revert events.payload
    await sql`
        UPDATE events
        SET payload = jsonb_set(payload, '{fieldKey}', '"owner"')
        WHERE payload->>'fieldKey' = 'assignee'
    `.execute(db);

    await sql`
        UPDATE events
        SET payload = jsonb_set(payload, '{fieldName}', '"owner"')
        WHERE payload->>'fieldName' = 'assignee'
    `.execute(db);
}
