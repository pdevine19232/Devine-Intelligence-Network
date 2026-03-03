import os
import requests
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO_OWNER = "pdevine19232"
REPO_NAME = "Devine-Intelligence-Network"
BRANCH = "main"

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

# Files to include in context - keep focused to avoid token limits
INCLUDE_PATHS = [
    "backend/main.py",
    "backend/strategos.py",
    "backend/coverageUniverse.py",
    "backend/daily_briefer.py",
    "backend/auth.py",
    "backend/memory.py",
    "backend/github_context.py",
    "backend/contracts.py",
    "frontend/src/App.js",
    "frontend/src/pages/Dashboard.jsx",
    "frontend/src/pages/Chat.jsx",
    "frontend/src/pages/Company.jsx",
    "frontend/src/pages/CoverageUniverse.jsx",
    "frontend/src/pages/AdminPanel.jsx",
    "frontend/src/pages/Login.jsx",
    "frontend/src/pages/Contracts.jsx",
]

def get_file_content(path):
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{path}?ref={BRANCH}"
    res = requests.get(url, headers=HEADERS)
    if res.status_code != 200:
        return None
    data = res.json()
    import base64
    try:
        return base64.b64decode(data["content"]).decode("utf-8")
    except Exception:
        return None

def get_codebase_context():
    parts = []
    parts.append(f"# Devine Intelligence Network — Full Codebase Context")
    parts.append(f"# Repo: {REPO_OWNER}/{REPO_NAME} | Branch: {BRANCH}\n")

    for path in INCLUDE_PATHS:
        content = get_file_content(path)
        if content:
            ext = path.split(".")[-1]
            lang = "python" if ext == "py" else "javascript"
            parts.append(f"## {path}\n```{lang}\n{content}\n```\n")
        else:
            parts.append(f"## {path}\n(Could not fetch)\n")

    return "\n".join(parts)