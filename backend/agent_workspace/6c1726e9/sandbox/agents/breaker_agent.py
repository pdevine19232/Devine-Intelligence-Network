"""
Breaker Agent — Gemini-powered vulnerability and quality tester.

Given the Builder's output, this agent:
  1. Reviews every new/modified file for bugs and security issues
  2. Checks integration points with the existing codebase
  3. Identifies missing edge cases and error handling gaps
  4. Produces a severity-ranked findings report

Model: Google Gemini 1.5 Pro (fast, cheap, excellent at code analysis)
Fallback: GPT-4o-mini
"""

import os
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

WORKSPACE_ROOT = Path(__file__).parent.parent / "agent_workspace"

# ── API Clients ───────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

try:
    import google.generativeai as genai
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
    gemini_available = bool(GEMINI_API_KEY)
except ImportError:
    gemini_available = False

try:
    from openai import OpenAI
    openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
except ImportError:
    openai_client = None

try:
    import anthropic
    anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
except ImportError:
    anthropic_client = None


# ── LLM Call ─────────────────────────────────────────────────────────────────

def call_breaker_llm(prompt: str) -> str:
    """Call Gemini (or fallback) for code analysis."""

    # Try Gemini first — cheapest option
    if gemini_available:
        try:
            model = genai.GenerativeModel("gemini-1.5-pro")
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=8000,
                    temperature=0.1,
                )
            )
            return response.text
        except Exception as e:
            print(f"[Breaker] Gemini failed, trying fallback: {e}")

    # Fallback: GPT-4o-mini
    if openai_client:
        try:
            resp = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=8000,
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            return resp.choices[0].message.content
        except Exception as e:
            print(f"[Breaker] GPT-4o-mini failed, trying Claude: {e}")

    # Final fallback: Claude Haiku
    if anthropic_client:
        try:
            resp = anthropic_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=8000,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text
        except Exception as e:
            raise RuntimeError(f"All LLMs failed for Breaker: {e}")

    raise RuntimeError("No LLM available for Breaker. Configure GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.")


# ── Breaker Analysis ──────────────────────────────────────────────────────────

BREAKER_SYSTEM_PROMPT = """You are a senior security engineer and code reviewer at a financial technology company.
Your job is to BREAK things — find every bug, vulnerability, edge case, and weakness in code before it goes to production.

You review code for:

SECURITY:
- SQL injection, XSS, CSRF vulnerabilities
- Missing authentication/authorization checks
- Exposed API keys or secrets in code
- Improper input validation
- Insecure data handling

RELIABILITY:
- Unhandled exceptions that could crash the server
- Missing null/undefined checks
- Race conditions or threading issues
- API calls without timeout or retry logic
- Missing error responses to the client

INTEGRATION:
- Imports that don't match existing module structure
- Routes that conflict with existing endpoints
- Database queries that could fail silently
- Frontend API calls pointing to wrong endpoints
- Missing CORS or auth middleware on new routes

LOGIC:
- Off-by-one errors, incorrect calculations
- Missing edge cases (empty lists, zero values, etc.)
- Incorrect business logic

Be thorough but fair. Rate each finding by severity: critical, high, medium, low.
A "critical" finding means the feature would break in production or expose a security hole.
A "low" finding is a best practice suggestion that won't cause immediate problems.

Output ONLY valid JSON in the exact format specified."""


def analyze_files(
    task_title: str,
    task_description: str,
    new_files: dict,
    builder_report: dict,
    project_context: str = ""
) -> dict:
    """
    Core analysis function. Takes new files and returns structured findings.

    Args:
        task_title: The task name
        task_description: What was supposed to be built
        new_files: { "path": "content", ... } of files the Builder wrote
        builder_report: The Builder's report dict
        project_context: Brief description of existing codebase patterns

    Returns:
        findings dict with severity-ranked issues
    """

    files_text = ""
    for path, content in new_files.items():
        ext = Path(path).suffix.lstrip(".")
        lang = {"py": "python", "jsx": "javascript", "js": "javascript"}.get(ext, ext)
        files_text += f"\n## {path}\n```{lang}\n{content}\n```\n"

    prompt = f"""{BREAKER_SYSTEM_PROMPT}

TASK BEING REVIEWED:
Title: {task_title}
Description: {task_description}

BUILDER'S PLAN:
{builder_report.get('plan_summary', '')}

Integration notes: {builder_report.get('integration_notes', '')}

FILES TO REVIEW:
{files_text}

{f"PROJECT CONTEXT: {project_context}" if project_context else ""}

Analyze all files thoroughly. Output ONLY this JSON:
{{
  "overall_assessment": "PASS | PASS_WITH_WARNINGS | FAIL",
  "summary": "2-3 sentence overall verdict",
  "critical_count": 0,
  "high_count": 0,
  "medium_count": 0,
  "low_count": 0,
  "findings": [
    {{
      "severity": "critical | high | medium | low",
      "file": "path/to/file.py",
      "line_hint": "approximate line or function name",
      "issue": "Clear description of the problem",
      "impact": "What goes wrong if this isn't fixed",
      "fix": "Exact code change or approach to fix it"
    }}
  ],
  "security_score": 8,
  "reliability_score": 7,
  "integration_score": 9,
  "quick_wins": ["Small fix 1 the builder should make", "Small fix 2"],
  "blockers": ["Critical issue that must be resolved before going live"]
}}

If no issues found in a category, use empty arrays. Be specific with file paths and function names."""

    raw = call_breaker_llm(prompt)

    # Parse JSON
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        import re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
        # Return a basic report if parsing fails
        return {
            "overall_assessment": "UNKNOWN",
            "summary": "Breaker analysis completed but report parsing failed.",
            "findings": [],
            "raw_output": raw[:2000],
            "parse_error": True,
        }


# ── Main Runner ───────────────────────────────────────────────────────────────

def run_breaker(task_id: str, project_root: str = None, on_progress=None) -> dict:
    """
    Main entry point for the Breaker agent.

    Args:
        task_id: The task ID to analyze
        project_root: Optional — for reading existing project context
        on_progress: Optional callback fn(message: str)

    Returns:
        breaker_report dict
    """
    from agents.task_manager import get_task

    def log(msg):
        print(f"[Breaker:{task_id}] {msg}")
        if on_progress:
            on_progress(msg)

    task = get_task(task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    workspace_dir = WORKSPACE_ROOT / task_id
    if not workspace_dir.exists():
        raise ValueError(f"Workspace {workspace_dir} does not exist — run Builder first")

    builder_report = task.get("builder_report") or {}
    if isinstance(builder_report, str):
        builder_report = json.loads(builder_report)

    # ── Load new files from workspace ──────────────────────────────────────
    log("Loading Builder's output files...")
    new_files = {}

    # Read all files the builder wrote
    files_written = builder_report.get("files_written", [])
    for file_info in files_written:
        if "error" in file_info:
            continue
        path = file_info["path"]
        full_path = workspace_dir / path
        if full_path.exists():
            try:
                new_files[path] = full_path.read_text(encoding="utf-8", errors="ignore")
            except Exception as e:
                log(f"Could not read {path}: {e}")

    # If no files found via manifest, scan workspace directory
    if not new_files:
        log("No manifest files found, scanning workspace...")
        for path in workspace_dir.rglob("*"):
            if path.is_file() and path.suffix in {".py", ".jsx", ".js"} and path.name != "plan.json":
                rel = str(path.relative_to(workspace_dir))
                try:
                    new_files[rel] = path.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    pass

    if not new_files:
        return {
            "overall_assessment": "SKIP",
            "summary": "No files to analyze — Builder produced no output.",
            "findings": [],
            "files_reviewed": 0,
        }

    log(f"Analyzing {len(new_files)} files...")

    # ── Brief project context ──────────────────────────────────────────────
    project_context = """
    Devine Intelligence Network: FastAPI backend + React frontend.
    Auth: Custom JWT via auth.py — all routes need Depends(get_current_user).
    DB: Supabase client (supabase = create_client(URL, KEY)) — used for companies, sectors, memories tables.
    AI: Anthropic Claude via anthropic.Anthropic client.
    Frontend calls backend at http://localhost:8000 via fetch().
    """

    # ── Run analysis ───────────────────────────────────────────────────────
    report = analyze_files(
        task_title=task["title"],
        task_description=task["description"],
        new_files=new_files,
        builder_report=builder_report,
        project_context=project_context,
    )

    report["files_reviewed"] = len(new_files)
    report["analyzed_at"] = datetime.now().isoformat()

    total_issues = (
        report.get("critical_count", 0) +
        report.get("high_count", 0) +
        report.get("medium_count", 0) +
        report.get("low_count", 0)
    )
    log(
        f"Breaker complete. Assessment: {report.get('overall_assessment')} | "
        f"{total_issues} total issues | "
        f"{report.get('critical_count', 0)} critical"
    )

    return report
