#!/usr/bin/env python
"""Fallback launcher for Pinokio Windows flows that execute `python app.py`.

This keeps LocalClaw usable even when Pinokio bypasses JS manifests.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path


def run_or_fail(command: str, cwd: Path, env: dict[str, str]) -> None:
    rc = subprocess.run(command, cwd=cwd, env=env, shell=True).returncode
    if rc != 0:
        raise SystemExit(rc)


def terminate(proc: subprocess.Popen | None) -> None:
    if not proc:
        return
    if proc.poll() is not None:
        return
    try:
        if os.name == "nt":
            proc.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            proc.terminate()
    except Exception:
        pass


def main() -> int:
    root = Path(__file__).resolve().parent
    env = os.environ.copy()
    env.setdefault("LOCALCLAW_STATE_DIR", str(root / ".localclaw" / "state"))
    env.setdefault("OPENCLAW_CONFIG_PATH", str(root / ".localclaw" / "openclaw.local.json"))

    print("[LocalClaw] Running fallback app.py launcher.")
    print("[LocalClaw] Rendering local-only config...")
    run_or_fail("node scripts/render-local-config.mjs", cwd=root, env=env)

    print("[LocalClaw] Starting OpenClaw gateway...")
    gateway = subprocess.Popen(
        "openclaw gateway run",
        cwd=root,
        env=env,
        shell=True,
        creationflags=(subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0),
    )

    try:
        print("[LocalClaw] Starting OpenClaw dashboard...")
        return subprocess.run("openclaw dashboard", cwd=root, env=env, shell=True).returncode
    finally:
        terminate(gateway)


if __name__ == "__main__":
    raise SystemExit(main())
