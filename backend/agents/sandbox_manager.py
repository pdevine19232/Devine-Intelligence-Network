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
        # Start uvicorn as a subprocess.
        # IMPORTANT: Do NOT use subprocess.PIPE for stdout/stderr without reading it —
        # the pipe buffer fills up (~64 KB) and the subprocess deadlocks.
        log_path = sandbox_dir.parent / "sandbox.log"
        log_file = open(log_path, "w", encoding="utf-8")
        process = subprocess.Popen(
            [
                sys.executable, "-m", "uvicorn",
                f"{main_file}:app",
                "--host", "0.0.0.0",
                "--port", str(actual_port),
            ],
            cwd=str(sandbox_dir),
            stdout=log_file,
            stderr=log_file,
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


def cleanup_sandbox(task_id: str) -> bool:
    """
    Atomically stop the sandbox process and clean up associated resources.
    Does not fail if sandbox is already stopped or doesn't exist.
    
    Returns True if cleanup was successful, False if sandbox doesn't exist.
    """
    try:
        # Stop the sandbox process
        stopped = stop_sandbox(task_id)
        
        # Clean up the sandbox workspace directory
        try:
            workspace_dir = WORKSPACE_ROOT / task_id
            if workspace_dir.exists():
                shutil.rmtree(workspace_dir, onerror=_force_remove)
                print(f"[Sandbox] Cleaned up workspace for task {task_id}")
        except Exception as e:
            print(f"[Sandbox] Warning: Failed to clean workspace for task {task_id}: {e}")
        
        # Clean up preview processes if any exist for this task
        if task_id in _running_previews:
            preview_info = _running_previews.pop(task_id)
            for key, proc in preview_info.items():
                if proc and isinstance(proc, subprocess.Popen):
                    try:
                        proc.terminate()
                        proc.wait(timeout=5)
                    except Exception:
                        try:
                            proc.kill()
                        except Exception:
                            pass
            print(f"[Sandbox] Stopped preview processes for task {task_id}")
        
        return True
    except Exception as e:
        print(f"[Sandbox] Error during cleanup_sandbox for task {task_id}: {e}")
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
            # Process is dead, clean up the tracking
            _running_sandboxes.pop(task_id, None)
            return {
                "running": False,
                "pid": None,
                "port": SANDBOX_PORT,
            }

    return {
        "running": False,
        "pid": None,
        "port": SANDBOX_PORT,
    }


def get_preview_status(task_id: str) -> dict:
    """Check if preview frontend is running."""
    if task_id in _running_previews:
        preview_info = _running_previews[task_id]
        frontend_proc = preview_info.get("frontend")
        if frontend_proc and frontend_proc.poll() is None:
            return {
                "running": True,
                "port": PREVIEW_FRONTEND_PORT,
                "url": f"http://localhost:{PREVIEW_FRONTEND_PORT}",
            }
        else:
            _running_previews.pop(task_id, None)
            return {"running": False}

    return {"running": False}


def get_file_diff(task_id: str, project_root: str) -> list:
    """
    Compare Builder's files against the live project.
    Return list of { "file": str, "type": "added|modified|deleted", "diff": str }
    """
    workspace_dir = WORKSPACE_ROOT / task_id
    root = Path(project_root)

    diffs = []

    # Scan all files in workspace
    for builder_file in workspace_dir.rglob("*"):
        if builder_file.is_dir():
            continue

        rel = builder_file.relative_to(workspace_dir)
        parts = rel.parts

        # Skip meta files
        if parts[0] in ("sandbox", "plan.json", "manifest.json", "teacher_report.md"):
            continue

        # Build target path
        if parts[0] == "backend":
            target_rel = Path(*parts[1:])
            target_path = root / "backend" / target_rel
        else:
            target_path = root / rel

        # Determine type: added, modified, deleted
        if not target_path.exists():
            diff_type = "added"
            diff_text = f"New file:\n{builder_file.read_text(errors='ignore')[:500]}"
        else:
            new_content = builder_file.read_text(errors='ignore')
            old_content = target_path.read_text(errors='ignore')
            if new_content == old_content:
                continue  # No change
            else:
                diff_type = "modified"
                diff_text = f"Modified (first 500 chars):\n{new_content[:500]}"

        diffs.append({
            "file": str(rel),
            "type": diff_type,
            "diff": diff_text,
        })

    return diffs


def preview_frontend_changes(task_id: str, project_root: str = None) -> dict:
    """
    Start a temporary frontend dev server (port 3001) with Builder's changes applied.
    User can test the UI before approving.
    """
    workspace_dir = WORKSPACE_ROOT / task_id
    root = Path(project_root or PROJECT_ROOT)
    frontend_src = root / "frontend"

    if not frontend_src.exists():
        return {"error": "Frontend directory not found"}

    if not workspace_dir.exists():
        return {"error": "No workspace found — run the Builder first"}

    # Stop any existing preview for this task
    restore_preview(task_id)

    try:
        # ── 1. Create isolated frontend copy ──────────────────────────────────
        preview_dir = workspace_dir / "frontend_sandbox"
        if preview_dir.exists():
            shutil.rmtree(preview_dir, onerror=_force_remove)
        preview_dir.mkdir(parents=True, exist_ok=True)

        shutil.copytree(
            frontend_src,
            preview_dir,
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns("node_modules", ".next", "dist", ".git", "*.log")
        )
        print(f"[Preview] Copied frontend to {preview_dir}")

        # ── 2. Link node_modules from original (avoids copying 500 MB) ────────
        original_nm = frontend_src / "node_modules"
        sandbox_nm = preview_dir / "node_modules"
        if original_nm.exists() and not sandbox_nm.exists():
            try:
                _link_dir(original_nm, sandbox_nm)
                print(f"[Preview] Linked node_modules via junction")
            except Exception as e:
                print(f"[Preview] Junction failed ({e}), copying node_modules (slow)...")
                shutil.copytree(original_nm, sandbox_nm)

        # ── 3. Apply Builder's frontend files on top ──────────────────────────
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
                dest = preview_dir / Path(*parts[1:])
            elif parts[0] == "src":
                dest = preview_dir / "src" / Path(*parts[1:])

            if dest:
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(builder_file, dest)
                applied.append(str(rel))
                print(f"[Preview] Applied {rel}")

        # ── 4. Start React on port 3001 ───────────────────────────────────────
        # IMPORTANT: use a log file, NOT subprocess.PIPE.
        # React produces hundreds of KB of compile output. If you pipe it and
        # don't read, the OS pipe buffer fills up and the process deadlocks.
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        npm_log = preview_dir / "preview.log"
        npm_log_file = open(npm_log, "w", encoding="utf-8")

        env = os.environ.copy()
        env["PORT"]    = str(PREVIEW_FRONTEND_PORT)
        env["BROWSER"] = "none"
        env["CI"]      = "true"   # prevents interactive prompts from react-scripts

        npm_proc = subprocess.Popen(
            [npm_cmd, "start"],
            cwd=str(preview_dir),
            env=env,
            stdout=npm_log_file,
            stderr=npm_log_file,
        )
        _running_previews[task_id] = {
            "frontend":      npm_proc,
            "frontend_port": PREVIEW_FRONTEND_PORT,
        }
        print(f"[Preview] React starting on port {PREVIEW_FRONTEND_PORT} (PID {npm_proc.pid})")

        return {
            "previewing":    True,
            "frontend_url":  f"http://localhost:{PREVIEW_FRONTEND_PORT}",
            "files_applied": applied,
            "message":       f"Preview starting — React takes ~20 seconds to compile. Open localhost:{PREVIEW_FRONTEND_PORT} once ready.",
        }

    except Exception as e:
        print(f"[Preview] Failed to start: {e}")
        return {"error": str(e)}


def restore_preview(task_id: str) -> dict:
    """Stop and clean up the preview frontend."""
    if task_id in _running_previews:
        preview_info = _running_previews.pop(task_id)
        frontend_proc = preview_info.get("frontend")
        if frontend_proc:
            try:
                frontend_proc.terminate()
                frontend_proc.wait(timeout=5)
            except Exception:
                try:
                    frontend_proc.kill()
                except Exception:
                    pass

    print(f"[Preview] Restored live frontend (stopped preview)")
    return {"restored": True}