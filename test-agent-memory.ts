import { AgentMemory } from './lib/agent-memory';
import * as dotenv from 'dotenv';

// Load .env at entrypoint
dotenv.config();

async function test() {
    // Uses GITHUB_OWNER and GITHUB_MEMORY_REPO from .env
    const memory = new AgentMemory({ debug: true });

    console.log('Testing agent memory system...\n');

    // Test 1: Add context
    console.log('1. Adding context note...');
    await memory.addContext(
        'test-key',
        'This is a test context value to verify the system works.',
        ['test']
    );

    // Test 2: Retrieve context
    console.log('\n2. Retrieving context...');
    const context = await memory.getContext('test-key');
    console.log(`  Retrieved: ${context}`);

    // Test 3: Log a learning
    console.log('\n3. Logging a learning...');
    await memory.logLearning(
        'Agent memory system uses GitHub Issues for persistence',
        ['architecture', 'github']
    );

    // Test 4: Create a handoff
    console.log('\n4. Creating session handoff...');
    await memory.createHandoff({
        summary: 'Initial agent memory system test completed successfully.',
        incomplete: ['Add project board integration'],
        blockers: [],
    });

    // Test 5: Get latest handoff
    console.log('\n5. Getting latest handoff...');
    const handoff = await memory.getLatestHandoff();
    if (handoff) {
        console.log(`  Latest handoff: #${handoff.number} - ${handoff.title}`);
    }

    // Test 6: Create a work item
    console.log('\n6. Creating P1 task...');
    const task = await memory.createIssue(
        'Implement GitHub Project board integration',
        {
            description: 'Add support for organizing issues on a Project board.',
            priority: 1,
            type: 'feature',
            labels: ['enhancement'],
        }
    );

    // Test 7: Get ready work
    console.log('\n7. Finding ready work...');
    const readyWork = await memory.getReadyWork();
    console.log(`  Found ${readyWork.length} ready issues`);

    // Test 8: Close the test task
    console.log('\n8. Closing test task...');
    await memory.closeIssue(task.number, 'Test completed successfully');

    console.log('\n✓ All tests passed!');
}

// Run tests
test().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
