import { spawn } from 'node:child_process';

const API_URL = process.env.API_URL || 'http://localhost:7071/api';
const HEALTH_URL = `${API_URL}/puzzle`;
const STARTUP_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApiReady() {
  const start = Date.now();

  while (Date.now() - start < STARTUP_TIMEOUT_MS) {
    try {
      const response = await fetch(HEALTH_URL, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for API at ${HEALTH_URL}`);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const host = spawn('npm', ['run', 'start'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      API_URL,
    },
  });

  const cleanup = () => {
    if (!host.killed) {
      host.kill('SIGTERM');
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  try {
    console.log(`[smoke] Waiting for API readiness at ${HEALTH_URL}`);
    await waitForApiReady();

    console.log('[smoke] API is ready. Running smoke tests...');
    await runCommand('npm', ['run', 'test:smoke'], {
      env: {
        ...process.env,
        API_URL,
      },
    });

    console.log('[smoke] Smoke tests completed successfully.');
  } finally {
    cleanup();
  }
}

main().catch((error) => {
  console.error('[smoke] Failed:', error.message);
  process.exitCode = 1;
});
