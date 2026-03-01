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
from coverageUniverse import (
    get_companies, get_sectors, get_company_detail,
    get_price_history, get_company_news, add_company,
    delete_company, update_sector_index, update_sector_metrics,
    get_company_snapshot, METRIC_LABELS, format_metric
)

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
    
@app.get("/coverage/companies")
def coverage_companies(user=Depends(get_current_user)):
    try:
        companies = get_companies()
        sectors = get_sectors()
        snapshots = []
        for c in companies:
            snap = get_company_snapshot(c['ticker'])
            snap['sector'] = c['sector']
            snap['description'] = c['description']
            snap['db_name'] = c['name']
            snapshots.append(snap)
        return {"companies": snapshots, "sectors": sectors}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/coverage/company/{ticker}")
def coverage_company(ticker: str, user=Depends(get_current_user)):
    try:
        detail = get_company_detail(ticker)
        news = get_company_news(ticker)
        companies = get_companies()
        db_company = next((c for c in companies if c['ticker'] == ticker.upper()), None)
        sectors = get_sectors()
        sector_data = next((s for s in sectors if db_company and s['name'] == db_company['sector']), None)

        formatted_metrics = {}
        if detail and detail.get('metrics'):
            sector_metrics = sector_data['metrics'] if sector_data else list(detail['metrics'].keys())
            for key in sector_metrics:
                formatted_metrics[METRIC_LABELS.get(key, key)] = format_metric(key, detail['metrics'].get(key))

        return {
            "detail": detail,
            "news": news,
            "db_company": db_company,
            "sector_data": sector_data,
            "formatted_metrics": formatted_metrics,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

class AddCompanyRequest(BaseModel):
    ticker: str
    sector: str

@app.post("/coverage/companies")
def coverage_add_company(request: AddCompanyRequest, user=Depends(require_admin)):
    try:
        company = add_company(request.ticker, request.sector)
        return {"company": company}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/coverage/companies/{ticker}")
def coverage_delete_company(ticker: str, user=Depends(require_admin)):
    try:
        result = delete_company(ticker)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateSectorIndexRequest(BaseModel):
    sector_name: str
    index_ticker: str
    index_name: str

class UpdateSectorMetricsRequest(BaseModel):
    sector_name: str
    metrics: list

@app.post("/coverage/sectors/index")
def coverage_update_sector_index(request: UpdateSectorIndexRequest, user=Depends(require_admin)):
    try:
        result = update_sector_index(request.sector_name, request.index_ticker, request.index_name)
        return {"status": "updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/coverage/sectors/metrics")
def coverage_update_sector_metrics(request: UpdateSectorMetricsRequest, user=Depends(require_admin)):
    try:
        result = update_sector_metrics(request.sector_name, request.metrics)
        return {"status": "updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/coverage/history/{ticker}")
def coverage_history(ticker: str, period: str = "1y", start: str = None, end: str = None, user=Depends(get_current_user)):
    try:
        print(f"Route received: ticker={ticker}, period={period}, start={start}, end={end}")
        history = get_price_history(ticker, period, start, end)
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/test-github")
def test_github(user=Depends(require_admin)):
    try:
        from github_context import get_file_content
        content = get_file_content("backend/main.py")
        if content:
            return {"status": "success", "chars": len(content)}
        else:
            return {"status": "failed", "reason": "content was None"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}