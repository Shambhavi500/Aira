/**
 * Helper to dispatch backend python commands cleanly across OS environments.
 */

const path = require('path');
const { spawnSync } = require('child_process');
const { getPythonExecutable } = require('./python_finder.cjs');

const target = process.argv[2];
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');

const { cmd, args: baseArgs } = getPythonExecutable();

const env = {
  ...process.env,
  PYTHONPATH: backendDir,
  AI_PROVIDER: process.env.AI_PROVIDER || 'mock',
};

let runArgs = [...baseArgs];

if (target === 'pytest') {
  runArgs.push('-m', 'pytest');
} else if (target === 'pytest-gemini') {
  runArgs.push('-m', 'pytest', '-v', '-m', 'live_gemini');
} else if (target === 'validate-datasets') {
  runArgs.push(path.join('scripts', 'validate_datasets.py'));
} else if (target === 'verify-backend') {
  runArgs.push(path.join('scripts', 'verify_backend.py'));
} else {
  console.error(`Unknown target command: ${target}`);
  process.exit(1);
}

const result = spawnSync(cmd, runArgs, {
  cwd: backendDir,
  env,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
