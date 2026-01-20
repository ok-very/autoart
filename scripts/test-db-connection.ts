import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
console.log('📂 Loading .env from:', envPath);
const result = dotenv.config({ path: envPath, override: true });
if (result.error) {
    console.error('⚠️ Error loading .env:', result.error);
}

console.log('🔍 DATABASE_URL found:', process.env.DATABASE_URL ? 'YES' : 'NO');
if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    console.log('🎯 Target Host:', url.hostname);
}


async function testConnection() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Azure requires SSL
    });

    try {
        console.log('🔌 Attempting to connect to Azure PostgreSQL...');
        await client.connect();
        console.log('✅ Connection successful!');

        const result = await client.query('SELECT version()');
        console.log('📊 PostgreSQL version:', result.rows[0].version);

        await client.end();
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();
