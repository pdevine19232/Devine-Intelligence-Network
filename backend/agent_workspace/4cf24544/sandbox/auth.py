from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import httpx
import jwt
from jwt import PyJWKClient
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    try:
        jwks_client = PyJWKClient(JWKS_URL)
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "HS256"],
            options={"verify_aud": False}
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth error: {str(e)}")

def require_admin(user=Depends(get_current_user)):
    role = user.get("user_metadata", {}).get("role")
    if role != "admin":
        raise HTTPException(
            status_code=403, detail="Admin access required"
        )
    return user
