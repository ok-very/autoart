#!/usr/bin/env npx tsx
/**
 * Validate ClickUp connection — fetch teams and print workspace info.
 *
 * Usage: CLICKUP_TOKEN=pk_... npx tsx scripts/validate-connection.ts
 */

import { ClickUp } from '../src/index.js';

const token = process.env.CLICKUP_TOKEN;
if (!token) {
    console.error('Error: CLICKUP_TOKEN environment variable required');
    process.exit(1);
}

const cu = new ClickUp({ token });

const { teams } = await cu.spaces.getTeams();

if (!teams.length) {
    console.error('No workspaces found for this token');
    process.exit(1);
}

for (const team of teams) {
    console.log(`Workspace: ${team.name} (ID: ${team.id})`);
    console.log(`  Members: ${team.members.length}`);
    for (const m of team.members) {
        console.log(`    - ${m.user.username} (${m.user.email ?? 'no email'})`);
    }
}

console.log('\nConnection OK');
