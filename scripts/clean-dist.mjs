/**
 * Retry-resilient dist/ cleanup for Windows.
 * Windows holds file locks longer than Unix — rmSync fails with EBUSY.
 * Retries up to 5 times with increasing backoff per directory.
 *
 * Usage: node scripts/clean-dist.mjs  (run from repo root)
 */
import { rmSync, existsSync } from 'fs';
import { resolve } from 'path';

const packageDirs = [
  'frontend',
  'backend',
  'shared',
  'packages/ui',
  'apps/mail',
  'apps/autohelper',
];

const maxRetries = 5;
const baseDelayMs = 500;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

let failed = false;

for (const pkg of packageDirs) {
  const distPath = resolve(pkg, 'dist');
  if (!existsSync(distPath)) continue;

  let cleaned = false;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      rmSync(distPath, { recursive: true, force: true });
      cleaned = true;
      break;
    } catch (err) {
      if (err.code === 'EBUSY' && attempt < maxRetries) {
        console.warn(`EBUSY on ${distPath}, retry ${attempt}/${maxRetries}...`);
        sleepSync(baseDelayMs * attempt);
      } else {
        console.error(`Failed to remove ${distPath}: ${err.message}`);
        failed = true;
        break;
      }
    }
  }
  if (cleaned) {
    console.log(`Cleaned ${distPath}`);
  }
}

if (failed) process.exit(1);
