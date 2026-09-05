/**
 * Cross-platform Python runtime discovery for AIRA tooling.
 * Resolves the appropriate python executable across Windows, macOS, Linux, and CI environments.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function getPythonExecutable() {
  if (process.env.PYTHON && fs.existsSync(process.env.PYTHON)) {
    return { cmd: process.env.PYTHON, args: [] };
  }

  const rootDir = path.resolve(__dirname, '..');
  const winVenv = path.join(rootDir, 'backend', 'venv', 'Scripts', 'python.exe');
  if (fs.existsSync(winVenv)) {
    return { cmd: winVenv, args: [] };
  }

  const unixVenv = path.join(rootDir, 'backend', 'venv', 'bin', 'python');
  if (fs.existsSync(unixVenv)) {
    return { cmd: unixVenv, args: [] };
  }

  // Check python in system PATH
  const candidates = ['python', 'python3', 'py'];
  for (const candidate of candidates) {
    try {
      const args = candidate === 'py' ? ['-3', '--version'] : ['--version'];
      const res = spawnSync(candidate, args, { stdio: 'pipe' });
      if (res.status === 0) {
        return { cmd: candidate, args: candidate === 'py' ? ['-3'] : [] };
      }
    } catch {
      // Continue checking next candidate
    }
  }

  // Default fallback
  return { cmd: 'python', args: [] };
}

module.exports = { getPythonExecutable };
