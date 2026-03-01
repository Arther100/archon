"""
email.py — Admin: Email configuration check + test email + send custom email
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from middleware.auth_middleware import require_permission
from services.email_service import is_email_configured, send_email, _base_template
from services.audit_service import log_audit

router = APIRouter(prefix="/email", tags=["Admin - Email"])


class TestEmailPayload(BaseModel):
    to_email: str


class CustomEmailPayload(BaseModel):
    to_email: str
    subject: str
    title: str
    body: str


@router.get("/config")
def email_config_status(user_ctx: dict = Depends(require_permission("manage_email"))):
    """Check if SMTP email is configured."""
    import os
    return {
        "configured": is_email_configured(),
        "smtp_host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "smtp_port": int(os.getenv("SMTP_PORT", "587")),
        "smtp_user": os.getenv("SMTP_USER", "")[:4] + "****" if os.getenv("SMTP_USER") else "",
        "from_name": os.getenv("SMTP_FROM_NAME", "Blueprint Engine"),
    }


@router.post("/test")
def send_test_email(body: TestEmailPayload, user_ctx: dict = Depends(require_permission("manage_email"))):
    """Send a test email to verify SMTP configuration."""
    if not is_email_configured():
        raise HTTPException(status_code=400, detail="SMTP is not configured. Set SMTP_USER and SMTP_PASSWORD environment variables.")

    test_body = """
    <p>This is a <strong style="color:#f0f4ff;">test email</strong> from Blueprint Engine.</p>
    <div style="padding:12px 16px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:8px;margin:12px 0;">
        <p style="margin:0;color:#4ade80;font-size:13px;">✓ SMTP configuration is working correctly!</p>
    </div>
    <p>Your email notification system is ready to send automated messages.</p>
    """
    success = send_email(body.to_email, "Test Email — Blueprint Engine ✓", _base_template("SMTP Test Successful ✅", test_body))

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send test email. Check SMTP configuration.")

    log_audit(user_ctx["id"], "send_test_email", "email", body.to_email)
    return {"message": f"Test email sent to {body.to_email}"}


@router.post("/send")
def send_custom_email(body: CustomEmailPayload, user_ctx: dict = Depends(require_permission("manage_email"))):
    """Send a custom HTML email to any address."""
    if not is_email_configured():
        raise HTTPException(status_code=400, detail="SMTP is not configured.")

    html = _base_template(body.title, f"<div style='line-height:1.7;'>{body.body}</div>")
    success = send_email(body.to_email, body.subject, html)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email.")

    log_audit(user_ctx["id"], "send_custom_email", "email", body.to_email, {"subject": body.subject})
    return {"message": f"Email sent to {body.to_email}"}
