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


def delete_task(task_id: str):
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM agent_tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
