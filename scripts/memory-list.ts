#!/usr/bin/env npx tsx
/**
 * List open issues in agent memory
 * Usage: npx tsx scripts/memory-list.ts [label]
 */
import { AgentMemory } from '../lib/agent-memory';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    const label = process.argv[2];

    const memory = new AgentMemory({ debug: false });
    const issues = await memory.listAllIssues('open');

    const filtered = label
        ? issues.filter(i => i.labels?.some((l: any) => l.name === label))
        : issues;

    console.log(`\nOpen issues${label ? ` (${label})` : ''}:\n`);
    for (const issue of filtered) {
        const labels = issue.labels?.map((l: any) => l.name).join(', ') || '';
        console.log(`#${issue.number} - ${issue.title}`);
        if (labels) console.log(`   Labels: ${labels}`);
    }
    console.log(`\nTotal: ${filtered.length} issues`);
}

main().catch(console.error);
