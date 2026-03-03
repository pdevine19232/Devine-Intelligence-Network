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
from agent_routes import router as agent_router

app = FastAPI(title="Devine Intelligence Network")
app.include_router(agent_router)

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
        user_id = user.get("sub") or user.get("email")
        is_admin = user.get("email") in ["patrick.k.devine@outlook.com"]

        from memory import get_memories, extract_and_save_memories
        user_memories = get_memories(user_id)

        response = chat(messages, mode=request.mode, include_codebase=is_admin, user_memories=user_memories)

        import threading
        def save_memories():
            all_messages = messages + [{"role": "assistant", "content": response}]
            extract_and_save_memories(user_id, all_messages)
        threading.Thread(target=save_memories, daemon=True).start()

        return {"response": response}
    except Exception as e:
        import traceback
        traceback.print_exc()
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

@app.get("/contracts")
def get_contracts(
    naics: str = None,
    set_aside: str = None,
    keyword: str = None,
    days_back: int = 30,
    user=Depends(get_current_user)
):
    try:
        from contracts import get_opportunities
        opportunities, error = get_opportunities(
            naics_filter=naics,
            set_aside_filter=set_aside,
            keyword=keyword,
            days_back=days_back
        )
        return {
            "opportunities": opportunities,
            "count": len(opportunities),
            "error": error,  # Will be None if everything is fine
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/contracts/analyze")
def analyze_contract(request: ChatRequest, user=Depends(get_current_user)):
    try:
        import anthropic
        import os
        import json

        # Truncate content to avoid rate limits
        messages = []
        for m in request.messages:
            content = m.content[:3000] if len(m.content) > 3000 else m.content
            messages.append({"role": m.role, "content": content})

        system = """You are a government contract margin analyst. Your job is to analyze federal contract opportunities and determine if they are profitable for a small business reseller/distributor.

When given a contract opportunity:
1. Identify the specific product(s) being requested
2. Search for current pricing from major distributors: Grainger, McMaster-Carr, MSC Industrial, Amazon Business, Global Industrial, Fastenal
3. Estimate the unit cost to source the product
4. Calculate the margin based on the contract value
5. Give a clear BID / NO BID recommendation

Always respond in this exact JSON format:
{
  "product_identified": "specific product name",
  "quantity": "quantity if mentioned or unknown",
  "estimated_unit_cost": 0.00,
  "estimated_unit_price": 0.00,
  "estimated_margin_pct": 0.0,
  "estimated_total_margin": 0.00,
  "recommended_bid_price": 0.00,
  "top_suppliers": [
    {"name": "Supplier name", "price": 0.00, "url": "url if found"}
  ],
  "verdict": "BID" or "NO BID" or "INVESTIGATE",
  "verdict_reason": "One sentence explanation",
  "risks": ["risk 1", "risk 2"],
  "next_steps": ["step 1", "step 2"]
}

If you cannot determine pricing, set estimated_unit_cost to null and explain in verdict_reason.
Return ONLY the JSON, no other text."""

        ac = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        response = ac.beta.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            system=system,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=messages,
            betas=["web-search-2025-03-05"]
        )

        full_text = ""
        for block in response.content:
            if hasattr(block, "text") and block.text is not None:
                full_text += block.text

        clean = full_text.strip().replace("```json", "").replace("```", "").strip()
        analysis = json.loads(clean)
        return {"analysis": analysis}

    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"ANALYZE ERROR: {error_detail}")
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

@app.get("/memories")
def get_user_memories(user=Depends(get_current_user)):
    try:
        from memory import get_memories
        user_id = user.get("sub") or user.get("email")
        memories = get_memories(user_id)
        return {"memories": memories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/memories/{memory_id}")
def delete_user_memory(memory_id: str, user=Depends(get_current_user)):
    try:
        from memory import delete_memory
        user_id = user.get("sub") or user.get("email")
        delete_memory(memory_id, user_id)
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
