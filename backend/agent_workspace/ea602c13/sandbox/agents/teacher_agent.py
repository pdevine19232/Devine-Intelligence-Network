"""
Teacher Agent — GPT-4o-mini powered plain-English explainer.

Given the Builder's code and Breaker's findings, this agent:
  1. Explains what was built in simple, non-technical terms
  2. Walks through each file and what it does
  3. Explains the key concepts used (like explaining to a smart non-developer)
  4. Summarizes the Breaker's findings in plain English
  5. Gives you a mental model of how it all works

Model: OpenAI GPT-4o-mini (very cheap, great at clear explanations)
Fallback: Gemini Flash → Claude Haiku
"""

import os
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

WORKSPACE_ROOT = Path(__file__).parent.parent / "agent_workspace"

# ── API Clients ───────────────────────────────────────────────────────────────

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

try:
    from openai import OpenAI
    openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
except ImportError:
    openai_client = None

try:
    import google.generativeai as genai
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
    gemini_available = bool(GEMINI_API_KEY)
except ImportError:
    gemini_available = False

try:
    import anthropic
    anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
except ImportError:
    anthropic_client = None


# ── LLM Call ─────────────────────────────────────────────────────────────────

def call_teacher_llm(system: str, user: str) -> str:
    """Call GPT-4o-mini (or fallback) for explanation generation."""

    # Try GPT-4o-mini first — very cheap and great at explanations
    if openai_client:
        try:
            resp = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                max_tokens=6000,
                temperature=0.4,
            )
            return resp.choices[0].message.content
        except Exception as e:
            print(f"[Teacher] GPT-4o-mini failed: {e}")

    # Fallback: Gemini Flash
    if gemini_available:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(
                f"{system}\n\n{user}",
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=6000,
                    temperature=0.4,
                )
            )
            return response.text
        except Exception as e:
            print(f"[Teacher] Gemini Flash failed: {e}")

    # Final fallback: Claude Haiku
    if anthropic_client:
        try:
            resp = anthropic_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=6000,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return resp.content[0].text
        except Exception as e:
            raise RuntimeError(f"All LLMs failed for Teacher: {e}")

    raise RuntimeError("No LLM available. Configure OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY.")


# ── Teacher Prompts ───────────────────────────────────────────────────────────

TEACHER_SYSTEM = """You are a patient, gifted educator who teaches software development concepts to smart non-developers.

Your student is Patrick Devine — a financial analyst who built this app and wants to deeply understand everything that gets built in it. He's intelligent and picks things up quickly but doesn't write code day-to-day.

Your job is to explain what was just built as if you were a knowledgeable friend explaining it over coffee. Use:
- Plain English, not jargon (or explain jargon when you use it)
- Analogies to things Patrick would know (finance, banking, how businesses work)
- Concrete examples of what the feature does from a user's perspective
- Explanations of the "why" — not just what the code does, but why it was built that way

Structure your response as a well-formatted explanation with clear sections.
Be thorough but conversational. Think: "smart friend explaining their work" not "textbook definition."
"""


def generate_explanation(
    task_title: str,
    task_description: str,
    builder_report: dict,
    breaker_report: dict,
    new_files: dict,
) -> str:
    """Generate a plain-English explanation of what was built."""

    # Summarize new files (don't dump full code — too expensive for mini model)
    file_summaries = []
    for path, content in new_files.items():
        lines = content.split("\n")
        # Get the first few lines and any docstrings/comments for context
        preview = "\n".join(lines[:30])
        file_summaries.append(f"**{path}** ({len(lines)} lines)\n{preview}\n...")

    files_text = "\n\n".join(file_summaries[:10])  # cap at 10 files

    # Summarize breaker findings
    findings = breaker_report.get("findings", [])
    critical = [f for f in findings if f.get("severity") == "critical"]
    high = [f for f in findings if f.get("severity") == "high"]

    breaker_summary = f"""
Overall assessment: {breaker_report.get('overall_assessment', 'N/A')}
Summary: {breaker_report.get('summary', '')}
Issues found: {breaker_report.get('critical_count', 0)} critical, {breaker_report.get('high_count', 0)} high, {breaker_report.get('medium_count', 0)} medium, {breaker_report.get('low_count', 0)} low
"""
    if critical:
        breaker_summary += f"\nCritical issues:\n" + "\n".join(
            f"- {f['file']}: {f['issue']}" for f in critical
        )
    if high:
        breaker_summary += f"\nHigh priority issues:\n" + "\n".join(
            f"- {f['file']}: {f['issue']}" for f in high
        )

    user_prompt = f"""Here's what was just built for your Devine Intelligence Network app:

TASK: {task_title}
GOAL: {task_description}

WHAT THE BUILDER BUILT:
{builder_report.get('plan_summary', '')}

FILES CREATED/MODIFIED:
{files_text}

HOW TO TEST IT (from the Builder):
{builder_report.get('testing_instructions', 'Not specified')}

WHAT THE QUALITY CHECKER (BREAKER) FOUND:
{breaker_summary}

Now explain all of this to me as if I'm a smart non-developer who built this app and wants to understand:
1. What was actually built and what it does (from a user's perspective)
2. What each major file does and why it exists
3. How the pieces connect together
4. What the Breaker found and why it matters (or doesn't)
5. What I should actually test to make sure this works
6. Any concepts introduced that I should understand

Be warm, clear, and thorough. Use analogies to finance or business where helpful."""

    return call_teacher_llm(TEACHER_SYSTEM, user_prompt)


# ── Main Runner ───────────────────────────────────────────────────────────────

def run_teacher(task_id: str, on_progress=None) -> str:
    """
    Main entry point for the Teacher agent.

    Args:
        task_id: The task ID to explain
        on_progress: Optional callback fn(message: str)

    Returns:
        Plain-text explanation (Markdown formatted)
    """
    from agents.task_manager import get_task

    def log(msg):
        print(f"[Teacher:{task_id}] {msg}")
        if on_progress:
            on_progress(msg)

    task = get_task(task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    workspace_dir = WORKSPACE_ROOT / task_id

    builder_report = task.get("builder_report") or {}
    if isinstance(builder_report, str):
        builder_report = json.loads(builder_report)

    breaker_report = task.get("breaker_report") or {}
    if isinstance(breaker_report, str):
        breaker_report = json.loads(breaker_report)

    # ── Load new files ─────────────────────────────────────────────────────
    log("Loading files for explanation...")
    new_files = {}
    files_written = builder_report.get("files_written", [])
    for file_info in files_written:
        if "error" in file_info:
            continue
        path = file_info["path"]
        full_path = workspace_dir / path
        if full_path.exists():
            try:
                new_files[path] = full_path.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                pass

    if not new_files and workspace_dir.exists():
        for path in workspace_dir.rglob("*"):
            if path.is_file() and path.suffix in {".py", ".jsx", ".js"}:
                rel = str(path.relative_to(workspace_dir))
                try:
                    new_files[rel] = path.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    pass

    log("Generating plain-English explanation...")
    explanation = generate_explanation(
        task_title=task["title"],
        task_description=task["description"],
        builder_report=builder_report,
        breaker_report=breaker_report,
        new_files=new_files,
    )

    # Save to workspace
    if workspace_dir.exists():
        (workspace_dir / "teacher_report.md").write_text(explanation, encoding="utf-8")

    log("Teacher complete.")
    return explanation
