/**
 * Unified Local CI Runner for AIRA
 * ────────────────────────────────
 * Reproduces the GitHub Actions CI pipeline locally in a single command.
 * Enforces requirement #37:
 * - Deterministic execution
 * - ZERO Gemini API key required
 * - Full verification: Lint -> Typecheck -> Tests -> Datasets -> Backend -> Frontend Build
 */

const path = require('path');
const { spawnSync } = require('child_process');
const { getPythonExecutable } = require('./python_finder.cjs');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');

const { cmd: pythonCmd, args: pythonBaseArgs } = getPythonExecutable();

// Explicitly ensure mock AI provider and clear any accidental live key for normal CI
const baseEnv = {
  ...process.env,
  AI_PROVIDER: 'mock',
  GEMINI_API_KEY: '',
  PYTHONPATH: backendDir,
};

const stages = [
  {
    name: '1. Frontend Lint (oxlint)',
    cmd: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'lint'],
    cwd: frontendDir,
    env: baseEnv,
  },
  {
    name: '2. Frontend Typecheck (tsc -b)',
    cmd: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'typecheck'],
    cwd: frontendDir,
    env: baseEnv,
  },
  {
    name: '3a. Backend Tests & Gemini Contract Tests (pytest offline)',
    cmd: pythonCmd,
    args: [...pythonBaseArgs, '-m', 'pytest'],
    cwd: backendDir,
    env: baseEnv,
  },
  {
    name: '3b. Frontend Flow & State Verification Tests (tsx verify_flows)',
    cmd: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'test'],
    cwd: frontendDir,
    env: baseEnv,
  },
  {
    name: '4a. Backend Dataset Validation (validate_datasets.py)',
    cmd: pythonCmd,
    args: [...pythonBaseArgs, path.join('scripts', 'validate_datasets.py')],
    cwd: backendDir,
    env: baseEnv,
  },
  {
    name: '4b. Frontend Dataset Validation (validate_datasets.ts)',
    cmd: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'validate:dataset'],
    cwd: frontendDir,
    env: baseEnv,
  },
  {
    name: '5. Backend Startup & Endpoint Verification Smoke Test (verify_backend.py)',
    cmd: pythonCmd,
    args: [...pythonBaseArgs, path.join('scripts', 'verify_backend.py')],
    cwd: backendDir,
    env: baseEnv,
  },
  {
    name: '6. Frontend Production Build (vite build)',
    cmd: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'build'],
    cwd: frontendDir,
    env: baseEnv,
  },
];

console.log('================================================================');
console.log(' AIRA REVENUE RECOVERY OS — LOCAL CI VERIFICATION PIPELINE');
console.log(' Mode: Deterministic Offline CI (GEMINI_API_KEY unset / AI_PROVIDER=mock)');
console.log('================================================================\n');

const startTime = Date.now();

for (let i = 0; i < stages.length; i++) {
  const stage = stages[i];
  console.log(`\n▶ [${i + 1}/${stages.length}] RUNNING: ${stage.name}`);
  console.log(`  Directory: ${path.relative(rootDir, stage.cwd) || '.'}`);

  const res = spawnSync(stage.cmd, stage.args, {
    cwd: stage.cwd,
    env: stage.env,
    stdio: 'inherit',
    shell: true,
  });

  if (res.status !== 0) {
    if (res.error) {
      console.error('Spawn error:', res.error);
    }
    console.error(`\n❌ FAILED: ${stage.name} (exit code ${res.status})`);
    process.exit(res.status ?? 1);
  }

  console.log(`✔ PASSED: ${stage.name}`);
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log('\n================================================================');
console.log(`🎉 ALL ${stages.length} CI PIPELINE STAGES PASSED SUCCESSFULLY in ${duration}s!`);
console.log('================================================================\n');
process.exit(0);
