import { useState, useEffect, useCallback } from "react";

const API = "http://localhost:8001";

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

// ── Confirmation Dialog ────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, onConfirm, onCancel, isLoading }) {
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: COLORS.white,
        borderRadius: 6,
        padding: "28px 32px",
        maxWidth: 400,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
      }}>
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          color: COLORS.dark,
          marginBottom: 12,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 14,
          color: COLORS.muted,
          marginBottom: 24,
          lineHeight: 1.6,
        }}>
          {message}
        </div>
        <div style={{
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
        }}>
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: "10px 20px",
              borderRadius: 4,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.white,
              color: COLORS.dark,
              fontSize: 13,
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: "10px 20px",
              borderRadius: 4,
              border: "none",
              background: isLoading ? COLORS.muted : COLORS.red,
              color: COLORS.white,
              fontSize: 13,
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {isLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Task Form ─────────────────────────────────────────────────────────────

function NewTaskForm({ onSubmit, submitting }) {
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

function TaskCard({ task, onSelect, selected, onDelete, deleting }) {
  const bReport = task.breaker_report || {};
  const assessment = bReport.overall_assessment;
  const assessCfg = ASSESSMENT_CONFIG[assessment] || {};

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete(task.id, task.title);
  };

  return (
    <div
      onClick={() => onSelect(task.id)}
      style={{
        padding: "16px 20px",
        borderBottom: `1px solid ${COLORS.border}`,
        cursor: "pointer",
        background: selected ? "#f0f4f8" : COLORS.white,
        borderLeft: selected ? `3px solid ${COLORS.blue}` : "3px solid transparent",
        transition: "all 0.15s",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}
    >
      <div style={{ flex: 1 }}>
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

      <button
        onClick={handleDeleteClick}
        disabled={deleting}
        style={{
          background: deleting ? COLORS.muted : COLORS.red,
          color: COLORS.white,
          border: "none",
          padding: "6px 12px",
          borderRadius: 3,
          fontSize: 11,
          fontWeight: 600,
          cursor: deleting ? "not-allowed" : "pointer",
          marginLeft: 12,
          whiteSpace: "nowrap",
          opacity: deleting ? 0.6 : 1,
        }}
      >
        {deleting ? "Clearing..." : "Clear"}
      </button>
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
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.dark, marginBottom: 10 }}>FILES WRITTEN:</div>
          <div style={{ background: "#f5f3f0", padding: 12, borderRadius: 4, fontSize: 12, color: COLORS.dark, fontFamily: "Courier New, monospace", lineHeight: 1.8 }}>
            {files.map((f, i) => <div key={i}>• {f}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Breaker Report View ────────────────────────────────────────────────────────

function BreakerPanel({ report }) {
  if (!report) return <div style={{ color: COLORS.muted, fontSize: 13 }}>Breaker hasn't run yet.</div>;

  const assessment = report.overall_assessment;
  const assessCfg = ASSESSMENT_CONFIG[assessment] || {};

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>OVERALL ASSESSMENT</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: assessCfg.color }}>
          {assessCfg.label}
        </div>
      </div>

      {report.summary && (
        <p style={{ fontSize: 13, color: COLORS.dark, lineHeight: 1.7, marginBottom: 20 }}>
          {report.summary}
        </p>
      )}

      {report.test_results && report.test_results.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.dark, marginBottom: 10 }}>TEST RESULTS:</div>
          <div style={{ fontSize: 12, color: COLORS.dark, lineHeight: 1.8 }}>
            {report.test_results.map((test, i) => {
              const icon = test.passed ? "✓" : "✗";
              const color = test.passed ? COLORS.green : COLORS.red;
              return (
                <div key={i} style={{ marginBottom: 8, paddingLeft: 16 }}>
                  <span style={{ color }}>{icon}</span> {test.description}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {report.issues && report.issues.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.dark, marginBottom: 10 }}>ISSUES:</div>
          <div style={{ fontSize: 12, color: COLORS.dark, lineHeight: 1.8 }}>
            {report.issues.map((issue, i) => (
              <div key={i} style={{ marginBottom: 8, paddingLeft: 16 }}>
                ⚠ {issue}
              </div>
            ))}
          </div>
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
      {report.explanation && (
        <p style={{ fontSize: 13, color: COLORS.dark, lineHeight: 1.7, marginBottom: 20 }}>
          {report.explanation}
        </p>
      )}

      {report.best_practices && report.best_practices.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.dark, marginBottom: 10 }}>BEST PRACTICES:</div>
          <div style={{ fontSize: 12, color: COLORS.dark, lineHeight: 1.8 }}>
            {report.best_practices.map((practice, i) => (
              <div key={i} style={{ marginBottom: 8, paddingLeft: 16 }}>
                💡 {practice}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.learning_resources && report.learning_resources.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.dark, marginBottom: 10 }}>LEARNING RESOURCES:</div>
          <div style={{ fontSize: 12, color: COLORS.dark, lineHeight: 1.8 }}>
            {report.learning_resources.map((resource, i) => (
              <div key={i} style={{ marginBottom: 8, paddingLeft: 16 }}>
                📚 {resource}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AgentHub({ token }) {
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API}/agents/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
      if (selectedTaskId && !data.tasks.find(t => t.id === selectedTaskId)) {
        setSelectedTaskId(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, selectedTaskId]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  // Submit new task
  const handleNewTask = async (taskData) => {
    try {
      setSubmitting(true);
      setError("");
      const res = await fetch(`${API}/agents/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(taskData),
      });
      if (!res.ok) throw new Error("Failed to create task");
      await fetchTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete individual task
  const handleDeleteTask = (taskId, taskTitle) => {
    setConfirmData({ taskId, taskTitle, isAllTasks: false });
    setShowConfirmDialog(true);
  };

  // Delete all tasks
  const handleClearAllTasks = () => {
    setConfirmData({ isAllTasks: true });
    setShowConfirmDialog(true);
  };

  // Confirm deletion
  const confirmDelete = async () => {
    try {
      if (confirmData.isAllTasks) {
        setDeletingTaskId("all");
        const res = await fetch(`${API}/agents/tasks`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to clear all tasks");
      } else {
        setDeletingTaskId(confirmData.taskId);
        const res = await fetch(`${API}/agents/task/${confirmData.taskId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to delete task");
      }
      setShowConfirmDialog(false);
      setConfirmData(null);
      await fetchTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingTaskId(null);
    }
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, padding: "40px 60px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: COLORS.dark, margin: "0 0 8px 0", fontFamily: "Courier New, monospace" }}>
          AGENT HUB
        </h1>
        <p style={{ fontSize: 14, color: COLORS.muted, margin: 0 }}>
          Dispatch your builder, breaker, and teacher agents to create, test, and document features.
        </p>
      </div>

      {/* New Task Form */}
      <NewTaskForm onSubmit={handleNewTask} submitting={submitting} />

      {/* Error Message */}
      {error && (
        <div style={{
          background: "#fff4f4",
          border: `1px solid ${COLORS.red}`,
          borderRadius: 4,
          padding: "12px 16px",
          marginBottom: 20,
          fontSize: 13,
          color: COLORS.red,
        }}>
          {error}
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: "flex", gap: 32 }}>
        {/* Task List */}
        <div style={{ flex: "0 0 380px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <SectionHeader label="TASKS" />
            {tasks.length > 0 && (
              <button
                onClick={handleClearAllTasks}
                disabled={deletingTaskId !== null}
                style={{
                  background: deletingTaskId !== null ? COLORS.muted : COLORS.red,
                  color: COLORS.white,
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: deletingTaskId !== null ? "not-allowed" : "pointer",
                  opacity: deletingTaskId !== null ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {deletingTaskId === "all" ? "Clearing..." : "Clear All"}
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ color: COLORS.muted, fontSize: 13, padding: "20px", textAlign: "center" }}>
              <Spinner />
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ color: COLORS.muted, fontSize: 13, padding: "20px", textAlign: "center" }}>
              No tasks yet. Dispatch your agents above.
            </div>
          ) : (
            <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 4, overflow: "hidden" }}>
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSelect={setSelectedTaskId}
                  selected={selectedTask?.id === task.id}
                  onDelete={handleDeleteTask}
                  deleting={deletingTaskId === task.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail View */}
        <div style={{ flex: 1 }}>
          {selectedTask ? (
            <div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: COLORS.dark, margin: 0 }}>
                    {selectedTask.title}
                  </h2>
                  <StatusBadge status={selectedTask.status} />
                </div>
                <p style={{ fontSize: 13, color: COLORS.muted, margin: "0 0 12px 0", lineHeight: 1.6 }}>
                  {selectedTask.description}
                </p>
                <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "Courier New, monospace" }}>
                  Task #{selectedTask.id} • Created {timeAgo(selectedTask.created_at)}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 24 }}>
                {["builder", "breaker", "teacher"].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSelectedTaskId(selectedTask.id)} // Keep same task, just for demo
                    style={{
                      padding: "12px 16px",
                      borderBottom: `2px solid ${COLORS.gold}`,
                      background: "transparent",
                      border: "none",
                      color: COLORS.dark,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {tab === "builder" && "🔨 Builder"}
                    {tab === "breaker" && "🔍 Breaker"}
                    {tab === "teacher" && "📖 Teacher"}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div>
                <BuilderPanel report={selectedTask.builder_report} />
                {selectedTask.status !== "running" && selectedTask.status !== "pending" && (
                  <>
                    <hr style={{ border: "none", borderTop: `1px solid ${COLORS.border}`, margin: "24px 0" }} />
                    <BreakerPanel report={selectedTask.breaker_report} />
                    <hr style={{ border: "none", borderTop: `1px solid ${COLORS.border}`, margin: "24px 0" }} />
                    <TeacherPanel report={selectedTask.teacher_report} />
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ color: COLORS.muted, fontSize: 14, textAlign: "center", paddingTop: 40 }}>
              Select a task to view details
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && confirmData && (
        <ConfirmDialog
          title={confirmData.isAllTasks ? "Clear All Tasks?" : "Clear This Task?"}
          message={
            confirmData.isAllTasks
              ? "This will permanently delete all tasks and their associated data. This action cannot be undone."
              : `This will permanently delete "${confirmData.taskTitle}" and its associated data. This action cannot be undone.`
          }
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowConfirmDialog(false);
            setConfirmData(null);
          }}
          isLoading={deletingTaskId !== null}
        />
      )}
    </div>
  );
}