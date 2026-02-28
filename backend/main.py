from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from auth import get_current_user, require_admin

app = FastAPI(title="Devine Intelligence Network")

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

@app.get("/")
def root():
    return {"status": "Devine Intelligence Network is running"}

@app.get("/protected")
def protected_route(user=Depends(get_current_user)):
    return {"message": f"Hello {user['email']}, you are logged in"}

@app.get("/admin-only")
def admin_route(user=Depends(require_admin)):
    return {"message": f"Hello Admin {user['email']}"}