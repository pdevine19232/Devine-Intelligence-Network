import threading
import schedule
import time
from datetime import datetime
import pytz

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from auth import get_current_user, require_admin
from strategos import chat
from daily_briefer import run_daily_briefer

app = FastAPI(title="Devine Intelligence Network")

def run_scheduler():
    NEW_YORK = pytz.timezone('America/New_York')
    def job():
        now = datetime.now(NEW_YORK)
        print(f"Running scheduled brief at {now}")
        run_daily_briefer()
    schedule.every().day.at("11:30").do(job)
    while True:
        schedule.run_pending()
        time.sleep(60)

scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
scheduler_thread.start()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://devine-intelligence-network.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    mode: Optional[str] = "execution"

@app.get("/")
def root():
    return {"status": "Devine Intelligence Network is running"}

@app.get("/protected")
def protected_route(user=Depends(get_current_user)):
    return {"message": f"Hello {user['email']}, you are logged in"}

@app.get("/admin-only")
def admin_route(user=Depends(require_admin)):
    return {"message": f"Hello Admin {user['email']}"}

@app.post("/chat")
def chat_endpoint(
    request: ChatRequest,
    user=Depends(get_current_user)
):
    try:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        response = chat(messages, mode=request.mode)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/send-brief")
def send_brief(user=Depends(require_admin)):
    try:
        run_daily_briefer()
        return {"status": "Brief sent successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))