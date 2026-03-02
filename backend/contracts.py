import os
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

SAM_API_KEY = os.getenv("SAM_API_KEY")
SAM_BASE_URL = "https://api.sam.gov/prod/opportunities/v2/search"

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

def fetch_opportunities(naics_code=None, set_aside=None, limit=25, days_back=30, keyword=None):
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
        res = requests.get(SAM_BASE_URL, params=params, timeout=15)
        res.raise_for_status()
        data = res.json()
        return data.get("opportunitiesData", [])
    except Exception as e:
        print(f"SAM API error: {e}")
        return []

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

    # Bonus if contract value is listed
    award = opp.get("award") or {}
    if award.get("amount"):
        score += 5
        reasons.append("Contract value disclosed")

    score = max(0, min(100, score))
    return score, reasons

def parse_opportunity(opp):
    score, reasons = score_opportunity(opp)
    
    # Parse deadline
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

    # Contact info
    contacts = opp.get("pointOfContact", []) or []
    primary_contact = next((c for c in contacts if c.get("type") == "primary"), None)
    contact_email = primary_contact.get("email") if primary_contact else None
    contact_name = primary_contact.get("fullName") if primary_contact else None

    # Contract value — from award block or estimatedTotalValue
    award = opp.get("award") or {}
    contract_value = None
    if award.get("amount"):
        contract_value = format_currency(award["amount"])
    elif opp.get("estimatedTotalValue"):
        contract_value = format_currency(opp["estimatedTotalValue"])

    # Award date and winner
    award_date = award.get("date")
    awardee = None
    awardee_info = award.get("awardee") or {}
    if awardee_info.get("name"):
        awardee = awardee_info["name"]

    # Description
    description = opp.get("description") or opp.get("synopsis") or None

    # Attachments / resource links
    resource_links = opp.get("resourceLinks") or []
    attachments = []
    for link in resource_links:
        if isinstance(link, dict):
            attachments.append({
                "name": link.get("name") or link.get("url", "").split("/")[-1] or "Document",
                "url": link.get("url") or link.get("link")
            })
        elif isinstance(link, str):
            attachments.append({
                "name": link.split("/")[-1] or "Document",
                "url": link
            })

    # Place of performance
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

def get_opportunities(naics_filter=None, set_aside_filter=None, keyword=None, days_back=30):
    raw = fetch_opportunities(
        naics_code=naics_filter,
        set_aside=set_aside_filter,
        keyword=keyword,
        days_back=days_back,
        limit=25
    )
    parsed = [parse_opportunity(o) for o in raw]
    parsed.sort(key=lambda x: x["score"], reverse=True)
    return parsed