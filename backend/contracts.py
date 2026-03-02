import os
import json
import requests
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SAM_API_KEY = os.getenv("SAM_API_KEY")
SAM_BASE_URL = "https://api.sam.gov/prod/opportunities/v2/search"

# Cache settings
CACHE_DIR = Path(__file__).parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)
CACHE_FILE = CACHE_DIR / "opportunities_cache.json"
CACHE_TTL_HOURS = 12  # How long cache stays fresh
MAX_DAILY_CALLS = 8   # Leave 2 buffer from the 10/day limit

# Track API usage
USAGE_FILE = CACHE_DIR / "api_usage.json"

TARGET_NAICS = [
    "332", "333", "334", "336",
    "332710", "332720", "332810", "332900",
    "333510", "333610", "333910",
    "336410", "336412", "336413",
    "484", "488", "493",
    "541330", "541380", "541990",
    "238", "332311", "332312",
]

SMALL_BIZ_SET_ASIDES = ["SBA", "8A", "HZC", "SDVOSBC", "WOSB", "EDWOSB"]


# ─── API USAGE TRACKING ─────────────────────────────────────────────────────

def get_api_usage():
    """Track how many API calls we've made today"""
    try:
        if USAGE_FILE.exists():
            data = json.loads(USAGE_FILE.read_text())
            if data.get("date") == datetime.now().strftime("%Y-%m-%d"):
                return data
        return {"date": datetime.now().strftime("%Y-%m-%d"), "calls": 0}
    except:
        return {"date": datetime.now().strftime("%Y-%m-%d"), "calls": 0}


def record_api_call():
    """Record that we made an API call"""
    usage = get_api_usage()
    usage["calls"] += 1
    usage["last_call"] = datetime.now().isoformat()
    try:
        USAGE_FILE.write_text(json.dumps(usage, indent=2))
    except:
        pass


def can_make_api_call():
    """Check if we have API calls remaining today"""
    usage = get_api_usage()
    return usage["calls"] < MAX_DAILY_CALLS


# ─── CACHE MANAGEMENT ───────────────────────────────────────────────────────

def get_cache_info():
    """Get cache metadata"""
    if not CACHE_FILE.exists():
        return None
    try:
        data = json.loads(CACHE_FILE.read_text())
        cached_at = datetime.fromisoformat(data.get("cached_at", "2000-01-01"))
        age_hours = (datetime.now() - cached_at).total_seconds() / 3600
        return {
            "cached_at": data.get("cached_at"),
            "age_hours": round(age_hours, 1),
            "count": len(data.get("opportunities", [])),
            "is_fresh": age_hours < CACHE_TTL_HOURS,
            "filters": data.get("filters", {}),
        }
    except:
        return None


def read_cache():
    """Read cached opportunities"""
    try:
        if not CACHE_FILE.exists():
            return None
        data = json.loads(CACHE_FILE.read_text())
        cached_at = datetime.fromisoformat(data.get("cached_at", "2000-01-01"))
        age_hours = (datetime.now() - cached_at).total_seconds() / 3600
        if age_hours > CACHE_TTL_HOURS:
            print(f"Cache expired ({age_hours:.1f}h old, TTL={CACHE_TTL_HOURS}h)")
            return None
        print(f"Using cache ({age_hours:.1f}h old, {len(data.get('opportunities', []))} records)")
        return data.get("opportunities", [])
    except Exception as e:
        print(f"Cache read error: {e}")
        return None


def write_cache(opportunities, filters=None):
    """Write opportunities to cache"""
    try:
        data = {
            "cached_at": datetime.now().isoformat(),
            "filters": filters or {},
            "count": len(opportunities),
            "opportunities": opportunities,
        }
        CACHE_FILE.write_text(json.dumps(data, indent=2, default=str))
        print(f"Cached {len(opportunities)} opportunities")
    except Exception as e:
        print(f"Cache write error: {e}")


# ─── SAM.GOV API ────────────────────────────────────────────────────────────

def get_date_range(days_back=30):
    end = datetime.now()
    start = end - timedelta(days=days_back)
    return start.strftime("%m/%d/%Y"), end.strftime("%m/%d/%Y")


def format_currency(value):
    if not value:
        return None
    try:
        v = float(str(value).replace(",", "").replace("$", ""))
        if v >= 1_000_000:
            return f"${v/1_000_000:.1f}M"
        if v >= 1_000:
            return f"${v/1_000:.0f}K"
        return f"${v:,.0f}"
    except:
        return str(value)


def fetch_description_text(url):
    """Fetch and parse description HTML from SAM.gov"""
    try:
        res = requests.get(url, timeout=8)
        if not res.ok:
            return None
        content_type = res.headers.get("content-type", "")
        if "html" in content_type or res.text.strip().startswith("<"):
            try:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(res.text, "html.parser")
                text = soup.get_text(separator="\n", strip=True)
                lines = [l for l in text.splitlines() if l.strip()]
                return "\n".join(lines)
            except:
                return res.text[:2000]
        return res.text[:2000]
    except Exception as e:
        print(f"Description fetch error: {e}")
        return None


def fetch_opportunities_from_api(naics_code=None, set_aside=None, limit=25, days_back=30, keyword=None):
    """Fetch directly from SAM.gov API (uses an API call)"""

    if not SAM_API_KEY:
        print("ERROR: SAM_API_KEY not set in .env")
        return [], "SAM_API_KEY not configured. Add it to your backend .env file."

    if not can_make_api_call():
        usage = get_api_usage()
        print(f"Rate limit: {usage['calls']}/{MAX_DAILY_CALLS} calls used today")
        return [], f"Daily API limit reached ({usage['calls']}/{MAX_DAILY_CALLS} calls used). Cache will serve existing data. Resets at midnight UTC."

    posted_from, posted_to = get_date_range(days_back)

    params = {
        "api_key": SAM_API_KEY,
        "limit": limit,
        "offset": 0,
        "postedFrom": posted_from,
        "postedTo": posted_to,
        "ptype": "o,p,k",
        "active": "true",
    }

    if naics_code:
        params["naicsCode"] = naics_code
    if set_aside:
        params["typeOfSetAside"] = set_aside
    if keyword:
        params["title"] = keyword

    try:
        print(f"Calling SAM.gov API (call #{get_api_usage()['calls'] + 1} today)...")
        res = requests.get(SAM_BASE_URL, params=params, timeout=15)

        # Track the call regardless of outcome
        record_api_call()

        if res.status_code == 429:
            error_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
            next_access = error_data.get("nextAccessTime", "midnight UTC")
            msg = f"SAM.gov rate limit hit. Access resumes: {next_access}"
            print(f"SAM API status: 429")
            print(f"SAM API error body: {res.text}")
            return [], msg

        if res.status_code == 403:
            return [], "SAM.gov API key is invalid or expired. Regenerate it at sam.gov/profile/details."

        res.raise_for_status()
        data = res.json()
        opportunities = data.get("opportunitiesData", [])
        print(f"SAM.gov returned {len(opportunities)} opportunities")
        return opportunities, None

    except requests.exceptions.Timeout:
        return [], "SAM.gov request timed out. Try again in a moment."
    except requests.exceptions.ConnectionError:
        return [], "Cannot connect to SAM.gov. Check your internet connection."
    except Exception as e:
        print(f"SAM API error: {e}")
        return [], f"SAM.gov API error: {str(e)}"


# ─── SCORING ────────────────────────────────────────────────────────────────

def score_opportunity(opp):
    score = 50
    reasons = []

    set_aside = opp.get("typeOfSetAside", "") or ""
    set_aside_desc = opp.get("typeOfSetAsideDescription", "") or ""
    if any(code in set_aside for code in SMALL_BIZ_SET_ASIDES):
        score += 20
        reasons.append(f"Small business set-aside ({set_aside_desc})")

    deadline = opp.get("responseDeadLine")
    if deadline:
        try:
            dl = datetime.fromisoformat(deadline.replace("Z", ""))
            days_left = (dl - datetime.now()).days
            if 7 <= days_left <= 21:
                score += 15
                reasons.append(f"{days_left} days to respond — good timeline")
            elif days_left < 7:
                score += 5
                reasons.append(f"Only {days_left} days left — tight")
            elif days_left > 30:
                score -= 5
                reasons.append(f"{days_left} days out — early stage")
        except:
            pass

    naics = opp.get("naicsCode", "") or ""
    for target in TARGET_NAICS:
        if naics.startswith(target[:3]):
            score += 10
            reasons.append(f"NAICS {naics} matches target sector")
            break

    base_type = opp.get("baseType", "") or ""
    if "Combined" in base_type or "Synopsis" in base_type:
        score += 10
        reasons.append("Combined synopsis — streamlined response")

    dept = opp.get("department", "") or ""
    if any(d in dept for d in ["DEFENSE", "ARMY", "NAVY", "AIR FORCE"]):
        score += 5
        reasons.append("DoD contract — reliable payer")
    elif "GSA" in dept:
        score += 8
        reasons.append("GSA — fastest payment cycles")

    award = opp.get("award") or {}
    if award.get("amount"):
        score += 5
        reasons.append("Contract value disclosed")

    score = max(0, min(100, score))
    return score, reasons


# ─── PARSING ────────────────────────────────────────────────────────────────

def parse_opportunity(opp):
    score, reasons = score_opportunity(opp)

    deadline_raw = opp.get("responseDeadLine")
    deadline_str = None
    days_left = None
    if deadline_raw:
        try:
            dl = datetime.fromisoformat(deadline_raw.replace("Z", ""))
            deadline_str = dl.strftime("%b %d, %Y")
            days_left = (dl - datetime.now()).days
        except:
            deadline_str = deadline_raw

    contacts = opp.get("pointOfContact", []) or []
    primary_contact = next((c for c in contacts if c.get("type") == "primary"), None)
    contact_email = primary_contact.get("email") if primary_contact else None
    contact_name = primary_contact.get("fullName") if primary_contact else None

    award = opp.get("award") or {}
    contract_value = None
    if award.get("amount"):
        contract_value = format_currency(award["amount"])
    elif opp.get("estimatedTotalValue"):
        contract_value = format_currency(opp["estimatedTotalValue"])

    award_date = award.get("date")
    awardee = None
    awardee_info = award.get("awardee") or {}
    if awardee_info.get("name"):
        awardee = awardee_info["name"]

    raw_desc = opp.get("description") or opp.get("synopsis") or None
    description = None
    if raw_desc:
        if raw_desc.strip().startswith("http"):
            description = fetch_description_text(raw_desc.strip())
        else:
            description = raw_desc

    resource_links = opp.get("resourceLinks") or []
    attachments = []
    for link in resource_links:
        if isinstance(link, dict):
            url = link.get("url") or link.get("link") or ""
            name = link.get("name") or url.split("/")[-1] or "Document"
            if url:
                attachments.append({"name": name, "url": url})
        elif isinstance(link, str) and link.startswith("http"):
            attachments.append({
                "name": link.split("/")[-1] or "Document",
                "url": link
            })

    pop = opp.get("placeOfPerformance") or {}
    location = None
    if pop:
        city = (pop.get("city") or {}).get("name", "")
        state = (pop.get("state") or {}).get("code", "")
        if city and state:
            location = f"{city}, {state}"
        elif state:
            location = state

    return {
        "id": opp.get("noticeId"),
        "title": opp.get("title"),
        "agency": opp.get("department"),
        "sub_agency": opp.get("subTier"),
        "office": opp.get("office"),
        "posted_date": opp.get("postedDate"),
        "deadline": deadline_str,
        "days_left": days_left,
        "naics": opp.get("naicsCode"),
        "set_aside": opp.get("typeOfSetAsideDescription"),
        "type": opp.get("baseType"),
        "solicitation_number": opp.get("solicitationNumber"),
        "contact_email": contact_email,
        "contact_name": contact_name,
        "score": score,
        "score_reasons": reasons,
        "sam_url": f"https://sam.gov/opp/{opp.get('noticeId')}/view",
        "active": opp.get("active") == "Yes",
        "contract_value": contract_value,
        "award_date": award_date,
        "awardee": awardee,
        "description": description,
        "attachments": attachments,
        "location": location,
    }


# ─── MAIN ENTRY POINT ──────────────────────────────────────────────────────

def get_opportunities(naics_filter=None, set_aside_filter=None, keyword=None, days_back=30):
    """
    Get opportunities — uses cache when fresh, fetches from API when stale.
    Returns (opportunities_list, error_message_or_none)
    """
    api_error = None

    # Check if we have fresh cache
    cached = read_cache()
    if cached is not None:
        print(f"Serving {len(cached)} opportunities from cache")
        parsed = cached  # Cache stores already-parsed data
        # Apply client-side filters on cached data
        if naics_filter:
            parsed = [p for p in parsed if p.get("naics", "").startswith(naics_filter)]
        if set_aside_filter:
            parsed = [p for p in parsed if set_aside_filter.lower() in (p.get("set_aside") or "").lower()]
        if keyword:
            kw = keyword.lower()
            parsed = [p for p in parsed if kw in (p.get("title") or "").lower() or kw in (p.get("description") or "").lower()]
        parsed.sort(key=lambda x: x.get("score", 0), reverse=True)
        return parsed, None

    # No fresh cache — fetch from API
    print("Cache miss — fetching from SAM.gov...")
    raw, api_error = fetch_opportunities_from_api(
        naics_code=naics_filter,
        set_aside=set_aside_filter,
        keyword=keyword,
        days_back=days_back,
        limit=25,
    )

    if not raw and api_error:
        # API failed — try serving stale cache as fallback
        try:
            if CACHE_FILE.exists():
                data = json.loads(CACHE_FILE.read_text())
                stale = data.get("opportunities", [])
                if stale:
                    age = data.get("cached_at", "unknown")
                    print(f"Serving stale cache from {age} as fallback")
                    return stale, f"Showing cached data (from {age}). {api_error}"
        except:
            pass
        return [], api_error

    # Parse and cache the fresh results
    parsed = [parse_opportunity(o) for o in raw]
    parsed.sort(key=lambda x: x["score"], reverse=True)
    write_cache(parsed, filters={"days_back": days_back})

    return parsed, None


def get_cache_status():
    """Return cache status for the API"""
    info = get_cache_info()
    usage = get_api_usage()
    return {
        "cache": info,
        "api_usage": {
            "calls_today": usage["calls"],
            "max_daily": MAX_DAILY_CALLS,
            "remaining": max(0, MAX_DAILY_CALLS - usage["calls"]),
        },
    }