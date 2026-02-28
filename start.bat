@echo off
echo Starting Devine Intelligence Network...

start "Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn main:app --reload"

timeout /t 3

start "Frontend" cmd /k "cd frontend && npm start"

echo Both servers starting...