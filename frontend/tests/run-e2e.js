import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { startE2EEnvironment } from './helpers/server-harness.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '..');

async function main() {
  console.log('[E2E Runner] Starting Fastify API & built frontend server...');
  const env = await startE2EEnvironment();
  console.log(`[E2E Runner] Backend API: ${env.apiBaseUrl} (dialect=${env.dialect})`);
  console.log(`[E2E Runner] Frontend SPA + /api + /ws proxy: ${env.baseUrl}`);

  let exitCode = 1;
  try {
    exitCode = await new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        [
          '--test',
          '--test-concurrency=1',
          '--test-timeout=60000',
          '--test-reporter=spec',
          'tests/e2e/public-pages.test.js',
          'tests/e2e/auth-flows.test.js',
          'tests/e2e/dashboard-f1-f5.test.js',
          'tests/e2e/sprint2-f6-f10.test.js',
          'tests/e2e/sprint3-f11-f15.test.js',
          'tests/e2e/sprint4-f16-f20.test.js',
          'tests/e2e/sprint5-f21-f24-3d.test.js',
          'tests/e2e/coming-soon-and-edges.test.js'
        ],
        {
          cwd: FRONTEND_DIR,
          stdio: 'inherit',
          env: {
            ...process.env,
            SG_E2E_BASE_URL: env.baseUrl,
            SG_E2E_API_URL: env.apiBaseUrl
          }
        }
      );
      child.on('exit', (code) => resolve(code ?? 1));
    });
  } finally {
    console.log('[E2E Runner] Cleaning up E2E test records and shutting down servers...');
    await env.stop();
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('[E2E Runner] Fatal error:', err);
  process.exit(1);
});
