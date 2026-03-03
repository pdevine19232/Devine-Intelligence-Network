import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:8000";

const COLORS = {
  bg: "#faf9f6",
  dark: "#1a1a18",
  gold: "#c8a96e",
  green: "#2a7a4a",
  red: "#c0341a",
  blue: "#1a4060",
  muted: "#8a8880",
  border: "#e8e4dc",
  white: "#ffffff",
};

const STATUS_CONFIG = {
  pending:   { label: "PENDING",  color: COLORS.muted,  bg: "#f0ece4" },
  running:   { label: "RUNNING",  color: "#c8692e",     bg: "#fff8f0" },
  review:    { label: "READY",    color: COLORS.green,  bg: "#f0f8f4" },
  approved:  { label: "LIVE",     color: COLORS.blue,   bg: "#f0f4f8" },
  rejected:  { label: "REJECTED", color: COLORS.red,    bg: "#fff4f4" },
  error:     { label: "ERROR",    color: COLORS.red,    bg: "#fff4f4" },
};

const ASSESSMENT_CONFIG = {
  PASS:               { label: "PASS",    color: COLORS.green },
  PASS_WITH_WARNINGS: { label: "PASS ⚠", color: "#c8a96e" },
  FAIL:               { label: "FAIL",   color: COLORS.red },
  ERROR:              { label: "ERROR",  color: COLORS.muted },
  SKIP:               { label: "SKIP",   color: COLORS.muted },
};

// ── Utility ───────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtStep(step) {
  if (!step) return "";
  return step
    .replace(/_/g, " ")
    .replace(/^builder: /, "🔨 ")
    .replace(/^breaker: /, "🔍 ")
    .replace(/^teacher: /, "📖 ");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      fontFamily: "Courier New, monospace",
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: "0.1em",
      padding: "3px 8px",
      borderRadius: 2,
      color: cfg.color,
      background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

function SectionHeader({ label, color = COLORS.gold }) {
  return (
    <div style={{
      fontFamily: "Courier New, monospace",
      fontSize: 9,
      fontWeight: 600,
      letterSpacing: "0.2em",
      color,
      paddingBottom: 10,
      borderBottom: `1px solid ${COLORS.border}`,
      marginBottom: 16,
    }}>
      {label}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 8 }}>
      ⟳
    </span>
  );
}

// ── Delete Task Button ─────────────────────────────────────────────────────────

function DeleteTaskButton({ taskId, onDeleted, token }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this task? This action cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const response = await fetch(`${API}/agents/task/${taskId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to delete task");
      }

      onDeleted();
    } catch (err) {
      alert(`Error deleting task: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      style={{
        background: deleting ? COLORS.muted : "#e74c3c",
        color: COLORS.white,
        border: "none",
        padding: "4px 8px",
        borderRadius: 2,
        fontSize: 11,
        fontFamily: "Courier New, monospace",
        fontWeight: 600,
        cursor: deleting ? "not-allowed" : "pointer",
        opacity: deleting ? 0.6 : 1,
        transition: "all 0.15s",
      }}
      title="Delete this task"
    >
      {deleting ? "..." : "✕"}
    </button>
  );
}

// ── Clear All Tasks Button ────────────────────────────────────────────────────

function ClearAllTasksButton({ onCleared, token, disabled }) {
  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete ALL tasks? This action cannot be undone and will clear all task data and sandbox processes."
    );
    if (!confirmed) return;

    setClearing(true);
    try {
      const response = await fetch(`${API}/agents/tasks`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to clear tasks");
      }

      onCleared();
    } catch (err) {
      alert(`Error clearing tasks: ${err.message}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <button
      onClick={handleClearAll}
      disabled={clearing || disabled}
      style={{
        background: clearing ? COLORS.muted : "#e74c3c",
        color: COLORS.white,
        border: "none",
        padding: "8px 16px",
        borderRadius: 4,
        fontSize: 12,
        fontFamily: "Courier New, monospace",
        fontWeight: 600,
        letterSpacing: "0.1em",
        cursor: clearing || disabled ? "not-allowed" : "pointer",
        opacity: clearing || disabled ? 0.6 : 1,
        transition: "all 0.15s",
      }}
    >
      {clearing ? "CLEARING..." : "CLEAR ALL TASKS"}
    </button>
  );
}

// ── New Task Form ─────────────────────────────────────────────────────────────

function NewTaskForm({ onSubmit, submitting, token }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    border: `1px solid ${COLORS.border}`,
    borderRadius: 4,
    fontSize: 14,
    fontFamily: "inherit",
    background: COLORS.white,
    color: COLORS.dark,
    outline: "none",
    boxSizing: "border-box",
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onSubmit({ title: title.trim(), description: description.trim() });
    setTitle("");
    setDescription("");
  };

  return (
    <form onSubmit={handleSubmit} style={{
      background: COLORS.dark,
      padding: "28px 32px",
      borderRadius: 6,
      marginBottom: 32,
    }}>
      <div style={{ fontFamily: "Courier New, monospace", fontSize: 9, letterSpacing: "0.2em", color: COLORS.gold, marginBottom: 16 }}>
        ASSIGN A TASK TO YOUR AGENTS
      </div>
      <div style={{ color: "#9a9890", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        Describe what you want built. Your agents will work autonomously — Builder codes it, Breaker tests it, Teacher explains it.
        You'll get an email when it's done.
      </div>
      <div style={{ marginBottom: 14 }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title (e.g. 'Add earnings calendar to Dashboard')"
          style={inputStyle}
          required
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Describe in detail what you want built. Be specific — mention which pages, what data sources, what the feature should do, and what it should look like. The more detail the better."
          style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
          required
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !title.trim() || !description.trim()}
        style={{
          background: submitting ? COLORS.muted : COLORS.gold,
          color: COLORS.dark,
          border: "none",
          padding: "12px 28px",
          borderRadius: 4,
          fontFamily: "Courier New, monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.15em",
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "DISPATCHING AGENTS..." : "DISPATCH AGENTS →"}
      </button>
    </form>
  );
}

// ── Task List Item ─────────────────────────────────────────────────────────────

function TaskCard({ task, onSelect, selected, onTaskDeleted, token }) {
  const bReport = task.breaker_report || {};
  const assessment = bReport.overall_assessment;
  const assessCfg = ASSESSMENT_CONFIG[assessment] || {};

  return (
    <div
      style={{
        padding: "16px 20px",
        borderBottom: `1px solid ${COLORS.border}`,
        background: selected ? "#f0f4f8" : COLORS.white,
        borderLeft: selected ? `3px solid ${COLORS.blue}` : "3px solid transparent",
        transition: "all 0.15s",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div
        onClick={() => onSelect(task.id)}
        style={{
          flex: 1,
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.dark, flex: 1, marginRight: 12 }}>
            {task.title}
          </div>
          <StatusBadge status={task.status} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: COLORS.muted }}>
          <span style={{ fontFamily: "Courier New, monospace", fontSize: 10 }}>#{task.id}</span>
          <span>{timeAgo(task.created_at)}</span>
          {task.files_built > 0 && (
            <span style={{ color: COLORS.green }}>📁 {task.files_built} files</span>
          )}
          {assessment && (
            <span style={{ color: assessCfg.color, fontWeight: 600 }}>
              QA: {assessCfg.label}
            </span>
          )}
        </div>

        {task.status === "running" && task.current_step && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#c8692e", fontFamily: "Courier New, monospace" }}>
            <Spinner />
            {fmtStep(task.current_step)}
          </div>
        )}
      </div>

      <div style={{ paddingTop: 4 }}>
        <DeleteTaskButton
          taskId={task.id}
          onDeleted={onTaskDeleted}
          token={token}
        />
      </div>
    </div>
  );
}

// ── Builder Report View ────────────────────────────────────────────────────────

function BuilderPanel({ report }) {
  if (!report) return <div style={{ color: COLORS.muted, fontSize: 13 }}>Builder hasn't run yet.</div>;

  const files = report.files_written || [];

  return (
    <div>
      <p style={{ fontSize: 14, color: COLORS.dark, lineHeight: 1.7, marginBottom: 20 }}>
        {report.plan_summary}
      </p>

      {report.integration_notes && (
        <div style={{ background: "#f0f4f8", padding: 14, borderRadius: 4, marginBottom: 20, fontSize: 13, color: COLORS.dark, lineHeight: 1.6 }}>
          <strong>Integration notes:</strong> {report.integration_notes}
        </div>
      )}

      {/* Files */}
      {files.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: COLORS.dark }}>Files Written:</div>
          <div style={{ background: "#f5f5f5", borderRadius: 4, overflow: "hidden" }}>
            {files.map((f, i) => (
              <div key={i} style={{
                padding: "10px 14px",
                borderBottom: i < files.length - 1 ? `1px solid ${COLORS.border}` : "none",
                fontSize: 12,
                fontFamily: "Courier New, monospace",
                color: COLORS.dark,
              }}>
                {f.path}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Breaker Report View ────────────────────────────────────────────────────────

function BreakerPanel({ report }) {
  if (!report) return <div style={{ color: COLORS.muted, fontSize: 13 }}>Breaker hasn't run yet.</div>;

  const overall = report.overall_assessment || "ERROR";
  const cfg = ASSESSMENT_CONFIG[overall] || {};
  const testResults = report.test_results || [];

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 12, color: COLORS.muted }}>Overall Assessment:</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: cfg.color }}>{cfg.label}</span>
      </div>

      {report.summary && (
        <p style={{ fontSize: 13, color: COLORS.dark, lineHeight: 1.6, marginBottom: 16 }}>
          {report.summary}
        </p>
      )}

      {testResults.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: COLORS.dark }}>Test Results:</div>
          {testResults.map((t, i) => (
            <div key={i} style={{ marginBottom: 10, fontSize: 12 }}>
              <div style={{ fontFamily: "Courier New, monospace", color: COLORS.dark, marginBottom: 3 }}>
                {t.test_name}
              </div>
              <div style={{ color: t.passed ? COLORS.green : COLORS.red }}>
                {t.passed ? "✓ PASSED" : "✗ FAILED"}
              </div>
              {t.failure_reason && (
                <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 3, fontStyle: "italic" }}>
                  {t.failure_reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Teacher Report View ────────────────────────────────────────────────────────

function TeacherPanel({ report }) {
  if (!report) return <div style={{ color: COLORS.muted, fontSize: 13 }}>Teacher hasn't run yet.</div>;

  return (
    <div>
      <div style={{ fontSize: 13, lineHeight: 1.8, color: COLORS.dark, whiteSpace: "pre-wrap" }}>
        {report.documentation}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AgentHub({ token }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(`${API}/agents/tasks`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTasks(Array.isArray(data) ? data : []);
        setSelectedTaskId(null);
      }
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleSubmitTask = async (payload) => {
    setSubmitting(true);
    try {
      const response = await fetch(`${API}/agents/task`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        await fetchTasks();
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail || "Failed to submit task"}`);
      }
    } catch (err) {
      alert(`Error submitting task: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTaskDeleted = () => {
    fetchTasks();
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{
        background: COLORS.dark,
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "20px 32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <div style={{ fontFamily: "Courier New, monospace", fontSize: 10, letterSpacing: "0.2em", color: COLORS.gold, marginBottom: 6 }}>
            AGENT HUB
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.white }}>
            Task Management
          </div>
        </div>
        <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "Courier New, monospace" }}>
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div style={{ padding: "32px", maxWidth: 1400, margin: "0 auto" }}>
        {/* New Task Form */}
        <NewTaskForm
          onSubmit={handleSubmitTask}
          submitting={submitting}
          token={token}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          {/* Task List */}
          <div style={{
            background: COLORS.white,
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}>
            {/* List Header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#fafaf8",
            }}>
              <SectionHeader label="TASKS" color={COLORS.gold} />
              <ClearAllTasksButton
                onCleared={handleTaskDeleted}
                token={token}
                disabled={tasks.length === 0 || loading}
              />
            </div>

            {/* Task Items */}
            <div style={{ flex: 1, overflowY: "auto", maxHeight: 600 }}>
              {loading ? (
                <div style={{ padding: 20, textAlign: "center", color: COLORS.muted }}>
                  <Spinner /> Loading tasks...
                </div>
              ) : tasks.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
                  No tasks yet. Dispatch agents to get started.
                </div>
              ) : (
                tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onSelect={setSelectedTaskId}
                    selected={task.id === selectedTaskId}
                    onTaskDeleted={handleTaskDeleted}
                    token={token}
                  />
                ))
              )}
            </div>
          </div>

          {/* Details Panel */}
          <div style={{
            background: COLORS.white,
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            padding: "20px",
            maxHeight: 600,
            overflowY: "auto",
          }}>
            {!selectedTask ? (
              <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", paddingTop: 40 }}>
                Select a task to view details
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.dark, marginBottom: 6 }}>
                    {selectedTask.title}
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <StatusBadge status={selectedTask.status} />
                    <span style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Courier New, monospace" }}>
                      #{selectedTask.id}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: COLORS.dark, lineHeight: 1.6 }}>
                    {selectedTask.description}
                  </div>
                </div>

                {/* Tabs */}
                {selectedTask.builder_report && (
                  <div style={{ marginBottom: 20 }}>
                    <SectionHeader label="BUILDER REPORT" />
                    <BuilderPanel report={selectedTask.builder_report} />
                  </div>
                )}

                {selectedTask.breaker_report && (
                  <div style={{ marginBottom: 20 }}>
                    <SectionHeader label="BREAKER REPORT" />
                    <BreakerPanel report={selectedTask.breaker_report} />
                  </div>
                )}

                {selectedTask.teacher_report && (
                  <div style={{ marginBottom: 20 }}>
                    <SectionHeader label="TEACHER DOCUMENTATION" />
                    <TeacherPanel report={selectedTask.teacher_report} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}