"""
Agent Routes — FastAPI endpoints for the DIN Agent System.

Add to main.py:
    from agent_routes import router as agent_router
    app.include_router(agent_router)
"""

import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user, require_admin
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = os.getenv("PROJECT_ROOT", os.path.dirname(os.path.abspath(__file__)))

router = APIRouter(prefix="/agents", tags=["agents"])


# ── Request Models ────────────────────────────────────────────────────────────

class CreateTaskRequest(BaseModel):
    title: str
    description: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/task")
def create_agent_task(
    request: CreateTaskRequest,
    user=Depends(require_admin)
):
    """
    Submit a new task for the agent pipeline.
    Returns immediately — agents run in the background.
    Check status via GET /agents/task/{id}
    """
    try:
        from agents.task_manager import create_task
        from agents.orchestrator import run_pipeline

        task = create_task(
            title=request.title,
            description=request.description,
        )

        # Kick off the pipeline in a background thread
        run_pipeline(task_id=task["id"], project_root=PROJECT_ROOT)

        return {
            "task": task,
            "message": f"Task {task['id']} submitted. Builder, Breaker, and Teacher are working...",
            "status_url": f"/agents/task/{task['id']}",
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks")
def list_agent_tasks(user=Depends(get_current_user)):
    """List all agent tasks, newest first."""
    try:
        from agents.task_manager import get_all_tasks
        tasks = get_all_tasks()

        # Strip heavy content from list view
        light_tasks = []
        for t in tasks:
            light_tasks.append({
                "id": t["id"],
                "title": t["title"],
                "description": t["description"],
                "status": t["status"],
                "current_step": t.get("current_step"),
                "created_at": t["created_at"],
                "started_at": t.get("started_at"),
                "completed_at": t.get("completed_at"),
                "files_built": (t.get("builder_report") or {}).get("files_successful", 0)
                    if isinstance(t.get("builder_report"), dict) else 0,
                "breaker_verdict": (t.get("breaker_report") or {}).get("overall_assessment")
                    if isinstance(t.get("breaker_report"), dict) else None,
                "has_sandbox": bool(t.get("sandbox_pid")),
                "sandbox_port": t.get("sandbox_port", 8001),
            })

        return {"tasks": light_tasks, "count": len(light_tasks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task/{task_id}")
def get_agent_task(task_id: str, user=Depends(get_current_user)):
    """Get full details for a specific task including all agent reports."""
    try:
        from agents.task_manager import get_task
        task = get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return {"task": task}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task/{task_id}/diff")
def get_task_diff(task_id: str, user=Depends(require_admin)):
    """Get file diffs between current project and Builder's workspace."""
    try:
        from agents.sandbox_manager import get_file_diff
        diffs = get_file_diff(task_id=task_id, project_root=PROJECT_ROOT)
        return {"diffs": diffs, "count": len(diffs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/task/{task_id}/approve")
def approve_agent_task(task_id: str, user=Depends(require_admin)):
    """
    Approve the Builder's changes — copy files to the live project.
    Python changes require a server restart to take effect.
    """
    try:
        from agents.task_manager import get_task
        task = get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if task["status"] not in ("review", "completed"):
            raise HTTPException(
                status_code=400,
                detail=f"Task must be in 'review' status to approve. Current: {task['status']}"
            )

        from agents.orchestrator import approve_task
        result = approve_task(task_id=task_id, project_root=PROJECT_ROOT)
        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/task/{task_id}/reject")
def reject_agent_task(task_id: str, user=Depends(require_admin)):
    """Reject the Builder's changes — sandbox is stopped, no files are copied."""
    try:
        from agents.task_manager import get_task
        task = get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        from agents.orchestrator import reject_task
        result = reject_task(task_id=task_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/task/{task_id}/sandbox/start")
def start_sandbox(task_id: str, user=Depends(require_admin)):
    """Manually start the sandbox server for this task."""
    try:
        from agents.sandbox_manager import start_sandbox as _start
        result = _start(task_id=task_id, project_root=PROJECT_ROOT)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/task/{task_id}/sandbox/stop")
def stop_sandbox(task_id: str, user=Depends(require_admin)):
    """Stop the sandbox server for this task."""
    try:
        from agents.sandbox_manager import stop_sandbox as _stop
        stopped = _stop(task_id)
        return {"stopped": stopped, "task_id": task_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task/{task_id}/sandbox/status")
def sandbox_status(task_id: str, user=Depends(get_current_user)):
    """Check if the sandbox server is running."""
    try:
        from agents.sandbox_manager import get_sandbox_status
        return get_sandbox_status(task_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task/{task_id}/preview/status")
def preview_status(task_id: str, user=Depends(get_current_user)):
    """Check if the isolated preview (port 3001) is running for this task."""
    try:
        from agents.sandbox_manager import get_preview_status
        return get_preview_status(task_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/task/{task_id}/preview")
def preview_task(task_id: str, user=Depends(require_admin)):
    """
    Apply Builder's frontend changes to localhost:3000 temporarily.
    User can click around and see the real UI before approving.
    Call /restore-preview to undo.
    """
    try:
        from agents.task_manager import get_task
        task = get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        from agents.sandbox_manager import preview_frontend_changes
        result = preview_frontend_changes(task_id=task_id, project_root=PROJECT_ROOT)

        if result.get("error") and not result.get("previewing"):
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/task/{task_id}/restore-preview")
def restore_task_preview(task_id: str, user=Depends(require_admin)):
    """
    Restore the frontend back to its original state after a preview.
    """
    try:
        from agents.sandbox_manager import restore_frontend_preview
        result = restore_frontend_preview(task_id=task_id, project_root=PROJECT_ROOT)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/task/{task_id}")
def delete_agent_task(task_id: str, user=Depends(require_admin)):
    """Delete a task and its workspace directory."""
    try:
        import shutil
        from pathlib import Path
        from agents.task_manager import delete_task, get_task
        from agents.sandbox_manager import stop_sandbox as _stop

        task = get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # Stop sandbox if running
        _stop(task_id)

        # Delete workspace
        workspace = Path(__file__).parent / "agent_workspace" / task_id
        if workspace.exists():
            shutil.rmtree(workspace)

        delete_task(task_id)
        return {"deleted": True, "task_id": task_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))