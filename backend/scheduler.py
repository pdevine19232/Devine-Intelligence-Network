import schedule
import time
import pytz
from datetime import datetime
from daily_briefer import run_daily_briefer

NEW_YORK = pytz.timezone('America/New_York')

def job():
    now = datetime.now(NEW_YORK)
    print(f"Running scheduled brief at {now}")
    run_daily_briefer()

# Schedule for 6:30am New York time every day
schedule.every().day.at("11:30").do(job)  # 11:30 UTC = 6:30 EST

print("Scheduler started. Waiting for 6:30am EST...")

while True:
    schedule.run_pending()
    time.sleep(60)