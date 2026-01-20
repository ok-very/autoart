#!/usr/bin/env npx tsx
/**
 * Close an issue in agent memory
 * Usage: npx tsx scripts/memory-close.ts <issue_number> "<reason>"
 */
import { AgentMemory } from '../lib/agent-memory';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    const [issueNum, reason] = process.argv.slice(2);

    if (!issueNum || !reason) {
        console.error('Usage: npx tsx scripts/memory-close.ts <issue_number> "<reason>"');
        process.exit(1);
    }

    const memory = new AgentMemory({ debug: true });
    await memory.closeIssue(parseInt(issueNum), reason);
    console.log(`✓ Closed issue #${issueNum}`);
}

main().catch(console.error);

