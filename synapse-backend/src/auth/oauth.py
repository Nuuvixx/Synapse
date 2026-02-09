"""
OAuth Handler
Handles GitHub and Google OAuth flows
"""
import os
from typing import Optional, Dict, Any
import httpx


# GitHub OAuth Configuration
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:3000/auth/github/callback")

# Google OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:3000/auth/google/callback")


class OAuthHandler:
    """Handles OAuth flows for external providers"""
    
    @staticmethod
    def get_github_auth_url(state: Optional[str] = None) -> str:
        """Generate GitHub OAuth authorization URL"""
        params = {
            "client_id": GITHUB_CLIENT_ID,
            "redirect_uri": GITHUB_REDIRECT_URI,
            "scope": "user:email",
        }
        if state:
            params["state"] = state
        
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://github.com/login/oauth/authorize?{query}"
    
    @staticmethod
    async def exchange_github_code(code: str) -> Dict[str, Any]:
        """Exchange GitHub authorization code for access token and user info"""
        async with httpx.AsyncClient() as client:
            # Exchange code for access token
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": GITHUB_REDIRECT_URI
                },
                headers={"Accept": "application/json"}
            )
            token_data = token_response.json()
            
            if "error" in token_data:
                raise ValueError(f"GitHub OAuth error: {token_data.get('error_description', token_data['error'])}")
            
            access_token = token_data["access_token"]
            
            # Fetch user info
            user_response = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json"
                }
            )
            user_data = user_response.json()
            
            # Fetch user email (may be private)
            email_response = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json"
                }
            )
            emails = email_response.json()
            
            # Find primary email
            primary_email = None
            for email in emails:
                if email.get("primary") and email.get("verified"):
                    primary_email = email["email"]
                    break
            
            if not primary_email and emails:
                primary_email = emails[0]["email"]
            
            return {
                "provider": "github",
                "provider_id": str(user_data["id"]),
                "email": primary_email or user_data.get("email"),
                "name": user_data.get("name") or user_data.get("login"),
                "avatar_url": user_data.get("avatar_url"),
                "access_token": access_token
            }
    
    @staticmethod
    def get_google_auth_url(state: Optional[str] = None) -> str:
        """Generate Google OAuth authorization URL"""
        params = {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "scope": "openid email profile",
            "response_type": "code",
            "access_type": "offline"
        }
        if state:
            params["state"] = state
        
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"
    
    @staticmethod
    async def exchange_google_code(code: str) -> Dict[str, Any]:
        """Exchange Google authorization code for access token and user info"""
        async with httpx.AsyncClient() as client:
            # Exchange code for access token
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code"
                }
            )
            token_data = token_response.json()
            
            if "error" in token_data:
                raise ValueError(f"Google OAuth error: {token_data.get('error_description', token_data['error'])}")
            
            access_token = token_data["access_token"]
            
            # Fetch user info
            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            user_data = user_response.json()
            
            return {
                "provider": "google",
                "provider_id": user_data["id"],
                "email": user_data["email"],
                "name": user_data.get("name"),
                "avatar_url": user_data.get("picture"),
                "access_token": access_token
            }
