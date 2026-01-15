/**
 * Test script to fetch Monday board and analyze its structure
 * Run with: npx tsx scripts/test-monday-board.ts
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

import { MondayConnector } from '../src/modules/imports/connectors/monday-connector.js';

const BOARD_ID = '18034877971';

async function main() {
    // Get token from environment
    const token = process.env.MONDAY_API_TOKEN;
    if (!token) {
        console.error('MONDAY_API_TOKEN not set in environment');
        process.exit(1);
    }

    console.log(`\n=== Fetching Board ${BOARD_ID} ===\n`);

    const connector = new MondayConnector(token);

    // First, get schema
    console.log('--- Board Schema ---');
    const schema = await connector.discoverBoardSchema(BOARD_ID);
    console.log('Board Name:', schema.boardName);
    console.log('Hierarchy Type:', schema.hierarchyType);
    console.log('Item Count:', schema.itemCount);
    console.log('Groups:', schema.groups.map(g => g.title));
    console.log('Columns:', schema.columns.map(c => `${c.title} (${c.type})`));

    // Check for relation/mirror columns
    const relationColumns = schema.columns.filter(c =>
        c.type === 'board_relation' || c.type === 'mirror'
    );
    if (relationColumns.length > 0) {
        console.log('\n--- Relation/Mirror Columns ---');
        for (const col of relationColumns) {
            console.log(`  ${col.title}: ${col.type}`, col.settings);
        }
    }

    // Collect all nodes
    console.log('\n--- Traversing Hierarchy ---');
    const nodes: any[] = [];
    let boardCount = 0, groupCount = 0, itemCount = 0, subitemCount = 0;

    for await (const node of connector.traverseHierarchy(BOARD_ID)) {
        nodes.push(node);
        switch (node.type) {
            case 'board': boardCount++; break;
            case 'group': groupCount++; break;
            case 'item': itemCount++; break;
            case 'subitem': subitemCount++; break;
        }
    }

    console.log(`Total nodes: ${nodes.length}`);
    console.log(`  Boards: ${boardCount}`);
    console.log(`  Groups: ${groupCount}`);
    console.log(`  Items: ${itemCount}`);
    console.log(`  Subitems: ${subitemCount}`);

    // Show groups and sample items
    console.log('\n--- Groups ---');
    const groups = nodes.filter(n => n.type === 'group');
    for (const group of groups) {
        const items = nodes.filter(n => n.type === 'item' && n.metadata.groupId === group.id);
        console.log(`\n  ${group.name} (${items.length} items)`);

        // Show first 3 items
        for (const item of items.slice(0, 3)) {
            console.log(`    - ${item.name}`);

            // Check for relation columns
            const relationValues = item.columnValues.filter((cv: any) =>
                cv.type === 'board_relation' || cv.type === 'mirror'
            );
            if (relationValues.length > 0) {
                for (const rv of relationValues) {
                    console.log(`      [${rv.type}] ${rv.title}: ${JSON.stringify(rv.value)}`);
                }
            }
        }
        if (items.length > 3) {
            console.log(`    ... and ${items.length - 3} more`);
        }
    }

    // Save full data for analysis
    const fs = await import('fs');
    fs.writeFileSync(
        resolve(__dirname, 'board-data.json'),
        JSON.stringify({ schema, nodes }, null, 2)
    );
    console.log('\n--- Full data saved to scripts/board-data.json ---');
}

main().catch(console.error);
