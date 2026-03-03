"""
Sandbox Manager — Runs an isolated preview of the Builder's changes on port 8001.

How it works:
  1. Creates a temp copy of the backend at agent_workspace/{task_id}/sandbox/
  2. Applies the Builder's new/modified files on top
  3. Starts uvicorn on port 8001 from that directory
  4. The user can test via the frontend by temporarily pointing to :8001

The sandbox runs the FULL app with Supabase, so API testing is live.
When the user approves or rejects, the sandbox is stopped.
"""

import os
import sys
import shutil
import subprocess
import signal
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = os.getenv("PROJECT_ROOT", str(Path(__file__).parent.parent.parent))
WORKSPACE_ROOT = Path(__file__).parent.parent / "agent_workspace"
SANDBOX_PORT = int(os.getenv("SANDBOX_PORT", "8001"))

# Track running sandbox processes: { task_id: subprocess.Popen }
_running_sandboxes: dict = {}


def create_sandbox_dir(task_id: str, project_root: str) -> Path:
    """
    Build the sandbox directory by merging:
      1. Current backend files (from project_root/backend/)
      2. Builder's new files (from agent_workspace/task_id/)

    Returns path to the sandbox backend directory.
    """
    workspace_dir = WORKSPACE_ROOT / task_id
    sandbox_dir = workspace_dir / "sandbox"

    if sandbox_dir.exists():
        shutil.rmtree(sandbox_dir)
    sandbox_dir.mkdir(parents=True)

    root = Path(project_root)
    backend_src = root / "backend"

    # Copy entire backend into sandbox
    if backend_src.exists():
        shutil.copytree(
            backend_src,
            sandbox_dir,
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns(
                "__pycache__", "*.pyc", ".env", "agent_workspace",
                "agent_tasks.db", "cache"
            )
        )
    else:
        # If no backend/ subdir, copy root Python files
        for f in root.glob("*.py"):
            shutil.copy2(f, sandbox_dir / f.name)
        # Copy .env if present
        env_file = root / ".env"
        if env_file.exists():
            shutil.copy2(env_file, sandbox_dir / ".env")

    # Copy .env from project root to sandbox (needed for API keys)
    for env_name in [".env", ".env.local"]:
        env_src = root / env_name
        if not env_src.exists():
            env_src = root / "backend" / env_name
        if env_src.exists():
            shutil.copy2(env_src, sandbox_dir / ".env")
            break

    # Apply Builder's new files on top
    for builder_file in workspace_dir.rglob("*"):
        if builder_file.is_dir():
            continue
        rel = builder_file.relative_to(workspace_dir)
        parts = rel.parts

        # Skip meta files
        if parts[0] in ("sandbox", "plan.json", "manifest.json", "teacher_report.md"):
            continue

        # Handle backend/ prefix in file paths
        if parts[0] == "backend":
            dest_rel = Path(*parts[1:])
        else:
            dest_rel = rel

        dest = sandbox_dir / dest_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(builder_file, dest)

    print(f"[Sandbox] Created sandbox at {sandbox_dir}")
    return sandbox_dir


def start_sandbox(task_id: str, project_root: str = None, port: int = None) -> dict:
    """
    Start a sandbox FastAPI server for the given task.

    Returns:
        { "pid": int, "port": int, "sandbox_dir": str }
    """
    # Stop any existing sandbox for this task
    stop_sandbox(task_id)

    root = project_root or PROJECT_ROOT
    actual_port = port or SANDBOX_PORT

    try:
        sandbox_dir = create_sandbox_dir(task_id, root)
    except Exception as e:
        print(f"[Sandbox] Failed to create sandbox dir: {e}")
        return {"error": str(e)}

    # Find the main FastAPI app file
    main_candidates = ["main.py", "app.py", "server.py"]
    main_file = None
    for candidate in main_candidates:
        if (sandbox_dir / candidate).exists():
            main_file = candidate.replace(".py", "")
            break

    if not main_file:
        return {"error": "Could not find main.py in sandbox directory"}

    try:
        # Start uvicorn as a subprocess
        process = subprocess.Popen(
            [
                sys.executable, "-m", "uvicorn",
                f"{main_file}:app",
                "--host", "0.0.0.0",
                "--port", str(actual_port),
                "--reload",
            ],
            cwd=str(sandbox_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        _running_sandboxes[task_id] = process
        print(f"[Sandbox] Started on port {actual_port} (PID {process.pid})")

        return {
            "pid": process.pid,
            "port": actual_port,
            "sandbox_dir": str(sandbox_dir),
            "url": f"http://localhost:{actual_port}",
        }

    except Exception as e:
        print(f"[Sandbox] Failed to start process: {e}")
        return {"error": str(e)}


def stop_sandbox(task_id: str) -> bool:
    """Stop the sandbox server for the given task."""
    from agents.task_manager import get_task, update_task

    # Kill tracked process
    if task_id in _running_sandboxes:
        proc = _running_sandboxes.pop(task_id)
        try:
            proc.terminate()
            proc.wait(timeout=5)
            print(f"[Sandbox] Stopped sandbox for task {task_id}")
        except Exception as e:
            try:
                proc.kill()
            except Exception:
                pass
            print(f"[Sandbox] Force-killed sandbox for task {task_id}")
        return True

    # Try to kill by PID from DB
    try:
        task = get_task(task_id)
        if task and task.get("sandbox_pid"):
            pid = task["sandbox_pid"]
            try:
                os.kill(pid, signal.SIGTERM)
                print(f"[Sandbox] Sent SIGTERM to PID {pid}")
                update_task(task_id, sandbox_pid=None)
                return True
            except ProcessLookupError:
                pass  # Already dead
    except Exception as e:
        print(f"[Sandbox] Error stopping by PID: {e}")

    return False


def get_sandbox_status(task_id: str) -> dict:
    """Check if sandbox is running and return status info."""
    if task_id in _running_sandboxes:
        proc = _running_sandboxes[task_id]
        if proc.poll() is None:
            return {
                "running": True,
                "pid": proc.pid,
                "port": SANDBOX_PORT,
                "url": f"http://localhost:{SANDBOX_PORT}",
            }
        else:
            # Process ended
            _running_sandboxes.pop(task_id, None)

    return {"running": False, "port": SANDBOX_PORT}


def get_file_diff(task_id: str, project_root: str = None) -> list:
    """
    Return a list of file diffs between current project and Builder's workspace.

    Returns:
        [
          {
            "path": "backend/main.py",
            "action": "create" | "modify",
            "old_content": "...",  # None for create
            "new_content": "...",
            "additions": 15,
            "deletions": 3,
          },
          ...
        ]
    """
    import difflib

    root = Path(project_root or PROJECT_ROOT)
    workspace_dir = WORKSPACE_ROOT / task_id

    if not workspace_dir.exists():
        return []

    diffs = []

    for new_file in workspace_dir.rglob("*"):
        if new_file.is_dir():
            continue
        if new_file.suffix not in {".py", ".jsx", ".js", ".ts", ".tsx"}:
            continue

        rel_parts = new_file.relative_to(workspace_dir).parts
        if rel_parts[0] in ("sandbox",):
            continue
        if new_file.name in ("plan.json", "manifest.json", "teacher_report.md"):
            continue

        rel_path = str(new_file.relative_to(workspace_dir))
        new_content = new_file.read_text(encoding="utf-8", errors="ignore")

        # Find existing file
        current_file = root / rel_path
        if not current_file.exists():
            # Also try with backend/ prefix
            if not rel_path.startswith("backend/"):
                current_file = root / "backend" / rel_path

        if current_file.exists():
            old_content = current_file.read_text(encoding="utf-8", errors="ignore")
            action = "modify"
        else:
            old_content = ""
            action = "create"

        # Count additions/deletions
        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)
        additions = sum(1 for d in difflib.ndiff(old_lines, new_lines) if d.startswith("+ "))
        deletions = sum(1 for d in difflib.ndiff(old_lines, new_lines) if d.startswith("- "))

        diffs.append({
            "path": rel_path,
            "action": action,
            "old_content": old_content if action == "modify" else None,
            "new_content": new_content,
            "additions": additions,
            "deletions": deletions,
        })

    return sorted(diffs, key=lambda d: d["path"])
