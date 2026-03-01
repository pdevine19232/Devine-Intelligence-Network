/* eslint-disable react-hooks/exhaustive-deps */

import yfinance as yf
from supabase import create_client
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import anthropic

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

METRIC_LABELS = {
    'marketCap': 'Market Cap',
    'trailingPE': 'P/E Ratio',
    'priceToBook': 'P/B Ratio',
    'priceToSales': 'P/S Ratio',
    'revenueGrowth': 'Revenue Growth',
    'operatingMargins': 'Operating Margin',
    'grossMargins': 'Gross Margin',
    'returnOnEquity': 'Return on Equity',
    'debtToEquity': 'Debt/Equity',
    'enterpriseValue': 'Enterprise Value',
}

def format_metric(key, value):
    if value is None:
        return 'N/A'
    if key in ['marketCap', 'enterpriseValue']:
        if value >= 1e12:
            return f'${value/1e12:.1f}T'
        elif value >= 1e9:
            return f'${value/1e9:.1f}B'
        elif value >= 1e6:
            return f'${value/1e6:.1f}M'
        return f'${value:,.0f}'
    if key in ['revenueGrowth', 'operatingMargins', 'grossMargins', 'returnOnEquity']:
        return f'{value*100:.1f}%'
    if key == 'debtToEquity':
        return f'{value:.2f}x'
    if key in ['trailingPE', 'priceToBook', 'priceToSales']:
        return f'{value:.1f}x'
    return str(value)

def get_companies():
    result = supabase.table('companies').select('*').eq('is_active', True).execute()
    return result.data

def get_sectors():
    result = supabase.table('sectors').select('*').execute()
    return result.data

def get_company_snapshot(ticker):
    try:
        t = yf.Ticker(ticker)
        info = t.info
        hist = t.history(period='1d')
        current_price = hist['Close'].iloc[-1] if len(hist) > 0 else None
        prev_close = info.get('previousClose') or info.get('regularMarketPreviousClose')
        change_pct = ((current_price - prev_close) / prev_close * 100) if current_price and prev_close else None

        return {
            'ticker': ticker,
            'price': round(current_price, 2) if current_price else None,
            'change_pct': round(change_pct, 2) if change_pct else None,
            'name': info.get('longName') or info.get('shortName'),
            'marketCap': info.get('marketCap'),
        }
    except Exception as e:
        return {'ticker': ticker, 'price': None, 'change_pct': None, 'name': ticker, 'marketCap': None}

def get_company_detail(ticker):
    try:
        t = yf.Ticker(ticker)
        info = t.info
        hist = t.history(period='1d')
        current_price = hist['Close'].iloc[-1] if len(hist) > 0 else None
        prev_close = info.get('previousClose')
        change_pct = ((current_price - prev_close) / prev_close * 100) if current_price and prev_close else None

        return {
            'ticker': ticker,
            'name': info.get('longName') or info.get('shortName', ticker),
            'price': round(current_price, 2) if current_price else None,
            'change_pct': round(change_pct, 2) if change_pct else None,
            'currency': info.get('currency', 'USD'),
            'exchange': info.get('exchange'),
            'sector': info.get('sector'),
            'industry': info.get('industry'),
            'website': info.get('website'),
            'metrics': {
                'marketCap': info.get('marketCap'),
                'trailingPE': info.get('trailingPE'),
                'priceToBook': info.get('priceToBook'),
                'priceToSales': info.get('priceToSales'),
                'revenueGrowth': info.get('revenueGrowth'),
                'operatingMargins': info.get('operatingMargins'),
                'grossMargins': info.get('grossMargins'),
                'returnOnEquity': info.get('returnOnEquity'),
                'debtToEquity': info.get('debtToEquity'),
                'enterpriseValue': info.get('enterpriseValue'),
            }
        }
    except Exception as e:
        return None

def get_price_history(ticker, period='1y', start=None, end=None):
    print(f"get_price_history called: ticker={ticker}, period={period}, start={start}, end={end}")
    try:
        t = yf.Ticker(ticker)
        if start and end:
            from datetime import datetime, timedelta
            end_dt = datetime.strptime(end, '%Y-%m-%d') + timedelta(days=1)
            hist = t.history(start=start, end=end_dt.strftime('%Y-%m-%d'), period=None)
        else:
            period_map = {
                'ytd': 'ytd',
                '1y': '1y',
                '3y': '3y',
                '5y': '5y',
                '10y': '10y',
            }
            hist = t.history(period=period_map.get(period, '1y'))
        if len(hist) == 0:
            return []
        result = []
        for date, row in hist.iterrows():
            result.append({
                'date': date.strftime('%Y-%m-%d'),
                'close': round(float(row['Close']), 2),
                'volume': int(row['Volume'])
            })
        return result
    except Exception as e:
        print(f"Error fetching history for {ticker}: {e}")
        return []

def get_company_news(ticker):
    try:
        t = yf.Ticker(ticker)
        news = t.news
        if not news:
            return []
        result = []
        for item in news[:5]:
            result.append({
                'title': item.get('title'),
                'publisher': item.get('publisher'),
                'link': item.get('link'),
                'published': item.get('providerPublishTime'),
            })
        return result
    except Exception as e:
        return []

def add_company(ticker, sector):
    try:
        t = yf.Ticker(ticker)
        info = t.info
        name = info.get('longName') or info.get('shortName') or ticker
        description = info.get('longBusinessSummary', '')
        if description and len(description) > 300:
            description = description[:297] + '...'

        result = supabase.table('companies').insert({
            'ticker': ticker.upper(),
            'name': name,
            'sector': sector,
            'description': description,
            'is_active': True
        }).execute()
        return result.data[0]
    except Exception as e:
        raise e

def delete_company(ticker):
    result = supabase.table('companies').delete().eq('ticker', ticker.upper()).execute()
    return result.data

def update_sector_index(sector_name, index_ticker, index_name):
    result = supabase.table('sectors').update({
        'index_ticker': index_ticker,
        'index_name': index_name
    }).eq('name', sector_name).execute()
    return result.data

def update_sector_metrics(sector_name, metrics):
    result = supabase.table('sectors').update({
        'metrics': metrics
    }).eq('name', sector_name).execute()
    return result.data