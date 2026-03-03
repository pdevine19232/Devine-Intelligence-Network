import sqlite3

conn = sqlite3.connect('agent_tasks.db')
conn.execute("UPDATE agent_tasks SET status='cancelled' WHERE id='b8febeb0'")
conn.commit()

rows = conn.execute("SELECT id, status, title FROM agent_tasks ORDER BY rowid DESC LIMIT 5").fetchall()
for row in rows:
    print(row)

conn.close()
print("Done.")