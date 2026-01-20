import { AgentMemory } from './lib/agent-memory';
import * as dotenv from 'dotenv';

dotenv.config();

(async () => {
    const memory = new AgentMemory({ debug: true });

    await memory.logLearning(
        'Coffee is essential for debugging. Decaf is just bean water cosplay.',
        ['wisdom', 'frivolous']
    );

    console.log('✓ Frivolous wisdom logged for next session!');
})();
