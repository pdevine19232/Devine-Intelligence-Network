"""
Task Manager — SQLite-backed task queue for the DIN Agent System.
Stores task state, agent reports, and file manifests locally.
"""

import sqlite3
import json
import uuid
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


def delete_task(task_id: str) -> dict:
    """
    Delete a single task by ID.
    Returns a dict with deletion status and sandbox_pid if present.
    """
    init_db()
    
    try:
        # First, fetch the task to get sandbox_pid if it exists
        task = get_task(task_id)
        if not task:
            return {
                "success": False,
                "message": "Task not found",
                "task_id": task_id,
                "sandbox_pid": None
            }
        
        sandbox_pid = task.get("sandbox_pid")
        
        # Delete the task from database
        conn = sqlite3.connect(DB_PATH)
        conn.execute("DELETE FROM agent_tasks WHERE id = ?", (task_id,))
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": f"Task {task_id} deleted successfully",
            "task_id": task_id,
            "sandbox_pid": sandbox_pid
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error deleting task: {str(e)}",
            "task_id": task_id,
            "sandbox_pid": None
        }


def delete_all_tasks() -> dict:
    """
    Delete all tasks from the database.
    Returns a dict with deletion count and list of sandbox_pids.
    """
    init_db()
    
    try:
        # Fetch all tasks to collect sandbox_pids
        all_tasks = get_all_tasks()
        sandbox_pids = [t.get("sandbox_pid") for t in all_tasks if t.get("sandbox_pid")]
        count = len(all_tasks)
        
        # Delete all tasks from database
        conn = sqlite3.connect(DB_PATH)
        conn.execute("DELETE FROM agent_tasks")
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "message": f"Deleted {count} task(s) successfully",
            "count": count,
            "sandbox_pids": sandbox_pids
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error deleting all tasks: {str(e)}",
            "count": 0,
            "sandbox_pids": []
        }