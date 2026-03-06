#!/usr/bin/env npx tsx
/**
 * List custom fields for a ClickUp list.
 *
 * Usage: CLICKUP_TOKEN=pk_... npx tsx scripts/list-custom-fields.ts --list-id 901414366813
 */

import { ClickUp } from '../src/index.js';

const token = process.env.CLICKUP_TOKEN;
if (!token) {
    console.error('Error: CLICKUP_TOKEN environment variable required');
    process.exit(1);
}

const listId = process.argv.find((_, i, a) => a[i - 1] === '--list-id');
if (!listId) {
    console.error('Error: --list-id required');
    process.exit(1);
}

const cu = new ClickUp({ token });

const { fields } = await cu.customFields.list(listId);

console.log(`Custom fields for list ${listId}:\n`);

for (const field of fields) {
    console.log(`${field.name}`);
    console.log(`  ID:       ${field.id}`);
    console.log(`  Type:     ${field.type}`);
    console.log(`  Required: ${field.required}`);

    if (field.type_config.options?.length) {
        console.log(`  Options:`);
        for (const opt of field.type_config.options) {
            console.log(`    - ${opt.name} (${opt.id})${opt.color ? ` [${opt.color}]` : ''}`);
        }
    }
    console.log();
}
