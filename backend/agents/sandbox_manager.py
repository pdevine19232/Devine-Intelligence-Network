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
import stat
import shutil
import subprocess
import signal
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = os.getenv("PROJECT_ROOT", str(Path(__file__).parent.parent.parent))
WORKSPACE_ROOT = Path(__file__).parent.parent / "agent_workspace"
SANDBOX_PORT = int(os.getenv("SANDBOX_PORT", "8001"))
PREVIEW_BACKEND_PORT  = 8001
PREVIEW_FRONTEND_PORT = 3001

# Track running sandbox processes: { task_id: subprocess.Popen }
_running_sandboxes: dict = {}

# Track running isolated preview processes: { task_id: {"frontend": Popen, ...} }
_running_previews: dict = {}


def _link_dir(source: Path, target: Path):
    """
    Create a directory junction (Windows) or symlink (Unix) for node_modules.
    Windows directory junctions do NOT require admin — unlike symlinks.
    """
    import platform
    if platform.system() == "Windows":
        result = subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(target), str(source)],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip())
    else:
        os.symlink(source, target)


def _force_remove(func, path, exc_info):
    """
    Error handler for shutil.rmtree on Windows.
    If a file is read-only (common with OneDrive-synced folders),
    this resets its permissions and retries the delete.
    """
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass  # Best-effort; ignore if still can't remove


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
        shutil.rmtree(sandbox_dir, onerror=_force_remove)
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


def preview_frontend_changes(task_id: str, project_root: str = None) -> dict:
    """
    Start a FULLY ISOLATED preview of the Builder's changes:
      - Backend copy runs on port 8001
      - React frontend copy runs on port 3001
    The live app (ports 3000 + 8000) and its files are NEVER touched.
    Call restore_frontend_preview() to kill both preview processes.
    """
    root = Path(project_root or PROJECT_ROOT)
    workspace_dir = WORKSPACE_ROOT / task_id
    frontend_dir = root / "frontend"
    frontend_sandbox = workspace_dir / "frontend_sandbox"

    if not frontend_dir.exists():
        return {"error": f"Could not find frontend folder at: {frontend_dir}"}

    if not workspace_dir.exists():
        return {"error": "No workspace found — run the Builder first"}

    # Stop any existing preview for this task first
    restore_frontend_preview(task_id, project_root)

    # ── 1. Start backend sandbox on port 8001 ─────────────────────────────
    backend_result = start_sandbox(task_id, project_root, port=PREVIEW_BACKEND_PORT)
    if "error" in backend_result:
        return {"error": f"Backend preview failed: {backend_result['error']}"}
    print(f"[Preview] Backend sandbox started on port {PREVIEW_BACKEND_PORT}")

    # ── 2. Copy frontend into workspace (excluding node_modules/build) ────
    if frontend_sandbox.exists():
        shutil.rmtree(frontend_sandbox, onerror=_force_remove)
    frontend_sandbox.mkdir(parents=True)

    shutil.copytree(
        frontend_dir,
        frontend_sandbox,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns("node_modules", "build", ".git", "*.log")
    )
    print(f"[Preview] Copied frontend to {frontend_sandbox}")

    # ── 3. Link node_modules from original (avoids copying 500MB) ─────────
    original_nm = frontend_dir / "node_modules"
    sandbox_nm  = frontend_sandbox / "node_modules"
    if original_nm.exists() and not sandbox_nm.exists():
        try:
            _link_dir(original_nm, sandbox_nm)
            print(f"[Preview] Linked node_modules via junction")
        except Exception as e:
            print(f"[Preview] Junction failed ({e}), falling back to copy (slow)...")
            shutil.copytree(original_nm, sandbox_nm)

    # ── 4. Apply Builder's frontend files on top ──────────────────────────
    applied = []
    for builder_file in workspace_dir.rglob("*"):
        if builder_file.is_dir():
            continue
        rel = builder_file.relative_to(workspace_dir)
        parts = rel.parts

        if parts[0] in ("sandbox", "frontend_sandbox", "plan.json",
                        "manifest.json", "teacher_report.md"):
            continue
        if builder_file.suffix not in {".jsx", ".js", ".ts", ".tsx", ".css"}:
            continue

        dest = None
        if parts[0] == "frontend" and len(parts) > 1:
            dest = frontend_sandbox / Path(*parts[1:])
        elif parts[0] == "src":
            dest = frontend_sandbox / "src" / Path(*parts[1:])

        if dest:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(builder_file, dest)
            applied.append(str(rel))
            print(f"[Preview] Applied {rel}")

    # ── 5. Point sandbox frontend at port 8001 instead of 8000 ───────────
    sandbox_src = frontend_sandbox / "src"
    if sandbox_src.exists():
        for f in sandbox_src.rglob("*"):
            if f.is_file() and f.suffix in {".js", ".jsx", ".ts", ".tsx"}:
                try:
                    content = f.read_text(encoding="utf-8", errors="ignore")
                    if "localhost:8000" in content:
                        f.write_text(
                            content.replace("localhost:8000", f"localhost:{PREVIEW_BACKEND_PORT}"),
                            encoding="utf-8"
                        )
                except Exception:
                    pass

    # ── 6. Start React on port 3001 ───────────────────────────────────────
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    env = os.environ.copy()
    env["PORT"]    = str(PREVIEW_FRONTEND_PORT)
    env["BROWSER"] = "none"

    try:
        npm_proc = subprocess.Popen(
            [npm_cmd, "start"],
            cwd=str(frontend_sandbox),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        _running_previews[task_id] = {
            "frontend":         npm_proc,
            "frontend_port":    PREVIEW_FRONTEND_PORT,
            "backend_port":     PREVIEW_BACKEND_PORT,
        }
        print(f"[Preview] React starting on port {PREVIEW_FRONTEND_PORT} (PID {npm_proc.pid})")
    except Exception as e:
        stop_sandbox(task_id)
        return {"error": f"Failed to start React preview: {e}"}

    return {
        "previewing":     True,
        "frontend_url":   f"http://localhost:{PREVIEW_FRONTEND_PORT}",
        "backend_url":    f"http://localhost:{PREVIEW_BACKEND_PORT}",
        "files_applied":  applied,
        "message":        f"Preview starting — React takes ~20 seconds to compile. Backend on :{PREVIEW_BACKEND_PORT}, frontend on :{PREVIEW_FRONTEND_PORT}.",
    }


def restore_frontend_preview(task_id: str, project_root: str = None) -> dict:
    """
    Kill the isolated preview processes (ports 3001 + 8001).
    The live app on 3000 + 8000 is completely untouched.
    """
    stopped_frontend = False
    stopped_backend  = False

    if task_id in _running_previews:
        preview = _running_previews.pop(task_id)
        proc = preview.get("frontend")
        if proc:
            try:
                if os.name == "nt":
                    # taskkill /T kills the process tree (npm spawns child node processes)
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                        capture_output=True
                    )
                else:
                    proc.terminate()
                    proc.wait(timeout=5)
                stopped_frontend = True
                print(f"[Preview] Killed React preview (PID {proc.pid})")
            except Exception as e:
                print(f"[Preview] Error killing React: {e}")

    stopped_backend = stop_sandbox(task_id)

    return {
        "restored":          True,
        "stopped_frontend":  stopped_frontend,
        "stopped_backend":   stopped_backend,
        "message":           "Preview stopped. Your live app on localhost:3000 is unchanged.",
    }


def get_preview_status(task_id: str) -> dict:
    """Check if the isolated preview is currently running."""
    if task_id not in _running_previews:
        return {"previewing": False}

    preview = _running_previews[task_id]
    proc    = preview.get("frontend")

    if proc and proc.poll() is None:
        return {
            "previewing":   True,
            "frontend_url": f"http://localhost:{preview['frontend_port']}",
            "backend_url":  f"http://localhost:{preview['backend_port']}",
        }
    else:
        _running_previews.pop(task_id, None)
        return {"previewing": False}


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