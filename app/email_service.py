"""Real email delivery service using Resend HTTPS API."""

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger("rakshak")

RESEND_API_URL = "https://api.resend.com/emails"


def get_resend_config() -> tuple[str | None, str, str]:
    """Retrieve Resend and verification URL configuration from environment."""
    api_key = os.getenv("RESEND_API_KEY")
    email_from = os.getenv("EMAIL_FROM", "Rakshak Security <auth@rakshak.dev>")
    base_url = os.getenv("EMAIL_VERIFICATION_BASE_URL", "http://127.0.0.1:5173/verify-email")
    return api_key, email_from, base_url


def is_email_service_configured() -> bool:
    """Check whether Resend API key and sender email are present."""
    api_key, email_from, _ = get_resend_config()
    return bool(api_key and email_from)


def send_verification_email(
    to_email: str,
    raw_token: str,
    user_name: str | None = None,
) -> dict:
    """Dispatch a genuine email verification message via Resend HTTPS API.

    Args:
        to_email: Target recipient mailbox.
        raw_token: Unhashed CSPRNG token (sent ONLY in the link).
        user_name: Optional display name of the user.

    Returns:
        dict: {"success": bool, "id": str | None, "error": str | None}
    """
    api_key, email_from, base_url = get_resend_config()

    if not api_key:
        logger.error("[EmailService] RESEND_API_KEY is not configured in environment.")
        return {
            "success": False,
            "error": "Email delivery service is not configured (RESEND_API_KEY is missing).",
        }

    verification_link = f"{base_url.rstrip('/')}?token={urllib.parse.quote(raw_token)}"
    display_greeting = f"Hi {user_name}," if user_name else "Hello,"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify your email - Rakshak Security</title>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #06000E; color: #F5F3FF; margin: 0; padding: 40px 20px; }}
        .container {{ max-width: 560px; margin: 0 auto; background-color: #12051F; border: 1px solid #2A1240; border-radius: 16px; padding: 32px; }}
        .header {{ text-align: center; margin-bottom: 24px; }}
        .logo {{ font-size: 22px; font-weight: 900; letter-spacing: 2px; color: #FFFFFF; }}
        .title {{ font-size: 20px; font-weight: 700; color: #FFFFFF; margin-top: 16px; }}
        .text {{ font-size: 14px; line-height: 1.6; color: #D4D4D8; margin: 16px 0; }}
        .btn-container {{ text-align: center; margin: 32px 0; }}
        .btn {{ display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #EC4899 100%); color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4); }}
        .link-text {{ word-break: break-all; font-size: 12px; color: #A855F7; }}
        .footer {{ font-size: 12px; color: #71717A; margin-top: 32px; border-top: 1px solid #2A1240; padding-top: 16px; text-align: center; }}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">RAKSHAK</div>
          <div class="title">Verify your email address</div>
        </div>
        <p class="text">{display_greeting}</p>
        <p class="text">Thank you for registering with Rakshak AI-Powered DevSecOps Threat Detection Platform. Please click the button below to verify ownership of this mailbox and activate your workspace.</p>
        <div class="btn-container">
          <a href="{verification_link}" class="btn" target="_blank">Verify Email Address</a>
        </div>
        <p class="text">This link is valid for <strong>15 minutes</strong>. If the button above does not work, copy and paste this link into your browser:</p>
        <p class="link-text">{verification_link}</p>
        <div class="footer">
          <p>If you did not sign up for a Rakshak account, you can safely ignore this email.</p>
          <p>&copy; Rakshak DevSecOps Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    """

    plain_content = f"""
    {display_greeting}

    Thank you for registering with Rakshak AI-Powered DevSecOps Threat Detection Platform.

    Please visit the link below to verify ownership of your mailbox and activate your workspace:
    {verification_link}

    This link will expire in 15 minutes.

    If you did not create a Rakshak account, please ignore this email.
    """

    payload = {
        "from": email_from,
        "to": [to_email],
        "subject": "Verify your email - Rakshak Security",
        "html": html_content,
        "text": plain_content,
    }

    req_data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        RESEND_API_URL,
        data=req_data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Rakshak-Security-Platform",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            resp_body = response.read().decode("utf-8")
            data = json.loads(resp_body) if resp_body else {}
            msg_id = data.get("id")
            logger.info("[EmailService] Verification email successfully accepted by Resend (id=%s)", msg_id)
            return {
                "success": True,
                "id": msg_id,
                "error": None,
            }
    except urllib.error.HTTPError as exc:
        err_msg = exc.read().decode("utf-8") if exc.fp else str(exc)
        logger.error("[EmailService] Resend API rejected email dispatch: HTTP %s - %s", exc.code, err_msg)
        return {
            "success": False,
            "id": None,
            "error": f"Email delivery provider error: HTTP {exc.code}",
        }
    except Exception as exc:
        logger.error("[EmailService] Failed to dispatch email via Resend: %s", type(exc).__name__)
        return {
            "success": False,
            "id": None,
            "error": f"Failed to reach email delivery provider: {type(exc).__name__}",
        }
