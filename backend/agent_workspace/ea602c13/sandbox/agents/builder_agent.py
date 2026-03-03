"""
Builder Agent — GPT-4o powered code generator.

Given a task description, this agent:
  1. Reads your full codebase for context
  2. Plans exactly which files to create or modify
  3. Writes each file completely to agent_workspace/{task_id}/
  4. Optionally calls Perplexity for research when needed
  5. Returns a structured builder report

Model: OpenAI GPT-4o (best-in-class at code generation)
Research: Perplexity API (for looking up docs, patterns, APIs)
"""

import os
import json
import re
import time
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# ── API Clients ───────────────────────────────────────────────────────────────

try:
    from openai import OpenAI
    openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
except Exception:
    openai_client = None

try:
    from openai import OpenAI as PerplexityClient
    PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
    perplexity_client = PerplexityClient(
        api_key=PERPLEXITY_API_KEY,
        base_url="https://api.perplexity.ai"
    ) if PERPLEXITY_API_KEY else None
except Exception:
    perplexity_client = None

# Fallback: use Anthropic if OpenAI not available
try:
    import anthropic
    anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
except Exception:
    anthropic_client = None

WORKSPACE_ROOT = Path(__file__).parent.parent / "agent_workspace"

# ── Codebase Reader ───────────────────────────────────────────────────────────

def read_local_codebase(project_root: str) -> dict:
    """
    Walk the project directory and return all relevant source files.
    Returns: { "path/to/file.py": "file content", ... }
    """
    root = Path(project_root)
    files = {}

    INCLUDE_EXTENSIONS = {".py", ".jsx", ".js", ".ts", ".tsx", ".json"}
    EXCLUDE_DIRS = {
        "node_modules", ".git", "__pycache__", "agent_workspace",
        ".next", "build", "dist", "coverage", "venv", ".venv",
        "cache", "agent_tasks.db"
    }
    EXCLUDE_FILES = {".env", ".env.local", ".env.production", "package-lock.json"}
    MAX_FILE_SIZE = 50_000  # skip very large files (50KB)

    for path in root.rglob("*"):
        if path.is_dir():
            continue
        # Skip excluded directories
        if any(excl in path.parts for excl in EXCLUDE_DIRS):
            continue
        # Skip excluded files
        if path.name in EXCLUDE_FILES:
            continue
        # Only include target extensions
        if path.suffix not in INCLUDE_EXTENSIONS:
            continue
        # Skip large files
        if path.stat().st_size > MAX_FILE_SIZE:
            continue

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
            rel_path = str(path.relative_to(root))
            files[rel_path] = content
        except Exception:
            continue

    return files


MAX_CONTEXT_CHARS = 25_000   # ~6k tokens — safe budget for planning calls
MAX_FILE_CHARS   = 8_000    # truncate any single file beyond this

# Files that are always most useful to include
PRIORITY_FILES = {
    "backend/main.py", "backend/agent_routes.py",
    "frontend/src/App.js", "frontend/src/App.jsx",
}


def _lang(ext: str) -> str:
    return {"py": "python", "jsx": "javascript", "js": "javascript",
            "ts": "typescript", "tsx": "typescript"}.get(ext, ext)


def format_codebase_for_prompt(files: dict, budget: int = MAX_CONTEXT_CHARS) -> str:
    """
    Format codebase dict into a readable string for LLM context.
    Priority files go first; large files are truncated; total is capped at `budget` chars.
    """
    parts = ["# CURRENT CODEBASE (key files)\n"]
    total = 0

    # Sort: priority files first, then by size ascending (smaller = more room for more files)
    def sort_key(item):
        path, content = item
        priority = 0 if path.replace("\\", "/") in PRIORITY_FILES else 1
        return (priority, len(content))

    for path, content in sorted(files.items(), key=sort_key):
        if total >= budget:
            break
        ext = Path(path).suffix.lstrip(".")
        # Truncate individual large files
        if len(content) > MAX_FILE_CHARS:
            content = content[:MAX_FILE_CHARS] + f"\n... [truncated — {len(content)} chars total]"
        block = f"## {path}\n```{_lang(ext)}\n{content}\n```\n"
        if total + len(block) > budget:
            parts.append(f"## {path}\n[skipped — context budget reached]\n")
            break
        parts.append(block)
        total += len(block)

    return "\n".join(parts)


def format_focused_context(files: dict, target_path: str) -> str:
    """
    For file implementation calls, send only the most relevant files
    instead of the whole codebase. Keeps prompts small.
    """
    target = Path(target_path)
    target_dir = str(target.parent).replace("\\", "/")
    target_name = target.stem.lower()

    # Score files by relevance to target_path
    def relevance(item):
        path, content = item
        p = path.replace("\\", "/")
        score = 0
        if p.replace("\\", "/") in PRIORITY_FILES:
            score += 10
        if str(Path(p).parent).replace("\\", "/") == target_dir:
            score += 8          # same directory
        stem_lower = Path(p).stem.lower()
        if stem_lower in target_name or target_name in stem_lower:
            score += 5          # similar name
        if Path(p).suffix == target.suffix:
            score += 2          # same file type
        return -score           # negative = higher priority first

    focused_budget = 18_000     # tighter budget per file implementation
    parts = ["# RELEVANT CODEBASE FILES\n"]
    total = 0

    for path, content in sorted(files.items(), key=relevance):
        if total >= focused_budget:
            break
        ext = Path(path).suffix.lstrip(".")
        if len(content) > MAX_FILE_CHARS:
            content = content[:MAX_FILE_CHARS] + f"\n... [truncated]"
        block = f"## {path}\n```{_lang(ext)}\n{content}\n```\n"
        if total + len(block) > focused_budget:
            break
        parts.append(block)
        total += len(block)

    return "\n".join(parts)


# ── Research Tool ─────────────────────────────────────────────────────────────

def research_with_perplexity(query: str) -> str:
    """Use Perplexity to research technical questions before building."""
    if not perplexity_client:
        return "(Perplexity not configured — skipping research)"
    try:
        response = perplexity_client.chat.completions.create(
            model="llama-3.1-sonar-small-128k-online",
            messages=[
                {
                    "role": "system",
                    "content": "You are a technical research assistant. Answer concisely with working code examples where relevant."
                },
                {"role": "user", "content": query}
            ],
            max_tokens=2000,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"(Perplexity research failed: {e})"


# ── LLM Calls ─────────────────────────────────────────────────────────────────

def call_llm(system: str, user: str, model: str = "gpt-4o", json_mode: bool = False,
             retries: int = 3) -> str:
    """
    Call GPT-4o (or fallback to Claude) for code generation.
    Retries up to `retries` times with exponential backoff on rate-limit errors (429).
    """
    total_chars = len(system) + len(user)
    print(f"[Builder] LLM call: model={model}, context={total_chars:,} chars (~{total_chars//4:,} tokens)")

    # Try OpenAI first
    if openai_client:
        for attempt in range(retries):
            try:
                kwargs = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user}
                    ],
                    "max_tokens": 8000,
                    "temperature": 0.2,
                }
                if json_mode:
                    kwargs["response_format"] = {"type": "json_object"}
                response = openai_client.chat.completions.create(**kwargs)
                return response.choices[0].message.content
            except Exception as e:
                err = str(e)
                if "429" in err or "rate_limit" in err.lower():
                    wait = (2 ** attempt) * 5   # 5s, 10s, 20s
                    print(f"[Builder] OpenAI rate limit — waiting {wait}s before retry {attempt+1}/{retries}...")
                    time.sleep(wait)
                else:
                    print(f"[Builder] OpenAI error, falling back to Claude: {e}")
                    break   # Non-rate-limit error → skip retries, go to fallback

    # Fallback to Claude (with retry on rate limit)
    if anthropic_client:
        for attempt in range(retries):
            try:
                resp = anthropic_client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=8000,
                    system=system,
                    messages=[{"role": "user", "content": user}],
                )
                return resp.content[0].text
            except Exception as e:
                err = str(e)
                if "429" in err or "rate_limit" in err.lower():
                    wait = (2 ** attempt) * 10   # 10s, 20s, 40s — Claude limits reset slowly
                    print(f"[Builder] Claude rate limit — waiting {wait}s before retry {attempt+1}/{retries}...")
                    time.sleep(wait)
                else:
                    raise RuntimeError(f"Both OpenAI and Claude failed: {e}")
        raise RuntimeError("Both OpenAI and Claude failed: rate limit exhausted after retries")

    raise RuntimeError("No LLM available. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.")


# ── Builder Phases ────────────────────────────────────────────────────────────

STACK_CONTEXT = """
Tech Stack:
- Backend: FastAPI (Python 3.11), runs on port 8000
- Frontend: React 18, JSX only (no TypeScript), runs on port 3000
- Database: Supabase (PostgreSQL) — use the `supabase` client already initialized in other modules
- Auth: Custom JWT auth via auth.py — protect routes with `Depends(get_current_user)` or `Depends(require_admin)`
- AI: Anthropic claude-haiku-4-5-20251001 for fast tasks, claude-opus-4-6 for complex reasoning (already in strategos.py)
- HTTP (frontend): native fetch() calls to http://localhost:8000
- Styling: Inline style objects in JSX — NO external CSS files, NO Tailwind, NO CSS modules
- State: React hooks (useState, useEffect, useCallback)
- Environment: python-dotenv for .env loading in backend
- Existing patterns: Follow the exact same patterns as existing files in the codebase
"""

def plan_task(task_title: str, task_description: str, codebase_text: str, research: str = "") -> dict:
    """
    Phase 1: Ask GPT-4o to plan which files to create/modify.
    Returns a structured plan as a dict.
    """
    system = f"""You are a senior full-stack software engineer at a fintech startup.
Your job is to plan how to implement a new feature for the Devine Intelligence Network platform.

{STACK_CONTEXT}

You must output ONLY valid JSON. No markdown, no explanation outside the JSON.

Output format:
{{
  "plan_summary": "2-3 sentence description of what you will build and why",
  "needs_research": false,
  "research_queries": [],
  "files": [
    {{
      "path": "backend/new_module.py",
      "action": "create",
      "description": "What this file does and why it's needed"
    }},
    {{
      "path": "backend/main.py",
      "action": "modify",
      "description": "Specific changes: add 2 new routes /foo and /bar"
    }}
  ],
  "integration_notes": "Any important notes about how pieces connect — routes to add in main.py, components to add in App.js, etc.",
  "testing_instructions": "Step-by-step instructions for how to test this feature manually"
}}

Rules:
- Only include files that actually need to change
- Be specific in descriptions — vague plans produce bad code
- For main.py modifications, specify exactly which imports and routes to add
- For App.js modifications, specify exactly which routes/components to add
- Keep scope realistic — build the minimum viable version first
"""

    user = f"""Task: {task_title}

Description: {task_description}

{f"Research findings: {research}" if research else ""}

{codebase_text}

Plan the implementation."""

    raw = call_llm(system, user, json_mode=True)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON from the response
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Could not parse plan JSON: {raw[:500]}")


def implement_file(
    file_plan: dict,
    task_title: str,
    task_description: str,
    full_plan: dict,
    codebase_files: dict,
    existing_content: str = None
) -> str:
    """
    Phase 2: Generate the complete content for one file.
    Uses focused context (only relevant files) to stay within token limits.
    """
    action = file_plan.get("action", "create")
    path = file_plan["path"]

    if action == "modify" and existing_content:
        # For modify: include the exact file being changed, truncated if needed
        existing_snippet = existing_content
        if len(existing_snippet) > MAX_FILE_CHARS:
            existing_snippet = existing_snippet[:MAX_FILE_CHARS] + "\n... [truncated]"
        action_instruction = f"""You are MODIFYING an existing file.
Current file content:
```
{existing_snippet}
```
Make ONLY the changes described below. Return the COMPLETE modified file."""
    else:
        action_instruction = "You are CREATING a new file. Write the complete, working file from scratch."

    # Use focused context — only files relevant to this specific implementation
    focused_context = format_focused_context(codebase_files, path)

    system = f"""You are a senior full-stack software engineer implementing a feature for the Devine Intelligence Network.

{STACK_CONTEXT}

{action_instruction}

Critical rules:
- Write COMPLETE, WORKING code — no placeholders, no "TODO", no "..."
- Follow the exact same patterns, naming conventions, and style as the existing codebase
- Include all necessary imports
- Handle errors with try/except and meaningful error messages
- For backend files: follow FastAPI patterns from main.py
- For frontend files: follow React patterns from existing JSX files
- Return ONLY the file content — no explanation, no markdown wrapper
"""

    user = f"""Task: {task_title}
Description: {task_description}

File to implement: {path}
What it should do: {file_plan["description"]}

Integration context: {full_plan.get("integration_notes", "")}

Plan summary: {full_plan.get("plan_summary", "")}

{focused_context}

Write the complete file content for {path}:"""

    return call_llm(system, user, model="gpt-4o")


# ── Main Runner ───────────────────────────────────────────────────────────────

def run_builder(task_id: str, project_root: str, on_progress=None) -> dict:
    """
    Main entry point. Run the full builder pipeline for a task.

    Args:
        task_id: The task ID from task_manager
        project_root: Absolute path to the project root directory
        on_progress: Optional callback fn(message: str) for status updates

    Returns:
        builder_report dict with keys: plan, files_written, summary, testing_instructions
    """
    from agents.task_manager import get_task

    def log(msg):
        print(f"[Builder:{task_id}] {msg}")
        if on_progress:
            on_progress(msg)

    task = get_task(task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    workspace_dir = WORKSPACE_ROOT / task_id
    workspace_dir.mkdir(parents=True, exist_ok=True)

    # ── Step 1: Read codebase ──────────────────────────────────────────────
    log("Reading codebase...")
    try:
        codebase_files = read_local_codebase(project_root)
        log(f"Read {len(codebase_files)} source files")
    except Exception as e:
        log(f"Could not read local codebase, falling back to GitHub context: {e}")
        codebase_files = {}

    # ── Step 2: Research (if needed) ──────────────────────────────────────
    research_text = ""
    if perplexity_client and len(task["description"]) > 50:
        log("Researching best practices with Perplexity...")
        research_query = f"Best practices and implementation patterns for: {task['description']} in a FastAPI + React application"
        research_text = research_with_perplexity(research_query)
        log("Research complete")

    # ── Step 3: Plan ──────────────────────────────────────────────────────
    log("Planning implementation...")
    # Use the capped codebase text only for planning
    codebase_text = format_codebase_for_prompt(codebase_files)
    log(f"Planning context: {len(codebase_text):,} chars")
    plan = plan_task(
        task["title"],
        task["description"],
        codebase_text,
        research=research_text
    )
    log(f"Plan: {plan.get('plan_summary', '')[:100]}...")
    log(f"Files to create/modify: {len(plan.get('files', []))}")

    # Save plan immediately
    (workspace_dir / "plan.json").write_text(json.dumps(plan, indent=2))

    # ── Step 4: Implement each file ───────────────────────────────────────
    files_written = []
    file_contents = {}

    for i, file_plan in enumerate(plan.get("files", []), 1):
        path = file_plan["path"]
        action = file_plan.get("action", "create")
        log(f"[{i}/{len(plan['files'])}] {action}: {path}")

        # Get existing content if modifying
        existing_content = None
        if action == "modify":
            # Try to read from local codebase first
            existing_content = codebase_files.get(path)
            if not existing_content:
                # Try reading from disk
                full_path = Path(project_root) / path
                if full_path.exists():
                    existing_content = full_path.read_text(encoding="utf-8", errors="ignore")

        try:
            content = implement_file(
                file_plan=file_plan,
                task_title=task["title"],
                task_description=task["description"],
                full_plan=plan,
                codebase_files=codebase_files,
                existing_content=existing_content,
            )

            # Strip markdown code fences if LLM wrapped the response
            content = strip_code_fences(content)

            # Write to workspace
            output_path = workspace_dir / path
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(content, encoding="utf-8")

            file_contents[path] = content
            files_written.append({
                "path": path,
                "action": action,
                "description": file_plan["description"],
                "size": len(content),
                "lines": content.count("\n") + 1,
            })
            log(f"  ✓ Written ({len(content)} chars)")

        except Exception as e:
            log(f"  ✗ Failed to implement {path}: {e}")
            files_written.append({
                "path": path,
                "action": action,
                "description": file_plan["description"],
                "error": str(e),
            })

    # ── Step 5: Write manifest ─────────────────────────────────────────────
    manifest = {
        "task_id": task_id,
        "task_title": task["title"],
        "built_at": datetime.now().isoformat(),
        "project_root": project_root,
        "files": files_written,
    }
    (workspace_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    # ── Step 6: Build report ───────────────────────────────────────────────
    successful = [f for f in files_written if "error" not in f]
    failed = [f for f in files_written if "error" in f]

    builder_report = {
        "plan_summary": plan.get("plan_summary", ""),
        "integration_notes": plan.get("integration_notes", ""),
        "testing_instructions": plan.get("testing_instructions", ""),
        "files_written": files_written,
        "files_successful": len(successful),
        "files_failed": len(failed),
        "workspace_dir": str(workspace_dir),
        "research_used": bool(research_text),
        "built_at": datetime.now().isoformat(),
    }

    if failed:
        builder_report["failures"] = [f"{f['path']}: {f['error']}" for f in failed]

    log(f"Builder complete. {len(successful)} files written, {len(failed)} failed.")
    return builder_report


def strip_code_fences(text: str) -> str:
    """Remove markdown code fences from LLM output."""
    text = text.strip()
    # Remove ```python, ```javascript, ``` etc.
    text = re.sub(r'^```[a-zA-Z]*\n', '', text)
    text = re.sub(r'\n```$', '', text)
    text = re.sub(r'^```\n?', '', text)
    text = re.sub(r'\n?```$', '', text)
    return text.strip()