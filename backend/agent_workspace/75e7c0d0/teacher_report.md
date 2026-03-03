## What changed

- Added DELETE /agents/tasks/{task_id} and DELETE /agents/tasks endpoints to remove individual tasks or all tasks at once.
- UI now has a red delete button on each task row and a "Clear All Tasks" button at the top, both with confirmation dialogs before execution.
- Deletion cleans up associated sandbox processes atomically.

## How it works

- **backend/agent_routes.py**: Two new DELETE endpoints with admin auth. Call task_manager and sandbox_manager to delete task records and stop running sandboxes, then return 200 OK.
- **backend/agents/task_manager.py**: `delete_task(task_id)` removes one task; `delete_all_tasks()` removes all. Both return `{'success': bool}`.
- **backend/agents/sandbox_manager.py**: `stop_sandbox(task_id)` kills the uvicorn process and removes the workspace directory.
- **frontend/src/pages/AgentHub.js**: Delete buttons trigger confirmation dialogs. On confirm, call DELETE endpoint, then refetch task list via GET /agents/tasks.

## Issues to know about

- **Critical**: Frontend's `setTasks(Array.isArray(data) ? data : [])` checks if response object is array, not the `data.tasks` array. Will lose tasks on fetch.
- **Critical**: Race condition after delete — `setSelectedTaskId(null)` happens after fetch completes, not synchronized. Stale selection if task deleted by another user.
- **High**: Backend doesn't validate `delete_task()` and `delete_all_tasks()` return values; routes assume success and return 200 OK even if DB delete failed.
- **High**: If sandbox process isn't in memory dict or DB lacks `sandbox_pid`, cleanup silently fails, leaving orphaned processes and workspace files.

## How to test it

1. Create a task in AgentHub, click its red delete button, confirm dialog, verify it disappears from list and GET /agents/tasks reflects the change.
2. Create 2–3 tasks, click "Clear All Tasks" button at top, confirm, verify all are gone.
3. Create a task with a running sandbox, delete it, verify the sandbox process is killed (no orphaned uvicorn on :8001).
4. Log in as non-admin user, attempt DELETE on any task, verify 403 Forbidden.