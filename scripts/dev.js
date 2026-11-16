const { spawn } = require('child_process');
const path = require('path');

console.log('[smartgarden] Starting backend and frontend concurrently...');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const backend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.resolve(__dirname, '..', 'backend'),
  stdio: 'inherit',
  shell: true
});

const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.resolve(__dirname, '..', 'frontend'),
  stdio: 'inherit',
  shell: true
});

function shutdown() {
  console.log('\n[smartgarden] Shutting down development servers...');
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

backend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[backend] Process exited with code ${code}`);
  }
});

frontend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[frontend] Process exited with code ${code}`);
  }
});
