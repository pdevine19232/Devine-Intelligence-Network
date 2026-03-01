import os
import anthropic
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

EXTRACTION_PROMPT = """You are a memory extraction system. Analyze this conversation and extract important information worth remembering about the user.

Extract memories in these categories:
- preference: how the user likes things done, their style, what they like/dislike
- goal: what the user is working toward, their ambitions, objectives
- project: ongoing work, features being built, business ideas in progress
- decision: choices made and why
- fact: important personal or professional facts about the user

Rules:
- Only extract genuinely useful long-term information
- Be specific and concrete — vague memories are useless
- Each memory should be a single clear statement
- Ignore small talk and one-off questions
- Maximum 5 memories per conversation
- If nothing important was shared, return an empty list

Return ONLY a JSON array like this:
[
  {"content": "User is building a platform called Devine Intelligence Network using React, FastAPI, and Supabase", "category": "project", "importance": 8},
  {"content": "User wants to buy high cash flow businesses as a wealth building strategy", "category": "goal", "importance": 9}
]

If nothing to remember, return: []"""

def extract_and_save_memories(user_id, messages):
    try:
        conversation_text = ""
        for m in messages:
            role = "User" if m["role"] == "user" else "Strategos"
            conversation_text += f"{role}: {m['content']}\n\n"

        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1000,
            system=EXTRACTION_PROMPT,
            messages=[{"role": "user", "content": conversation_text}]
        )

        import json
        text = response.content[0].text.strip()
        if not text or text == "[]":
            return []

        memories = json.loads(text)
        if not memories:
            return []

        saved = []
        for memory in memories:
            result = supabase.table("memories").insert({
                "user_id": user_id,
                "content": memory["content"],
                "category": memory.get("category", "fact"),
                "importance": memory.get("importance", 5)
            }).execute()
            saved.append(result.data[0])

        print(f"Saved {len(saved)} memories for user {user_id}")
        return saved

    except Exception as e:
        print(f"Memory extraction error: {e}")
        return []

def get_memories(user_id, limit=20):
    try:
        result = supabase.table("memories")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("importance", desc=True)\
            .order("created_at", desc=True)\
            .limit(limit)\
            .execute()
        return result.data
    except Exception as e:
        print(f"Memory fetch error: {e}")
        return []

def format_memories_for_context(memories):
    if not memories:
        return ""
    
    by_category = {}
    for m in memories:
        cat = m["category"]
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(m["content"])

    parts = ["## What I know about you:\n"]
    category_labels = {
        "goal": "Your Goals",
        "project": "Your Projects",
        "preference": "Your Preferences",
        "decision": "Decisions You've Made",
        "fact": "Important Context"
    }

    for cat, label in category_labels.items():
        if cat in by_category:
            parts.append(f"**{label}:**")
            for content in by_category[cat]:
                parts.append(f"- {content}")
            parts.append("")

    return "\n".join(parts)

def delete_memory(memory_id, user_id):
    result = supabase.table("memories")\
        .delete()\
        .eq("id", memory_id)\
        .eq("user_id", user_id)\
        .execute()
    return result.data