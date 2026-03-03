## What changed

- Added DELETE endpoints to remove individual tasks and clear all tasks at once.
- Added "Clear" buttons on each task row and a "Clear All Tasks" button in the task list UI.
- Buttons trigger confirmation dialogs before deletion to prevent accidents.

## How it works

- **backend/agent_routes.py**: Two new DELETE endpoints — one per task ID, one for all tasks. Both require admin auth and call task_manager cleanup functions.
- **backend/agents/task_manager.py**: `delete_task()` terminates sandbox processes, removes task directories, and deletes the database record.
- **frontend/src/pages/AgentHub.js**: Delete buttons render on each task. onClick handlers show confirmation dialog, then POST to DELETE endpoint. UI shows "Clearing..." state while request is in flight.

## Issues to know about

- **Race condition on frontend**: Deleting multiple tasks simultaneously or clicking "Clear All" while a single task delete is pending can leave `deletingTaskId` in an inconsistent state, causing buttons to lock up.
- **Failed deletes don't recover**: If a DELETE request fails (network error, server error), the dialog closes but `deletingTaskId` stays set. User sees "Clearing..." indefinitely with no retry option.
- **Orphaned sandbox processes**: If sandbox cleanup fails in the backend, the exception is silently caught with no logging. Task record gets deleted but processes/directories remain.
- **No limits on bulk delete**: "Clear All" loads and deletes all tasks serially with no pagination, timeout protection, or cancel option. Large task lists may hang or timeout.

## How to test it

1. Create a task, click the delete button on its row, confirm in the dialog. Verify it disappears from the list and GET /agents/tasks no longer returns it.
2. Create 3+ tasks, click "Clear All Tasks" at the top, confirm. Verify all tasks vanish from the UI.
3. As a non-admin user, attempt to call DELETE /agents/tasks/{id}. Verify you get a 403 error.
4. Create a task, delete it, refresh the page. Verify the task does not reappear.