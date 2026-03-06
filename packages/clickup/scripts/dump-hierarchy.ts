#!/usr/bin/env npx tsx
/**
 * Dump workspace hierarchy as a tree.
 *
 * Usage: CLICKUP_TOKEN=pk_... npx tsx scripts/dump-hierarchy.ts [--team-id ID]
 */

import { ClickUp } from '../src/index.js';

const token = process.env.CLICKUP_TOKEN;
if (!token) {
    console.error('Error: CLICKUP_TOKEN environment variable required');
    process.exit(1);
}

const teamIdArg = process.argv.find((_, i, a) => a[i - 1] === '--team-id');
const cu = new ClickUp({ token });

async function run() {
    const { teams } = await cu.spaces.getTeams();
    const targetTeams = teamIdArg ? teams.filter(t => t.id === teamIdArg) : teams;

    for (const team of targetTeams) {
        console.log(`📁 Workspace: ${team.name} (${team.id})`);

        const { spaces } = await cu.spaces.list(team.id);
        for (const space of spaces) {
            console.log(`  📂 Space: ${space.name} (${space.id})`);

            const { folders } = await cu.spaces.getFolders(space.id);
            for (const folder of folders) {
                console.log(`    📁 Folder: ${folder.name} (${folder.id}) [${folder.task_count} tasks]`);
                for (const list of folder.lists) {
                    console.log(`      📋 List: ${list.name} (${list.id}) [${list.task_count ?? '?'} tasks]`);
                }
            }

            const { lists } = await cu.lists.listInSpace(space.id);
            for (const list of lists) {
                console.log(`    📋 List (folderless): ${list.name} (${list.id}) [${list.task_count ?? '?'} tasks]`);
            }
        }
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
