"""
Task Manager — SQLite-backed task queue for the DIN Agent System.
Stores task state, agent reports, and file manifests locally.
"""

import sqlite3
import json
import uuid
import os
import signal
import shutil
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "agent_tasks.db"


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS agent_tasks (
            id              TEXT PRIMARY KEY,
            title           TEXT NOT NULL,
            description     TEXT NOT NULL,
            status          TEXT DEFAULT 'pending',
            created_at      TEXT,
            started_at      TEXT,
            completed_at    TEXT,
            current_step    TEXT,
            builder_report  TEXT,
            breaker_report  TEXT,
            teacher_report  TEXT,
            files_manifest  TEXT,
            sandbox_port    INTEGER DEFAULT 8001,
            sandbox_pid     INTEGER,
            error           TEXT
        )
    """)
    conn.commit()
    conn.close()


def create_task(title: str, description: str) -> dict:
    init_db()
    task_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()

    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO agent_tasks (id, title, description, status, created_at)
        VALUES (?, ?, ?, 'pending', ?)
    """, (task_id, title, description, now))
    conn.commit()
    conn.close()

    return get_task(task_id)


def get_task(task_id: str) -> dict:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT * FROM agent_tasks WHERE id = ?", (task_id,)
    ).fetchone()
    conn.close()

    if not row:
        return None

    task = dict(row)
    for field in ["builder_report", "breaker_report", "files_manifest"]:
        if task.get(field):
            try:
                task[field] = json.loads(task[field])
            except Exception:
                pass
    return task


def get_all_tasks() -> list:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT * FROM agent_tasks ORDER BY created_at DESC"
    ).fetchall()
    conn.close()

    tasks = []
    for row in rows:
        task = dict(row)
        for field in ["builder_report", "breaker_report", "files_manifest"]:
            if task.get(field):
                try:
                    task[field] = json.loads(task[field])
                except Exception:
                    pass
        tasks.append(task)
    return tasks


def update_task(task_id: str, **kwargs):
    init_db()
    # Serialize dicts/lists to JSON
    for key in ["builder_report", "breaker_report", "files_manifest"]:
        if key in kwargs and isinstance(kwargs[key], (dict, list)):
            kwargs[key] = json.dumps(kwargs[key])

    sets = ", ".join(f"{k} = ?" for k in kwargs)
    values = list(kwargs.values()) + [task_id]

    conn = sqlite3.connect(DB_PATH)
    conn.execute(f"UPDATE agent_tasks SET {sets} WHERE id = ?", values)
    conn.commit()
    conn.close()


def _cleanup_sandbox(task_id: str):
    """
    Clean up sandbox process and associated directories for a task.
    """
    try:
        # Get task to retrieve sandbox PID
        task = get_task(task_id)
        if not task:
            return

        # Kill sandbox process if running
        if task.get("sandbox_pid"):
            try:
                pid = task["sandbox_pid"]
                os.kill(pid, signal.SIGTERM)
            except (OSError, ProcessLookupError):
                pass

        # Remove sandbox workspace directory
        sandbox_dir = Path(__file__).parent.parent / f"agent_sandbox_{task_id}"
        if sandbox_dir.exists():
            try:
                shutil.rmtree(sandbox_dir)
            except Exception:
                pass

        # Remove preview directory if it exists
        preview_dir = Path(__file__).parent.parent / f"agent_preview_{task_id}"
        if preview_dir.exists():
            try:
                shutil.rmtree(preview_dir)
            except Exception:
                pass

    except Exception:
        pass


def delete_task(task_id: str) -> dict:
    """
    Delete a single task from the database and clean up associated sandbox resources.
    """
    init_db()

    # Cleanup sandbox and directories first
    _cleanup_sandbox(task_id)

    # Delete from database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("DELETE FROM agent_tasks WHERE id = ?", (task_id,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    return {
        "task_id": task_id,
        "deleted": deleted > 0,
        "message": f"Task {task_id} deleted successfully" if deleted > 0 else f"Task {task_id} not found"
    }


def delete_all_tasks() -> dict:
    """
    Delete all tasks from the database and clean up all associated sandbox resources.
    """
    init_db()

    # Get all tasks first to cleanup their sandboxes
    try:
        all_tasks = get_all_tasks()
        for task in all_tasks:
            _cleanup_sandbox(task["id"])
    except Exception:
        pass

    # Delete all from database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("DELETE FROM agent_tasks")
    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    return {
        "deleted_count": deleted,
        "message": f"Deleted {deleted} tasks and cleaned up all sandbox resources"
    }