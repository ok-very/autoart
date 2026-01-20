#!/usr/bin/env npx tsx
/**
 * Bulk close issues in agent memory
 * Usage: npx tsx scripts/memory-bulk-close.ts "<reason>" <issue1> <issue2> ...
 */
import { AgentMemory } from '../lib/agent-memory';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    const args = process.argv.slice(2);
    const reason = args[0];
    const issueNums = args.slice(1).map(n => parseInt(n));

    if (!reason || issueNums.length === 0) {
        console.error('Usage: npx tsx scripts/memory-bulk-close.ts "<reason>" <issue1> <issue2> ...');
        process.exit(1);
    }

    const memory = new AgentMemory({ debug: true });

    for (const num of issueNums) {
        try {
            await memory.closeIssue(num, reason);
            console.log(`✓ Closed issue #${num}`);
        } catch (e) {
            console.error(`✗ Failed to close #${num}:`, e);
        }
    }
}

main().catch(console.error);

