import { buildApp } from './app.js';
import { env } from './config/env.js';
import { initializeDatabase } from './db/client.js';

async function start() {
  // Initialize database pool (required for Entra ID token auth in production)
  await initializeDatabase();

  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`Server running at http://${env.HOST}:${env.PORT}`);
    console.log(`CORS origins allowed: ${env.CORS_ORIGIN}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
