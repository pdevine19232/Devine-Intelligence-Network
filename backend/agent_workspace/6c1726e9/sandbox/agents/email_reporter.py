"""
Email Reporter — Sends a beautifully formatted agent completion report.

Styled to match the DIN morning brief aesthetic — same dark header,
ticker-bar style severity summary, clean sections.

Uses the same SMTP setup as daily_briefer.py.
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD")
EMAIL_TO = os.getenv("EMAIL_TO", EMAIL_ADDRESS)


# ── HTML Formatting ───────────────────────────────────────────────────────────

def format_agent_email(task: dict) -> str:
    """Build the HTML email body for the agent completion report."""

    now = datetime.now().strftime("%A, %B %d, %Y")
    title = task.get("title", "Agent Task Complete")

    builder_report = task.get("builder_report") or {}
    breaker_report = task.get("breaker_report") or {}
    teacher_report = task.get("teacher_report") or ""

    if isinstance(builder_report, str):
        import json
        try:
            builder_report = json.loads(builder_report)
        except Exception:
            builder_report = {}
    if isinstance(breaker_report, str):
        import json
        try:
            breaker_report = json.loads(breaker_report)
        except Exception:
            breaker_report = {}

    # ── Status bar (like ticker bar) ──────────────────────────────────────
    files_written = builder_report.get("files_successful", 0)
    files_failed = builder_report.get("files_failed", 0)
    assessment = breaker_report.get("overall_assessment", "N/A")
    critical = breaker_report.get("critical_count", 0)
    high = breaker_report.get("high_count", 0)
    medium = breaker_report.get("medium_count", 0)

    assessment_color = {
        "PASS": "#2a7a4a",
        "PASS_WITH_WARNINGS": "#c8a96e",
        "FAIL": "#c0341a",
    }.get(assessment, "#8a8880")

    status_bar = f"""
    <td style="padding: 8px 16px; border-right: 1px solid #e8e4dc; text-align: center;">
        <div style="font-family: 'Courier New', monospace; font-size: 9px; color: #8a8880; letter-spacing: 0.1em; margin-bottom: 3px;">FILES BUILT</div>
        <div style="font-family: 'Courier New', monospace; font-size: 18px; color: #1a1a18; font-weight: 600;">{files_written}</div>
        <div style="font-family: 'Courier New', monospace; font-size: 10px; color: {'#c0341a' if files_failed else '#2a7a4a'};">
            {'▼ ' + str(files_failed) + ' failed' if files_failed else '▲ all good'}
        </div>
    </td>
    <td style="padding: 8px 16px; border-right: 1px solid #e8e4dc; text-align: center;">
        <div style="font-family: 'Courier New', monospace; font-size: 9px; color: #8a8880; letter-spacing: 0.1em; margin-bottom: 3px;">QA VERDICT</div>
        <div style="font-family: 'Courier New', monospace; font-size: 13px; color: {assessment_color}; font-weight: 600;">{assessment}</div>
        <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #8a8880;">&nbsp;</div>
    </td>
    <td style="padding: 8px 16px; border-right: 1px solid #e8e4dc; text-align: center;">
        <div style="font-family: 'Courier New', monospace; font-size: 9px; color: #8a8880; letter-spacing: 0.1em; margin-bottom: 3px;">CRITICAL</div>
        <div style="font-family: 'Courier New', monospace; font-size: 18px; color: {'#c0341a' if critical else '#2a7a4a'}; font-weight: 600;">{critical}</div>
        <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #8a8880;">issues</div>
    </td>
    <td style="padding: 8px 16px; border-right: 1px solid #e8e4dc; text-align: center;">
        <div style="font-family: 'Courier New', monospace; font-size: 9px; color: #8a8880; letter-spacing: 0.1em; margin-bottom: 3px;">HIGH</div>
        <div style="font-family: 'Courier New', monospace; font-size: 18px; color: {'#c8a96e' if high else '#2a7a4a'}; font-weight: 600;">{high}</div>
        <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #8a8880;">issues</div>
    </td>
    <td style="padding: 8px 16px; text-align: center;">
        <div style="font-family: 'Courier New', monospace; font-size: 9px; color: #8a8880; letter-spacing: 0.1em; margin-bottom: 3px;">MEDIUM</div>
        <div style="font-family: 'Courier New', monospace; font-size: 18px; color: #8a8880; font-weight: 600;">{medium}</div>
        <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #8a8880;">issues</div>
    </td>
    """

    # ── Builder section ───────────────────────────────────────────────────
    plan_summary = builder_report.get("plan_summary", "No plan summary available.")
    files_list = builder_report.get("files_written", [])
    files_html = ""
    for f in files_list:
        action_color = "#4a7a5a" if f.get("action") == "create" else "#4a5a8a"
        action_label = f.get("action", "").upper()
        error = f.get("error")
        if error:
            files_html += f"""
            <div style="display: flex; align-items: baseline; padding: 6px 0; border-bottom: 1px solid #f0ece4;">
                <span style="font-family: 'Courier New', monospace; font-size: 9px; color: #c0341a; margin-right: 10px; min-width: 50px;">ERROR</span>
                <span style="font-size: 13px; color: #8a8880;">{f['path']}</span>
            </div>"""
        else:
            lines = f.get("lines", "?")
            files_html += f"""
            <div style="display: flex; align-items: baseline; padding: 6px 0; border-bottom: 1px solid #f0ece4;">
                <span style="font-family: 'Courier New', monospace; font-size: 9px; color: {action_color}; margin-right: 10px; min-width: 50px;">{action_label}</span>
                <span style="font-size: 13px; color: #1a1a18; flex: 1;">{f['path']}</span>
                <span style="font-family: 'Courier New', monospace; font-size: 10px; color: #8a8880;">{lines} lines</span>
            </div>"""

    testing = builder_report.get("testing_instructions", "")
    testing_html = ""
    if testing:
        steps = [s.strip() for s in testing.split("\n") if s.strip()]
        testing_html = "".join(
            f'<p style="margin: 0 0 8px 0; font-size: 13px; color: #1a1a18; padding-left: 16px; border-left: 2px solid #4a5a8a20;">{s}</p>'
            for s in steps[:10]
        )

    # ── Breaker section ───────────────────────────────────────────────────
    breaker_summary_text = breaker_report.get("summary", "No breaker analysis available.")
    findings = breaker_report.get("findings", [])

    severity_colors = {
        "critical": "#c0341a",
        "high": "#c8692e",
        "medium": "#c8a96e",
        "low": "#4a7a5a",
    }

    findings_html = ""
    for f in findings[:8]:  # Cap at 8 findings in email
        sev = f.get("severity", "low")
        color = severity_colors.get(sev, "#8a8880")
        findings_html += f"""
        <div style="margin-bottom: 12px; padding: 12px; background: #fff; border-left: 3px solid {color}; border-radius: 2px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-family: 'Courier New', monospace; font-size: 9px; font-weight: 600; color: {color}; text-transform: uppercase;">{sev}</span>
                <span style="font-family: 'Courier New', monospace; font-size: 9px; color: #8a8880;">{f.get('file', '')}</span>
            </div>
            <div style="font-size: 13px; color: #1a1a18; margin-bottom: 4px;">{f.get('issue', '')}</div>
            <div style="font-size: 12px; color: #5a5850;">Fix: {f.get('fix', '')[:200]}</div>
        </div>"""

    blockers = breaker_report.get("blockers", [])
    blockers_html = ""
    if blockers:
        blockers_html = "<div style='margin-top: 12px;'>"
        for b in blockers:
            blockers_html += f'<p style="margin: 0 0 6px 0; font-size: 13px; color: #c0341a; padding-left: 12px; border-left: 2px solid #c0341a;">⚠ {b}</p>'
        blockers_html += "</div>"

    # ── Teacher section ───────────────────────────────────────────────────
    # Convert markdown to simple HTML
    teacher_html = ""
    if teacher_report:
        lines = teacher_report.split("\n")
        for line in lines[:40]:  # Cap in email
            if line.startswith("## "):
                teacher_html += f'<h3 style="font-family: Courier New, monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.15em; color: #4a7a8a; text-transform: uppercase; margin: 16px 0 8px 0;">{line[3:]}</h3>'
            elif line.startswith("# "):
                teacher_html += f'<h2 style="font-size: 16px; color: #1a1a18; margin: 20px 0 10px 0;">{line[2:]}</h2>'
            elif line.startswith("- ") or line.startswith("* "):
                teacher_html += f'<p style="margin: 0 0 6px 16px; font-size: 13px; color: #1a1a18;">• {line[2:]}</p>'
            elif line.strip():
                teacher_html += f'<p style="margin: 0 0 10px 0; font-size: 13px; color: #1a1a18; line-height: 1.7;">{line}</p>'

    # ── Sandbox info ──────────────────────────────────────────────────────
    sandbox_port = task.get("sandbox_port", 8001)

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #faf9f6; font-family: 'Helvetica Neue', Arial, sans-serif;">
<div style="max-width: 680px; margin: 0 auto; background-color: #faf9f6;">

    <!-- HEADER -->
    <div style="background-color: #1a1a18; padding: 32px 36px;">
        <div style="font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: #3a3830; margin-bottom: 8px;">Agent Pipeline Complete</div>
        <div style="font-size: 22px; font-weight: 600; color: #faf9f6; letter-spacing: -0.01em; margin-bottom: 4px;">Devine Intelligence Network</div>
        <div style="font-size: 15px; color: #c8a96e; margin-bottom: 4px;">{title}</div>
        <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #4a4840; letter-spacing: 0.1em;">{now} · Task ID: {task.get('id', 'N/A')}</div>
        <div style="width: 24px; height: 1px; background: #c8a96e; margin-top: 16px;"></div>
    </div>

    <!-- STATUS BAR -->
    <div style="background-color: #fff; border-bottom: 1px solid #e8e4dc; overflow-x: auto;">
        <table style="border-collapse: collapse; width: 100%;"><tr>{status_bar}</tr></table>
    </div>

    <div style="padding: 36px;">

        <!-- REVIEW PROMPT -->
        <div style="background: #1a4060; padding: 16px 20px; border-radius: 4px; margin-bottom: 32px;">
            <div style="font-family: 'Courier New', monospace; font-size: 9px; color: #8aaac8; letter-spacing: 0.15em; margin-bottom: 6px;">ACTION REQUIRED</div>
            <div style="font-size: 14px; color: #fff; line-height: 1.6;">
                Your agents have finished working. Preview at <strong style="color: #c8a96e;">http://localhost:{sandbox_port}</strong> and then
                <strong>open the Agent Hub</strong> in your app to Approve or Reject the changes.
            </div>
        </div>

        <!-- BUILDER REPORT -->
        <div style="margin-bottom: 32px;">
            <div style="font-family: 'Courier New', monospace; font-size: 9px; font-weight: 600; letter-spacing: 0.2em; color: #4a7a5a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e8e4dc;">BUILDER — WHAT WAS BUILT</div>
            <p style="font-size: 14px; color: #1a1a18; line-height: 1.7; margin: 0 0 20px 0;">{plan_summary}</p>
            <div style="background: #fff; padding: 16px; border: 1px solid #e8e4dc; border-radius: 4px; margin-bottom: 16px;">
                <div style="font-family: 'Courier New', monospace; font-size: 9px; color: #8a8880; letter-spacing: 0.1em; margin-bottom: 10px;">FILES</div>
                {files_html}
            </div>
            {f'<div style="margin-top: 16px;"><div style="font-family: Courier New, monospace; font-size: 9px; color: #8a8880; letter-spacing: 0.1em; margin-bottom: 10px;">HOW TO TEST</div>{testing_html}</div>' if testing_html else ''}
        </div>

        <!-- BREAKER REPORT -->
        <div style="margin-bottom: 32px;">
            <div style="font-family: 'Courier New', monospace; font-size: 9px; font-weight: 600; letter-spacing: 0.2em; color: #c0341a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e8e4dc;">BREAKER — QUALITY & SECURITY FINDINGS</div>
            <p style="font-size: 14px; color: #1a1a18; line-height: 1.7; margin: 0 0 16px 0;">{breaker_summary_text}</p>
            {blockers_html}
            {findings_html if findings_html else '<p style="font-size: 13px; color: #4a7a5a;">No significant issues found.</p>'}
        </div>

        <!-- TEACHER REPORT -->
        <div style="margin-bottom: 32px;">
            <div style="font-family: 'Courier New', monospace; font-size: 9px; font-weight: 600; letter-spacing: 0.2em; color: #4a7a8a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e8e4dc;">TEACHER — HOW IT WORKS (PLAIN ENGLISH)</div>
            {teacher_html if teacher_html else '<p style="font-size: 13px; color: #8a8880;">Teacher report not available.</p>'}
        </div>

    </div>

    <!-- FOOTER -->
    <div style="padding: 24px 36px; border-top: 1px solid #e8e4dc; background: #fff;">
        <div style="font-family: 'Courier New', monospace; font-size: 9px; color: #c8c4bc; letter-spacing: 0.1em;">DEVINE INTELLIGENCE NETWORK · AGENT SYSTEM · {now.upper()}</div>
    </div>

</div>
</body>
</html>"""

    return html


# ── Email Sender ──────────────────────────────────────────────────────────────

def send_agent_email(task: dict):
    """Send the agent completion email report."""
    if not EMAIL_ADDRESS or not EMAIL_APP_PASSWORD:
        print("[Email] EMAIL_ADDRESS or EMAIL_APP_PASSWORD not configured — skipping email")
        return

    title = task.get("title", "Agent Task Complete")
    html_content = format_agent_email(task)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"🤖 DIN Agent Complete — {title}"
    msg["From"] = EMAIL_ADDRESS
    msg["To"] = EMAIL_TO

    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(EMAIL_ADDRESS, EMAIL_APP_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, EMAIL_TO, msg.as_string())
        print(f"[Email] Agent report sent to {EMAIL_TO}")
    except Exception as e:
        print(f"[Email] Failed to send agent report: {e}")
        raise
