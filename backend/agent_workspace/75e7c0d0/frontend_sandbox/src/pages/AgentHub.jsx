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

function TaskCard({ task, onSelect, selected }) {
  const bReport = task.breaker_report || {};
  const assessment = bReport.overall_assessment;
  const assessCfg = ASSESSMENT_CONFIG[assessment] || {};

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
      <div style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 4, marginBottom: 20 }}>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`, fontFamily: "Courier New, monospace", fontSize: 9, color: COLORS.muted, letterSpacing: "0.1em" }}>
          FILES ({files.length})
        </div>
        {files.map((f, i) => (
          <div key={i} style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 16px",
            borderBottom: i < files.length - 1 ? `1px solid ${COLORS.border}` : "none",
            gap: 12,
          }}>
            <span style={{
              fontFamily: "Courier New, monospace",
              fontSize: 9,
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: 2,
              color: f.error ? COLORS.red : f.action === "create" ? COLORS.green : COLORS.blue,
              background: f.error ? "#fff4f4" : f.action === "create" ? "#f0f8f4" : "#f0f4f8",
              minWidth: 52,
              textAlign: "center",
            }}>
              {f.error ? "ERROR" : (f.action || "create").toUpperCase()}
            </span>
            <span style={{ fontSize: 13, color: COLORS.dark, fontFamily: "Courier New, monospace", flex: 1 }}>{f.path}</span>
            {f.lines && <span style={{ fontSize: 11, color: COLORS.muted }}>{f.lines} lines</span>}
            {f.error && <span style={{ fontSize: 11, color: COLORS.red }}>⚠ {f.error}</span>}
          </div>
        ))}
      </div>

      {/* Testing instructions */}
      {report.testing_instructions && (
        <div>
          <div style={{ fontFamily: "Courier New, monospace", fontSize: 9, color: COLORS.muted, letterSpacing: "0.1em", marginBottom: 10 }}>
            HOW TO TEST
          </div>
          <div style={{ fontSize: 13, color: COLORS.dark, lineHeight: 1.8, whiteSpace: "pre-line" }}>
            {report.testing_instructions}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Breaker Report View ────────────────────────────────────────────────────────

function BreakerPanel({ report }) {
  if (!report) return <div style={{ color: COLORS.muted, fontSize: 13 }}>Breaker hasn't run yet.</div>;

  const findings = report.findings || [];
  const assessment = report.overall_assessment;
  const assessCfg = ASSESSMENT_CONFIG[assessment] || {};

  const sevColors = {
    critical: COLORS.red,
    high: "#c8692e",
    medium: "#c8a96e",
    low: COLORS.green,
  };

  const scores = [
    { label: "Security", value: report.security_score },
    { label: "Reliability", value: report.reliability_score },
    { label: "Integration", value: report.integration_score },
  ].filter(s => s.value != null);

  return (
    <div>
      {/* Verdict banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 20px",
        background: assessCfg.color === COLORS.green ? "#f0f8f4" : assessCfg.color === COLORS.red ? "#fff4f4" : "#fff8f0",
        borderRadius: 4,
        marginBottom: 20,
        borderLeft: `4px solid ${assessCfg.color || COLORS.muted}`,
      }}>
        <div style={{ fontFamily: "Courier New, monospace", fontSize: 18, fontWeight: 700, color: assessCfg.color }}>
          {assessCfg.label}
        </div>
        <div style={{ fontSize: 14, color: COLORS.dark, lineHeight: 1.6 }}>{report.summary}</div>
      </div>

      {/* Scores */}
      {scores.length > 0 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          {scores.map(s => (
            <div key={s.label} style={{ flex: 1, background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "12px 16px", textAlign: "center" }}>
              <div style={{ fontFamily: "Courier New, monospace", fontSize: 22, fontWeight: 700, color: s.value >= 7 ? COLORS.green : s.value >= 5 ? "#c8a96e" : COLORS.red }}>
                {s.value}/10
              </div>
              <div style={{ fontFamily: "Courier New, monospace", fontSize: 9, color: COLORS.muted, letterSpacing: "0.1em", marginTop: 4 }}>
                {s.label.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Blockers */}
      {(report.blockers || []).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "Courier New, monospace", fontSize: 9, color: COLORS.red, letterSpacing: "0.1em", marginBottom: 8 }}>
            BLOCKERS — MUST FIX BEFORE GOING LIVE
          </div>
          {report.blockers.map((b, i) => (
            <div key={i} style={{ padding: "10px 14px", background: "#fff4f4", borderLeft: `3px solid ${COLORS.red}`, marginBottom: 8, fontSize: 13, color: COLORS.dark }}>
              ⚠ {b}
            </div>
          ))}
        </div>
      )}

      {/* Findings */}
      {findings.length === 0 ? (
        <div style={{ padding: "20px", textAlign: "center", color: COLORS.green, fontSize: 14 }}>
          ✓ No significant issues found
        </div>
      ) : (
        <div>
          <div style={{ fontFamily: "Courier New, monospace", fontSize: 9, color: COLORS.muted, letterSpacing: "0.1em", marginBottom: 12 }}>
            FINDINGS ({findings.length})
          </div>
          {findings.map((f, i) => {
            const color = sevColors[f.severity] || COLORS.muted;
            return (
              <div key={i} style={{
                marginBottom: 12,
                padding: 14,
                background: COLORS.white,
                borderLeft: `3px solid ${color}`,
                borderRadius: "0 4px 4px 0",
                border: `1px solid ${COLORS.border}`,
                borderLeftColor: color,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: "Courier New, monospace", fontSize: 9, fontWeight: 700, color, textTransform: "uppercase" }}>
                    {f.severity}
                  </span>
                  <span style={{ fontFamily: "Courier New, monospace", fontSize: 10, color: COLORS.muted }}>
                    {f.file}{f.line_hint ? ` · ${f.line_hint}` : ""}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.dark, marginBottom: 6, fontWeight: 500 }}>{f.issue}</div>
                {f.impact && <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>Impact: {f.impact}</div>}
                {f.fix && (
                  <div style={{ fontSize: 12, color: "#4a5a8a", background: "#f4f6fc", padding: "8px 12px", borderRadius: 3, fontFamily: "Courier New, monospace" }}>
                    Fix: {f.fix}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Teacher Report View ────────────────────────────────────────────────────────

function TeacherPanel({ report }) {
  if (!report) return <div style={{ color: COLORS.muted, fontSize: 13 }}>Teacher hasn't run yet.</div>;

  // Render markdown-ish text
  const lines = report.split("\n");
  return (
    <div style={{ lineHeight: 1.8 }}>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return (
          <div key={i} style={{ fontFamily: "Courier New, monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "#4a7a8a", textTransform: "uppercase", marginTop: 24, marginBottom: 10 }}>
            {line.slice(3)}
          </div>
        );
        if (line.startsWith("# ")) return (
          <div key={i} style={{ fontSize: 18, fontWeight: 600, color: COLORS.dark, marginTop: 24, marginBottom: 12 }}>
            {line.slice(2)}
          </div>
        );
        if (line.startsWith("- ") || line.startsWith("* ")) return (
          <div key={i} style={{ fontSize: 14, color: COLORS.dark, paddingLeft: 20, marginBottom: 8, position: "relative" }}>
            <span style={{ position: "absolute", left: 6, color: COLORS.gold }}>•</span>
            {line.slice(2)}
          </div>
        );
        if (line.startsWith("**") && line.endsWith("**")) return (
          <div key={i} style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark, marginTop: 16, marginBottom: 6 }}>
            {line.slice(2, -2)}
          </div>
        );
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
        return (
          <p key={i} style={{ fontSize: 14, color: "#3a3830", margin: "0 0 10px 0", lineHeight: 1.8 }}>
            {line}
          </p>
        );
      })}
    </div>
  );
}

// ── Diff Viewer ───────────────────────────────────────────────────────────────

function DiffPanel({ taskId, token }) {
  const [diffs, setDiffs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);

  const loadDiffs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/agents/task/${taskId}/diff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDiffs(data.diffs || []);
    } catch (e) {
      console.error("Diff load error:", e);
    } finally {
      setLoading(false);
    }
  }, [taskId, token]);

  useEffect(() => { loadDiffs(); }, [loadDiffs]);

  if (loading) return <div style={{ color: COLORS.muted, fontSize: 13 }}>Loading diffs...</div>;
  if (!diffs) return null;
  if (diffs.length === 0) return <div style={{ color: COLORS.muted, fontSize: 13 }}>No file changes found.</div>;

  const selectedDiff = diffs[selected];

  return (
    <div style={{ display: "flex", gap: 16, height: 500 }}>
      {/* File list */}
      <div style={{ width: 220, border: `1px solid ${COLORS.border}`, borderRadius: 4, overflow: "auto" }}>
        {diffs.map((d, i) => (
          <div
            key={i}
            onClick={() => setSelected(i)}
            style={{
              padding: "10px 12px",
              cursor: "pointer",
              background: selected === i ? "#f0f4f8" : COLORS.white,
              borderBottom: `1px solid ${COLORS.border}`,
              borderLeft: selected === i ? `3px solid ${COLORS.blue}` : "3px solid transparent",
            }}
          >
            <div style={{ fontSize: 11, fontFamily: "Courier New, monospace", color: COLORS.dark, wordBreak: "break-all" }}>
              {d.path.split("/").pop()}
            </div>
            <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 3 }}>
              <span style={{ color: d.action === "create" ? COLORS.green : COLORS.blue }}>
                {d.action === "create" ? "NEW" : "MOD"}
              </span>
              {" "}
              <span style={{ color: COLORS.green }}>+{d.additions}</span>
              {" "}
              <span style={{ color: COLORS.red }}>-{d.deletions}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Diff content */}
      <div style={{ flex: 1, border: `1px solid ${COLORS.border}`, borderRadius: 4, overflow: "auto" }}>
        <div style={{ padding: "8px 14px", borderBottom: `1px solid ${COLORS.border}`, fontFamily: "Courier New, monospace", fontSize: 11, color: COLORS.muted }}>
          {selectedDiff.path}
        </div>
        <pre style={{
          margin: 0,
          padding: 16,
          fontSize: 12,
          fontFamily: "Courier New, monospace",
          lineHeight: 1.6,
          color: COLORS.dark,
          background: "#fafaf8",
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}>
          {selectedDiff.new_content || ""}
        </pre>
      </div>
    </div>
  );
}

// ── Task Detail ───────────────────────────────────────────────────────────────

function TaskDetail({ taskId, token, onClose, onApprove, onReject }) {
  const [task, setTask] = useState(null);
  const [tab, setTab] = useState("builder");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionResult, setActionResult] = useState(null);
  const [previewStatus, setPreviewStatus] = useState(null);  // null | {previewing, frontend_url}
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/agents/task/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTask(data.task);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [taskId, token]);

  useEffect(() => {
    load();
    // Poll while running
    const interval = setInterval(() => {
      if (task?.status === "running") load();
    }, 5000);
    return () => clearInterval(interval);
  }, [load, task?.status]);

  const handleStartPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API}/agents/task/${taskId}/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.previewing) {
        setPreviewStatus(data);
      } else {
        setPreviewStatus({ previewing: false, error: data.error || data.detail || "Preview failed to start" });
      }
    } catch (e) {
      setPreviewStatus({ previewing: false, error: e.message });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleStopPreview = async () => {
    setPreviewLoading(true);
    try {
      await fetch(`${API}/agents/task/${taskId}/restore-preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setPreviewStatus({ previewing: false });
    } catch (e) {
      console.error(e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm("Apply all Builder changes to your live project? Python changes will need a server restart.")) return;
    setActionLoading("approve");
    try {
      const res = await fetch(`${API}/agents/task/${taskId}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setActionResult({ type: "success", ...data });
      onApprove && onApprove(taskId);
      load();
    } catch (e) {
      setActionResult({ type: "error", message: e.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!window.confirm("Reject these changes? The sandbox will be stopped and no files will be modified.")) return;
    setActionLoading("reject");
    try {
      await fetch(`${API}/agents/task/${taskId}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      onReject && onReject(taskId);
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div style={{ padding: 40, color: COLORS.muted }}>Loading...</div>;
  if (!task) return <div style={{ padding: 40, color: COLORS.red }}>Task not found.</div>;

  const builderReport = task.builder_report || {};
  const breakerReport = task.breaker_report || {};
  const sandboxPort = task.sandbox_port || 8001;
  const canReview = task.status === "review";
  const isRunning = task.status === "running";

  const TABS = [
    { id: "builder", label: "🔨 BUILDER" },
    { id: "breaker", label: "🔍 BREAKER" },
    { id: "teacher", label: "📖 TEACHER" },
    { id: "diff",    label: "< > DIFF" },
  ];

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%" }}>
      {/* Header */}
      <div style={{ background: COLORS.dark, padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: "Courier New, monospace", fontSize: 9, color: "#4a4840", letterSpacing: "0.15em", marginBottom: 6 }}>
            TASK #{task.id}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.white, marginBottom: 6 }}>
            {task.title}
          </div>
          <StatusBadge status={task.status} />
          {isRunning && task.current_step && (
            <div style={{ marginTop: 8, fontFamily: "Courier New, monospace", fontSize: 11, color: "#c8692e" }}>
              <Spinner />{fmtStep(task.current_step)}
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 20, cursor: "pointer" }}>×</button>
      </div>

      {/* Preview bar */}
      {canReview && (
        <>
          <div style={{
            background: COLORS.blue,
            padding: "12px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
          }}>
            <div style={{ fontSize: 13, color: "#c8d8e8", flex: 1 }}>
              {previewStatus?.previewing ? (
                <>
                  Preview running on{" "}
                  <a href={previewStatus.frontend_url} target="_blank" rel="noreferrer"
                    style={{ color: COLORS.gold, fontFamily: "Courier New, monospace" }}>
                    {previewStatus.frontend_url}
                  </a>
                  {" "}— test your changes, then approve or reject below
                </>
              ) : (
                "Test in an isolated preview (port 3001) before making changes live"
              )}
              {previewStatus?.error && (
                <span style={{ color: "#ff9980", marginLeft: 12 }}>⚠ {previewStatus.error}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              {previewStatus?.previewing ? (
                <>
                  <a
                    href={previewStatus.frontend_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: COLORS.gold,
                      color: COLORS.dark,
                      padding: "8px 16px",
                      borderRadius: 3,
                      fontFamily: "Courier New, monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textDecoration: "none",
                    }}
                  >
                    OPEN PREVIEW →
                  </a>
                  <button
                    onClick={handleStopPreview}
                    disabled={previewLoading}
                    style={{
                      background: "none",
                      color: "#ff9980",
                      border: "1px solid #ff9980",
                      padding: "8px 16px",
                      borderRadius: 3,
                      fontFamily: "Courier New, monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      cursor: previewLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    ■ STOP PREVIEW
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStartPreview}
                  disabled={previewLoading}
                  style={{
                    background: previewLoading ? COLORS.muted : COLORS.gold,
                    color: COLORS.dark,
                    border: "none",
                    padding: "8px 20px",
                    borderRadius: 3,
                    fontFamily: "Courier New, monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    cursor: previewLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {previewLoading ? "STARTING..." : "▶ START PREVIEW"}
                </button>
              )}
            </div>
          </div>
          {previewStatus?.previewing && (
            <div style={{
              background: "#1a3550",
              padding: "6px 28px",
              fontSize: 11,
              color: "#4a7a9a",
              fontFamily: "Courier New, monospace",
            }}>
              ⏱ React takes ~20 sec to compile. Backend: localhost:8001 · Frontend: localhost:3001 · Live app unchanged: localhost:3000
            </div>
          )}
        </>
      )}

      {/* Action result */}
      {actionResult && (
        <div style={{
          padding: "14px 28px",
          background: actionResult.type === "success" ? "#f0f8f4" : "#fff4f4",
          borderBottom: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ fontSize: 14, color: actionResult.type === "success" ? COLORS.green : COLORS.red }}>
            {actionResult.type === "success"
              ? `✓ ${actionResult.total} files deployed. ${actionResult.message}`
              : `✗ ${actionResult.message}`}
          </div>
          {actionResult.deployed?.length > 0 && (
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4, fontFamily: "Courier New, monospace" }}>
              {actionResult.deployed.join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.white, padding: "0 28px", display: "flex", gap: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "14px 20px",
              border: "none",
              borderBottom: tab === t.id ? `2px solid ${COLORS.dark}` : "2px solid transparent",
              background: "none",
              fontFamily: "Courier New, monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: tab === t.id ? COLORS.dark : COLORS.muted,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ padding: 28 }}>
        {tab === "builder" && <BuilderPanel report={builderReport} />}
        {tab === "breaker" && <BreakerPanel report={breakerReport} />}
        {tab === "teacher" && <TeacherPanel report={task.teacher_report} />}
        {tab === "diff" && <DiffPanel taskId={task.id} token={token} />}
      </div>

      {/* Approve / Reject */}
      {canReview && !(actionResult?.type === "success") && (
        <div style={{
          position: "sticky",
          bottom: 0,
          background: COLORS.white,
          borderTop: `1px solid ${COLORS.border}`,
          padding: "16px 28px",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}>
          <button
            onClick={handleApprove}
            disabled={!!actionLoading}
            style={{
              background: COLORS.green,
              color: COLORS.white,
              border: "none",
              padding: "12px 24px",
              borderRadius: 4,
              fontFamily: "Courier New, monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              cursor: actionLoading ? "not-allowed" : "pointer",
              opacity: actionLoading ? 0.7 : 1,
            }}
          >
            {actionLoading === "approve" ? "APPLYING..." : "✓ APPROVE & GO LIVE"}
          </button>
          <button
            onClick={handleReject}
            disabled={!!actionLoading}
            style={{
              background: "none",
              color: COLORS.red,
              border: `1px solid ${COLORS.red}`,
              padding: "12px 24px",
              borderRadius: 4,
              fontFamily: "Courier New, monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              cursor: actionLoading ? "not-allowed" : "pointer",
            }}
          >
            {actionLoading === "reject" ? "REJECTING..." : "✗ REJECT"}
          </button>
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            Approve copies files to your live project. Reject discards everything.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AgentHub({ token }) {
  const [tasks, setTasks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API}/agents/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (e) {
      console.error("Failed to load tasks:", e);
    }
  }, [token]);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 8000); // Poll every 8s
    return () => clearInterval(interval);
  }, [loadTasks]);

  const handleSubmit = async ({ title, description }) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/agents/task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to create task");
      }
      const data = await res.json();
      await loadTasks();
      setSelectedId(data.task.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const runningCount = tasks.filter(t => t.status === "running").length;
  const reviewCount = tasks.filter(t => t.status === "review").length;

  // Split layout when a task is selected
  const showDetail = !!selectedId;

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Page header */}
      <div style={{ background: COLORS.dark, padding: "24px 36px", marginBottom: 0 }}>
        <div style={{ fontFamily: "Courier New, monospace", fontSize: 9, color: "#4a4840", letterSpacing: "0.2em", marginBottom: 6 }}>
          DEVINE INTELLIGENCE NETWORK
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: COLORS.white }}>Agent Hub</div>
          <div style={{ display: "flex", gap: 20 }}>
            {runningCount > 0 && (
              <div style={{ fontFamily: "Courier New, monospace", fontSize: 11, color: "#c8692e" }}>
                <Spinner />{runningCount} RUNNING
              </div>
            )}
            {reviewCount > 0 && (
              <div style={{ fontFamily: "Courier New, monospace", fontSize: 11, color: COLORS.green, fontWeight: 700 }}>
                ● {reviewCount} READY FOR REVIEW
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 89px)" }}>

        {/* Left panel */}
        <div style={{
          width: showDetail ? 340 : "100%",
          maxWidth: showDetail ? 340 : "100%",
          borderRight: showDetail ? `1px solid ${COLORS.border}` : "none",
          overflowY: "auto",
          transition: "all 0.2s",
          flexShrink: 0,
        }}>
          <div style={{ padding: "24px 24px 0 24px" }}>
            <NewTaskForm onSubmit={handleSubmit} submitting={submitting} />
            {error && (
              <div style={{ color: COLORS.red, fontSize: 13, marginBottom: 16, padding: "10px 14px", background: "#fff4f4", borderRadius: 4 }}>
                {error}
              </div>
            )}
          </div>

          {tasks.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
              No tasks yet. Dispatch your first agent above.
            </div>
          ) : (
            <div>
              <div style={{ padding: "0 24px 12px 24px" }}>
                <SectionHeader label="TASKS" color={COLORS.muted} />
              </div>
              <div style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 4, margin: "0 24px" }}>
                {tasks.map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onSelect={setSelectedId}
                    selected={selectedId === t.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — task detail */}
        {showDetail && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <TaskDetail
              taskId={selectedId}
              token={token}
              onClose={() => setSelectedId(null)}
              onApprove={() => loadTasks()}
              onReject={() => loadTasks()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
