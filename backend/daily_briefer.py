import yfinance as yf
import anthropic
import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_APP_PASSWORD = os.getenv("EMAIL_APP_PASSWORD")

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# ── TICKERS ───────────────────────────────────────────────────────

TICKERS = {
    "Markets Overview": ["^GSPC", "^VIX", "^TNX", "DX-Y.NYB"],
    "Supply Chain & Advanced Manufacturing": ["MP", "XLI", "CAT", "GFF", "KTOS", "AXON"],
    "Defense & Aerospace": ["ITA", "LMT", "RTX", "NOC"],
    "Energy Independence & Resilience": ["XLE", "XOP", "NEE", "CL=F"],
    "Frontier & Strategic Technologies": ["XLK", "SOXX", "ARKK", "PLTR"],
    "Pharma & Health": ["XLV", "XBI", "JNJ", "PFE"],
}

# ── FETCH MARKET DATA ─────────────────────────────────────────────

def fetch_market_data():
    all_tickers = []
    for tickers in TICKERS.values():
        all_tickers.extend(tickers)

    data = {}
    for ticker in all_tickers:
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period="2d")
            if len(hist) >= 2:
                prev_close = hist['Close'].iloc[-2]
                curr_close = hist['Close'].iloc[-1]
                change_pct = ((curr_close - prev_close) / prev_close) * 100
                data[ticker] = {
                    "price": round(curr_close, 2),
                    "change_pct": round(change_pct, 2),
                    "direction": "up" if change_pct >= 0 else "down"
                }
            else:
                data[ticker] = {"price": "N/A", "change_pct": 0, "direction": "flat"}
        except Exception as e:
            data[ticker] = {"price": "N/A", "change_pct": 0, "direction": "flat"}
    return data

# ── FORMAT MARKET DATA FOR PROMPT ────────────────────────────────

def format_market_data(market_data):
    lines = []
    for sector, tickers in TICKERS.items():
        lines.append(f"\n{sector}:")
        for ticker in tickers:
            d = market_data.get(ticker, {})
            price = d.get("price", "N/A")
            chg = d.get("change_pct", 0)
            arrow = "▲" if chg >= 0 else "▼"
            lines.append(f"  {ticker}: ${price} {arrow} {chg:+.2f}%")
    return "\n".join(lines)

# ── GENERATE BRIEF VIA CLAUDE ─────────────────────────────────────

def generate_brief(market_data_text):
    today = datetime.now().strftime("%A, %B %d, %Y")

    prompt = f"""
Today is {today}. You are generating the morning intelligence brief for Patrick Devine,
a mid-20s financial analyst focused on JP Morgan's Security and Resilience Initiative sectors.

Here is today's live market data:
{market_data_text}

Generate a morning brief with EXACTLY this structure. Each section gets exactly 3 bullet points.
Each bullet is ONE sentence of fact followed by ONE sentence of why it matters. Be specific, not generic.

Format it exactly like this:

MARKETS
- [fact]. [why it matters].
- [fact]. [why it matters].
- [fact]. [why it matters].

GEOPOLITICS & US STRATEGIC POSITION
- [fact]. [why it matters].
- [fact]. [why it matters].
- [fact]. [why it matters].

SUPPLY CHAIN & ADVANCED MANUFACTURING
- [fact]. [why it matters].
- [fact]. [why it matters].
- [fact]. [why it matters].

DEFENSE & AEROSPACE
- [fact]. [why it matters].
- [fact]. [why it matters].
- [fact]. [why it matters].

ENERGY INDEPENDENCE & RESILIENCE
- [fact]. [why it matters].
- [fact]. [why it matters].
- [fact]. [why it matters].

FRONTIER & STRATEGIC TECHNOLOGIES
- [fact]. [why it matters].
- [fact]. [why it matters].
- [fact]. [why it matters].

PHARMA & HEALTH
- [fact]. [why it matters].
- [fact]. [why it matters].
- [fact]. [why it matters].

DEALS & TRANSACTIONS
- [fact]. [why it matters].
- [fact]. [why it matters].
- [fact]. [why it matters].

THE TAKE
[One paragraph from Strategos. Forward-looking, opinionated, specific. What matters today and why. What should Patrick be watching. What is the implication for deals in these sectors. Do not summarize the above — add new insight.]

PLATFORM IDEAS — FROM STRATEGOS
[Three specific, actionable ideas for improving or expanding the Devine Intelligence Network platform. Think about new agents, new data sources, new workflows, new features. Be creative and ambitious. Each idea in 2-3 sentences explaining what it is and why it would be valuable.]
"""

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text

# ── FORMAT AS HTML EMAIL ──────────────────────────────────────────

def format_html_email(brief_text, market_data):
    today = datetime.now().strftime("%A, %B %d, %Y")

    # Parse sections from brief text
    sections = brief_text.strip().split('\n\n')

    # Build market ticker bar
    ticker_html = ""
    key_tickers = ["^GSPC", "^VIX", "^TNX", "ITA", "XLE", "XLK", "XLV", "MP"]
    for ticker in key_tickers:
        d = market_data.get(ticker, {})
        price = d.get("price", "N/A")
        chg = d.get("change_pct", 0)
        color = "#2a7a4a" if chg >= 0 else "#c0341a"
        arrow = "▲" if chg >= 0 else "▼"
        ticker_html += f"""
        <td style="padding: 8px 16px; border-right: 1px solid #e8e4dc; text-align: center;">
            <div style="font-family: 'Courier New', monospace; font-size: 9px; color: #8a8880; letter-spacing: 0.1em; margin-bottom: 3px;">{ticker.replace('^','')}</div>
            <div style="font-family: 'Courier New', monospace; font-size: 13px; color: #1a1a18; font-weight: 500;">${price}</div>
            <div style="font-family: 'Courier New', monospace; font-size: 10px; color: {color};">{arrow} {chg:+.2f}%</div>
        </td>
        """

    # Parse and render brief sections
    content_html = ""
    current_section = ""
    current_bullets = []

    section_colors = {
        "MARKETS": "#c8a96e",
        "GEOPOLITICS": "#8a6a9a",
        "SUPPLY CHAIN": "#4a7a5a",
        "DEFENSE": "#4a5a8a",
        "ENERGY": "#8a6a4a",
        "FRONTIER": "#4a7a8a",
        "PHARMA": "#7a4a6a",
        "DEALS": "#6a6a6a",
        "THE TAKE": "#1a1a18",
        "PLATFORM IDEAS": "#1a4060",
    }

    def get_section_color(title):
        for key, color in section_colors.items():
            if key in title.upper():
                return color
        return "#1a1a18"

    lines = brief_text.strip().split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        is_header = (
            line.isupper() or
            line.startswith("THE TAKE") or
            line.startswith("PLATFORM IDEAS")
        )

        if is_header and not line.startswith('•'):
            if current_section:
                color = get_section_color(current_section)
                bullets_html = "".join([
                    f'<p style="margin: 0 0 10px 0; padding-left: 16px; border-left: 2px solid {color}20; font-size: 13px; color: #1a1a18; line-height: 1.7;">{b}</p>'
                    for b in current_bullets
                ])
                content_html += f"""
                <div style="margin-bottom: 28px;">
                    <div style="font-family: 'Courier New', monospace; font-size: 9px; font-weight: 600; letter-spacing: 0.2em; color: {color}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e8e4dc;">{current_section}</div>
                    {bullets_html}
                </div>
                """
            current_section = line
            current_bullets = []
        elif line.startswith('•') or line.startswith('-'):
            current_bullets.append(line.lstrip('•- ').strip())
        elif current_section and not is_header:
            current_bullets.append(line)

        i += 1

    # Add last section
    if current_section:
        color = get_section_color(current_section)
        is_paragraph = current_section.startswith("THE TAKE") or current_section.startswith("PLATFORM")
        if is_paragraph:
            para_text = " ".join(current_bullets)
            bullets_html = f'<p style="margin: 0; font-size: 13px; color: #1a1a18; line-height: 1.8;">{para_text}</p>'
        else:
            bullets_html = "".join([
                f'<p style="margin: 0 0 10px 0; padding-left: 16px; border-left: 2px solid {color}20; font-size: 13px; color: #1a1a18; line-height: 1.7;">{b}</p>'
                for b in current_bullets
            ])
        content_html += f"""
        <div style="margin-bottom: 28px;">
            <div style="font-family: 'Courier New', monospace; font-size: 9px; font-weight: 600; letter-spacing: 0.2em; color: {color}; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e8e4dc;">{current_section}</div>
            {bullets_html}
        </div>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; background-color: #faf9f6; font-family: 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 640px; margin: 0 auto; background-color: #faf9f6;">

            <!-- HEADER -->
            <div style="background-color: #1a1a18; padding: 32px 36px;">
                <div style="font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: 0.2em; text-transform: uppercase; color: #3a3830; margin-bottom: 8px;">Morning Intelligence Brief</div>
                <div style="font-size: 22px; font-weight: 600; color: #faf9f6; letter-spacing: -0.01em; margin-bottom: 4px;">Devine Intelligence Network</div>
                <div style="font-family: 'Courier New', monospace; font-size: 10px; color: #4a4840; letter-spacing: 0.1em;">{today}</div>
                <div style="width: 24px; height: 1px; background: #c8a96e; margin-top: 16px;"></div>
            </div>

            <!-- TICKER BAR -->
            <div style="background-color: #fff; border-bottom: 1px solid #e8e4dc; overflow-x: auto;">
                <table style="border-collapse: collapse; width: 100%;">
                    <tr>{ticker_html}</tr>
                </table>
            </div>

            <!-- CONTENT -->
            <div style="padding: 36px;">
                {content_html}
            </div>

            <!-- FOOTER -->
            <div style="padding: 24px 36px; border-top: 1px solid #e8e4dc; background: #fff;">
                <div style="font-family: 'Courier New', monospace; font-size: 9px; color: #c8c4bc; letter-spacing: 0.1em;">DEVINE INTELLIGENCE NETWORK · PRIVATE PLATFORM · {today.upper()}</div>
            </div>

        </div>
    </body>
    </html>
    """
    return html

# ── SEND EMAIL ────────────────────────────────────────────────────

def send_email(html_content):
    to_address = os.getenv("EMAIL_TO", EMAIL_ADDRESS)
    msg = MIMEMultipart('alternative')
    msg['Subject'] = f"DIN Morning Brief — {datetime.now().strftime('%B %d, %Y')}"
    msg['From'] = EMAIL_ADDRESS
    msg['To'] = to_address

    html_part = MIMEText(html_content, 'html')
    msg.attach(html_part)

    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(EMAIL_ADDRESS, EMAIL_APP_PASSWORD)
        server.sendmail(EMAIL_ADDRESS, to_address, msg.as_string())

# ── MAIN FUNCTION ─────────────────────────────────────────────────

def run_daily_briefer():
    print(f"Running Daily Briefer at {datetime.now()}")
    try:
        print("Fetching market data...")
        market_data = fetch_market_data()
        market_data_text = format_market_data(market_data)

        print("Generating brief via Claude...")
        brief_text = generate_brief(market_data_text)

        print("Formatting email...")
        html_content = format_html_email(brief_text, market_data)

        print("Sending email...")
        send_email(html_content)

        print("Daily brief sent successfully.")
        return True
    except Exception as e:
        print(f"Error running daily briefer: {e}")
        raise e

if __name__ == "__main__":
    run_daily_briefer()