"""
Backend Startup & Smoke Verification Suite
──────────────────────────────────────────
Spawns the AIRA FastAPI application on a local loopback port,
verifies server lifespan initialization, checks the /health and /api endpoints over HTTP,
and cleanly terminates the server process.
"""

import os
import sys
import time
import socket
import urllib.request
import urllib.error
import json
import subprocess
from pathlib import Path

# Safe encoding for cross-platform consoles (Windows cp1252)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BACKEND_DIR = Path(__file__).resolve().parent.parent


def find_free_port() -> int:
    """Find a random available port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def verify_backend() -> int:
    port = find_free_port()
    base_url = f"http://127.0.0.1:{port}"
    print(f"[CHECK] Launching AIRA Backend on {base_url} for smoke verification...")

    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND_DIR)
    env["AI_PROVIDER"] = "mock"
    env["GEMINI_API_KEY"] = ""  # Ensure no key required
    env["ENVIRONMENT"] = "testing"

    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
        "--log-level",
        "warning",
    ]

    proc = subprocess.Popen(
        cmd,
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    started = False
    deadline = time.time() + 20.0

    try:
        # 1. Wait for server to boot and respond to /health
        while time.time() < deadline:
            if proc.poll() is not None:
                stdout, stderr = proc.communicate(timeout=2)
                print(f"[FAIL] Backend process exited prematurely with code {proc.returncode}", file=sys.stderr)
                print(f"Stdout:\n{stdout}", file=sys.stderr)
                print(f"Stderr:\n{stderr}", file=sys.stderr)
                return 1

            try:
                with urllib.request.urlopen(f"{base_url}/health", timeout=1.5) as resp:
                    if resp.status == 200:
                        payload = json.loads(resp.read().decode("utf-8"))
                        if payload.get("status") == "ok":
                            print(f"[OK] GET /health responded 200 OK: {payload}")
                            started = True
                            break
            except Exception:
                time.sleep(0.5)

        if not started:
            print("[FAIL] Timeout waiting for backend /health endpoint to become available.", file=sys.stderr)
            proc.kill()
            return 1

        # 2. Check root info endpoint
        with urllib.request.urlopen(f"{base_url}/", timeout=2.0) as resp:
            assert resp.status == 200
            root_data = json.loads(resp.read().decode("utf-8"))
            assert "Revenue Recovery OS" in root_data.get("service", "")
            print(f"[OK] GET / responded 200 OK: {root_data.get('service')}")

        # 3. Check API metrics endpoint (confirms DB connectivity and FastAPI routing)
        with urllib.request.urlopen(f"{base_url}/api/metrics", timeout=2.0) as resp:
            assert resp.status == 200
            metrics_data = json.loads(resp.read().decode("utf-8"))
            assert "revenue_at_risk" in metrics_data
            assert "revenue_recovered" in metrics_data
            print(f"[OK] GET /api/metrics responded 200 OK: Revenue At Risk = ₹{metrics_data['revenue_at_risk']:,.2f}")

        print("[PASS] Backend verification smoke test passed with 100% healthy endpoints.")
        return 0

    finally:
        print("[INFO] Shutting down smoke test server instance...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=2)
        print("[INFO] Backend process terminated cleanly.")


if __name__ == "__main__":
    sys.exit(verify_backend())
