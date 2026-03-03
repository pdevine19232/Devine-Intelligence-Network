"""
Orchestrator — Coordinates Builder → Breaker → Teacher pipeline.

This is the "brain" that:
  1. Kicks off the full agent pipeline in a background thread
  2. Updates task status at each step (so the UI stays live)
  3. Handles failures gracefully (partial results are saved)
  4. Triggers the sandbox server startup
  5. Sends the final email report

Use run_pipeline(task_id, project_root) to start a task.
"""

import os
import threading
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = os.getenv("PROJECT_ROOT", str(Path(__file__).parent.parent.parent))

# ── Main Pipeline ─────────────────────────────────────────────────────────────

def run_pipeline(task_id: str, project_root: str = None):
    """
    Launch the full Builder → Breaker → Teacher pipeline in a background thread.
    Returns immediately — check task status via task_manager.get_task().

    Args:
        task_id: The task ID (created via task_manager.create_task)
        project_root: Path to your project root. Defaults to PROJECT_ROOT env var.
    """
    root = project_root or PROJECT_ROOT

    thread = threading.Thread(
        target=_run_pipeline_sync,
        args=(task_id, root),
        daemon=True,
        name=f"agent-pipeline-{task_id}"
    )
    thread.start()
    print(f"[Orchestrator] Pipeline started for task {task_id} (thread: {thread.name})")
    return thread


def _run_pipeline_sync(task_id: str, project_root: str):
    """
    Synchronous pipeline execution (runs in a background thread).
    Saves state to the DB at every step.
    """
    from agents.task_manager import update_task, get_task

    def log(msg):
        print(f"[Pipeline:{task_id}] {msg}")

    def set_step(step: str):
        update_task(task_id, current_step=step)
        log(f"Step: {step}")

    # Mark as running
    update_task(
        task_id,
        status="running",
        started_at=datetime.now().isoformat(),
        current_step="starting",
        error=None,
    )

    # ── PHASE 1: BUILDER ──────────────────────────────────────────────────
    builder_report = None
    try:
        set_step("builder_planning")
        from agents.builder_agent import run_builder

        def builder_progress(msg):
            update_task(task_id, current_step=f"builder: {msg[:80]}")

        log("Starting Builder agent...")
        builder_report = run_builder(
            task_id=task_id,
            project_root=project_root,
            on_progress=builder_progress,
        )
        update_task(task_id, builder_report=builder_report, current_step="builder_complete")
        log(f"Builder done. {builder_report.get('files_successful', 0)} files written.")

    except Exception as e:
        import traceback
        error = f"Builder failed: {traceback.format_exc()}"
        log(error)
        update_task(
            task_id,
            status="error",
            error=error,
            current_step="builder_failed",
            completed_at=datetime.now().isoformat(),
        )
        return  # Can't continue without builder output

    # ── PHASE 2: BREAKER ──────────────────────────────────────────────────
    breaker_report = None
    try:
        set_step("breaker_analyzing")
        from agents.breaker_agent import run_breaker

        def breaker_progress(msg):
            update_task(task_id, current_step=f"breaker: {msg[:80]}")

        log("Starting Breaker agent...")
        breaker_report = run_breaker(
            task_id=task_id,
            project_root=project_root,
            on_progress=breaker_progress,
        )
        update_task(task_id, breaker_report=breaker_report, current_step="breaker_complete")
        log(f"Breaker done. Assessment: {breaker_report.get('overall_assessment')}")

    except Exception as e:
        import traceback
        error_msg = f"Breaker failed (non-fatal): {str(e)}"
        log(error_msg)
        # Breaker failure is non-fatal — continue with what we have
        breaker_report = {
            "overall_assessment": "ERROR",
            "summary": f"Breaker agent encountered an error: {str(e)}",
            "findings": [],
            "error": str(e),
        }
        update_task(task_id, breaker_report=breaker_report, current_step="breaker_failed_nonfatal")

    # ── PHASE 3: TEACHER ──────────────────────────────────────────────────
    teacher_report = None
    try:
        set_step("teacher_explaining")
        from agents.teacher_agent import run_teacher

        def teacher_progress(msg):
            update_task(task_id, current_step=f"teacher: {msg[:80]}")

        log("Starting Teacher agent...")
        teacher_report = run_teacher(
            task_id=task_id,
            on_progress=teacher_progress,
        )
        update_task(task_id, teacher_report=teacher_report, current_step="teacher_complete")
        log("Teacher done.")

    except Exception as e:
        import traceback
        log(f"Teacher failed (non-fatal): {e}")
        teacher_report = f"Teacher agent encountered an error: {str(e)}"
        update_task(task_id, teacher_report=teacher_report, current_step="teacher_failed_nonfatal")

    # ── PHASE 4: SANDBOX ──────────────────────────────────────────────────
    try:
        set_step("starting_sandbox")
        from agents.sandbox_manager import start_sandbox

        log("Starting sandbox server on port 8001...")
        sandbox_result = start_sandbox(task_id=task_id, project_root=project_root)
        if sandbox_result.get("pid"):
            update_task(
                task_id,
                sandbox_pid=sandbox_result["pid"],
                sandbox_port=sandbox_result.get("port", 8001),
                current_step="sandbox_running",
            )
            log(f"Sandbox running on port {sandbox_result.get('port', 8001)} (PID {sandbox_result['pid']})")
        else:
            log(f"Sandbox start warning: {sandbox_result.get('error', 'Unknown')}")

    except Exception as e:
        log(f"Sandbox start failed (non-fatal): {e}")
        # Not a blocker — user can still review diffs without sandbox

    # ── PHASE 5: EMAIL REPORT ─────────────────────────────────────────────
    try:
        set_step("sending_email")
        from agents.email_reporter import send_agent_email

        task = get_task(task_id)
        log("Sending email report...")
        send_agent_email(task)
        log("Email sent.")

    except Exception as e:
        log(f"Email failed (non-fatal): {e}")

    # ── COMPLETE ──────────────────────────────────────────────────────────
    update_task(
        task_id,
        status="review",  # Ready for user review
        current_step="awaiting_review",
        completed_at=datetime.now().isoformat(),
    )
    log(f"Pipeline complete. Task {task_id} is ready for review.")


# ── Approval Handler ──────────────────────────────────────────────────────────

def _git_snapshot(root: Path, task_id: str, task_title: str) -> str:
    """
    Commit and push the current project state to GitHub before applying
    agent changes.  This replaces .bak files with a proper git history.

    Returns a short status string for logging.  Never raises — approval
    must proceed even if the snapshot fails.
    """
    import subprocess

    def run(cmd):
        return subprocess.run(
            cmd, cwd=str(root),
            capture_output=True, text=True
        )

    try:
        # Stage everything (agent_workspace/, *.bak, agent_tasks.db are
        # now in .gitignore so they won't be included)
        run(["git", "add", "-A"])

        # Only commit if there is actually something staged
        diff = run(["git", "diff", "--cached", "--quiet"])
        if diff.returncode == 0:
            return "nothing to commit — snapshot skipped"

        msg = f"pre-agent: {task_title} (task {task_id})"
        commit = run(["git", "commit", "-m", msg])
        if commit.returncode != 0:
            return f"commit failed: {commit.stderr.strip()}"

        push = run(["git", "push", "origin", "main"])
        if push.returncode != 0:
            return f"push failed (changes still committed locally): {push.stderr.strip()}"

        return f"snapshot pushed — '{msg}'"

    except Exception as e:
        return f"snapshot error (non-fatal): {e}"


def approve_task(task_id: str, project_root: str = None) -> dict:
    """
    Apply the Builder's changes to the live project.

    Before deploying, commits and pushes the current project state to GitHub
    so you always have a clean rollback point in git history.
    Copies files from agent_workspace/{task_id}/ to the actual project root.
    Returns a dict with what was copied.
    """
    from agents.task_manager import get_task, update_task
    from agents.sandbox_manager import stop_sandbox
    import shutil

    root = Path(project_root or PROJECT_ROOT)
    task = get_task(task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    builder_report = task.get("builder_report") or {}
    if isinstance(builder_report, str):
        import json
        builder_report = json.loads(builder_report)

    workspace_dir = Path(__file__).parent.parent / "agent_workspace" / task_id
    files_written = builder_report.get("files_written", [])

    # ── Snapshot to GitHub before touching any live files ─────────────────
    snapshot_msg = _git_snapshot(root, task_id, task.get("title", "unknown"))
    print(f"[Approve] Git snapshot: {snapshot_msg}")

    deployed = []
    errors = []

    for file_info in files_written:
        if "error" in file_info:
            continue
        path = file_info["path"]
        src = workspace_dir / path
        dest = root / path

        if not src.exists():
            errors.append(f"{path}: source file not found in workspace")
            continue

        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            deployed.append(path)
            print(f"[Approve] Deployed {path}")
        except Exception as e:
            errors.append(f"{path}: {str(e)}")
            print(f"[Approve] Failed to deploy {path}: {e}")

    # Stop sandbox
    try:
        stop_sandbox(task_id)
    except Exception:
        pass

    update_task(
        task_id,
        status="approved",
        current_step="deployed",
    )

    return {
        "deployed": deployed,
        "errors": errors,
        "total": len(deployed),
        "restart_required": any(p.endswith(".py") for p in deployed),
        "message": "Changes applied. Restart the backend server to see Python changes take effect."
        if any(p.endswith(".py") for p in deployed)
        else "Changes applied. Refresh the browser to see frontend changes.",
    }


def reject_task(task_id: str) -> dict:
    """Reject the task — stop sandbox and mark as rejected."""
    from agents.task_manager import update_task
    from agents.sandbox_manager import stop_sandbox

    try:
        stop_sandbox(task_id)
    except Exception:
        pass

    update_task(task_id, status="rejected", current_step="rejected")
    return {"status": "rejected", "task_id": task_id}
