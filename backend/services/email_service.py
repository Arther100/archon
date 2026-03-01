"""
email_service.py — SMTP-based email notification service
Supports: welcome emails, password reset, usage alerts, feedback replies, custom admin emails.
Uses HTML templates with the Blueprint Engine branding.
"""

import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)

# ── SMTP Configuration ────────────────────────────────────────────────────────
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Blueprint Engine")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"


def is_email_configured() -> bool:
    """Check if SMTP credentials are configured."""
    return bool(SMTP_USER and SMTP_PASSWORD)


# ── Base HTML Template ────────────────────────────────────────────────────────
def _base_template(title: str, body_html: str, accent: str = "#3b6ef5") -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0d14;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0d14;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111622;border:1px solid #1e2a3d;border-radius:16px;overflow:hidden;">
    <!-- Header -->
    <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #1e2a3d;">
        <div style="font-size:20px;margin-bottom:4px;">📐</div>
        <h1 style="margin:0;font-size:18px;font-weight:700;color:#f0f4ff;letter-spacing:-0.02em;">Blueprint Engine</h1>
        <p style="margin:4px 0 0;font-size:11px;color:{accent};font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Deterministic Requirement Analysis</p>
    </td></tr>
    <!-- Title -->
    <tr><td style="padding:24px 32px 8px;">
        <h2 style="margin:0;font-size:16px;font-weight:700;color:#f0f4ff;">{title}</h2>
    </td></tr>
    <!-- Body -->
    <tr><td style="padding:8px 32px 28px;color:#8896b3;font-size:14px;line-height:1.7;">
        {body_html}
    </td></tr>
    <!-- Footer -->
    <tr><td style="padding:16px 32px;border-top:1px solid #1e2a3d;font-size:11px;color:#4a5568;text-align:center;">
        © Blueprint Engine · Document Analyser SaaS Platform
    </td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


# ── Core Send Function ────────────────────────────────────────────────────────
def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an email via SMTP. Returns True on success, False on failure."""
    if not is_email_configured():
        logger.warning("SMTP not configured — skipping email to %s", to_email)
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_USE_TLS:
                server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, to_email, msg.as_string())

        logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, str(e))
        return False


# ── Email Templates ───────────────────────────────────────────────────────────

def send_welcome_email(to_email: str, display_name: str = "") -> bool:
    """Send welcome email after successful signup."""
    name = display_name or to_email.split("@")[0]
    body = f"""
    <p>Hi <strong style="color:#f0f4ff;">{name}</strong>,</p>
    <p>Welcome to <strong style="color:#f0f4ff;">Blueprint Engine</strong>! 🎉</p>
    <p>Your account has been created successfully. Here's what you can do:</p>
    <table cellpadding="0" cellspacing="0" style="margin:16px 0;">
        <tr><td style="padding:6px 0;color:#f0f4ff;font-size:13px;">📄 <strong>Upload</strong> requirement documents (PDF/DOCX)</td></tr>
        <tr><td style="padding:6px 0;color:#f0f4ff;font-size:13px;">🔍 <strong>Analyze</strong> modules, fields, gaps & APIs</td></tr>
        <tr><td style="padding:6px 0;color:#f0f4ff;font-size:13px;">💬 <strong>Ask Questions</strong> about your documents</td></tr>
        <tr><td style="padding:6px 0;color:#f0f4ff;font-size:13px;">📊 <strong>Export</strong> API schemas and blueprints</td></tr>
    </table>
    <p>Get started by uploading your first document!</p>
    <div style="margin:20px 0;">
        <a href="{settings.FRONTEND_URL}" style="display:inline-block;padding:10px 24px;background:#3b6ef5;color:#fff;border-radius:8px;font-weight:600;font-size:13px;text-decoration:none;">Open Blueprint Engine →</a>
    </div>
    <p style="font-size:12px;color:#4a5568;">If you didn't create this account, please ignore this email.</p>
    """
    return send_email(to_email, "Welcome to Blueprint Engine! 🚀", _base_template("Welcome aboard! 🎉", body))


def send_password_changed_email(to_email: str) -> bool:
    """Notify user that their password was changed."""
    body = """
    <p>Your password has been <strong style="color:#f0f4ff;">successfully changed</strong>.</p>
    <div style="padding:12px 16px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:8px;margin:12px 0;">
        <p style="margin:0;color:#4ade80;font-size:13px;">✓ Password updated successfully</p>
    </div>
    <p>If you didn't make this change, please contact your administrator immediately or reset your password.</p>
    """
    return send_email(to_email, "Password Changed — Blueprint Engine", _base_template("Password Changed 🔒", body))


def send_usage_alert_email(to_email: str, tokens_used: int, monthly_limit: int, percentage: float) -> bool:
    """Alert user when they approach or exceed their token limit."""
    color = "#ef4444" if percentage >= 100 else "#f59e0b"
    status = "exceeded" if percentage >= 100 else "approaching"
    body = f"""
    <p>Your token usage is <strong style="color:{color};">{status} your monthly limit</strong>.</p>
    <div style="padding:14px 18px;background:#0d1219;border:1px solid #1e2a3d;border-radius:10px;margin:14px 0;">
        <table cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="color:#4a5568;font-size:12px;padding:4px 0;">Tokens Used</td>
                <td style="color:#f0f4ff;font-size:13px;font-weight:600;text-align:right;">{tokens_used:,}</td></tr>
            <tr><td style="color:#4a5568;font-size:12px;padding:4px 0;">Monthly Limit</td>
                <td style="color:#f0f4ff;font-size:13px;font-weight:600;text-align:right;">{monthly_limit:,}</td></tr>
            <tr><td style="color:#4a5568;font-size:12px;padding:4px 0;">Usage</td>
                <td style="color:{color};font-size:13px;font-weight:700;text-align:right;">{percentage:.1f}%</td></tr>
        </table>
        <!-- Progress bar -->
        <div style="margin-top:10px;background:#1e2a3d;border-radius:4px;height:6px;overflow:hidden;">
            <div style="width:{min(percentage, 100):.0f}%;height:100%;background:{color};border-radius:4px;"></div>
        </div>
    </div>
    <p>Consider upgrading your plan for higher limits, or contact your administrator.</p>
    """
    title = "⚠️ Token Limit Exceeded" if percentage >= 100 else "⚠️ Approaching Token Limit"
    return send_email(to_email, f"{title} — Blueprint Engine", _base_template(title, body))


def send_feedback_reply_email(to_email: str, feedback_title: str, reply_content: str, admin_name: str = "Admin") -> bool:
    """Notify user that an admin replied to their feedback."""
    body = f"""
    <p>An admin has replied to your feedback.</p>
    <div style="padding:14px 18px;background:#0d1219;border:1px solid #1e2a3d;border-radius:10px;margin:14px 0;">
        <p style="margin:0 0 8px;font-size:12px;color:#4a5568;text-transform:uppercase;font-weight:600;letter-spacing:0.05em;">Your Feedback</p>
        <p style="margin:0;font-size:14px;color:#f0f4ff;font-weight:600;">{feedback_title}</p>
    </div>
    <div style="padding:14px 18px;background:rgba(59,110,245,0.06);border:1px solid rgba(59,110,245,0.15);border-radius:10px;margin:14px 0;">
        <p style="margin:0 0 6px;font-size:11px;color:#7ba4f8;font-weight:600;">💬 Reply from {admin_name}</p>
        <p style="margin:0;font-size:14px;color:#c7d3e8;line-height:1.6;">{reply_content}</p>
    </div>
    <p>You can view the full conversation in your feedback panel.</p>
    """
    return send_email(to_email, f"Reply to your feedback: {feedback_title}", _base_template("New Reply on Your Feedback 💬", body))


def send_broadcast_email(to_email: str, broadcast_title: str, broadcast_content: str, priority: str = "normal") -> bool:
    """Send broadcast/announcement email."""
    priority_style = {
        "urgent": ("🔴", "#ef4444", "rgba(239,68,68,0.1)"),
        "high": ("🟠", "#f59e0b", "rgba(245,158,11,0.1)"),
        "normal": ("🔵", "#3b6ef5", "rgba(59,110,245,0.08)"),
        "low": ("⚪", "#8896b3", "rgba(136,150,179,0.08)"),
    }
    icon, color, bg = priority_style.get(priority, priority_style["normal"])
    body = f"""
    <div style="padding:14px 18px;background:{bg};border:1px solid {color}22;border-radius:10px;margin:8px 0 16px;">
        <p style="margin:0 0 6px;font-size:11px;color:{color};font-weight:600;">{icon} {priority.upper()} ANNOUNCEMENT</p>
        <p style="margin:0;font-size:15px;color:#f0f4ff;font-weight:600;">{broadcast_title}</p>
    </div>
    <div style="color:#c7d3e8;font-size:14px;line-height:1.7;">
        {broadcast_content}
    </div>
    """
    return send_email(to_email, f"[{priority.upper()}] {broadcast_title}", _base_template(f"{icon} Announcement", body))


def send_admin_message_email(to_email: str, message_title: str, message_body: str) -> bool:
    """Send a direct admin message to a user."""
    body = f"""
    <p>You have a new message from the platform administrator.</p>
    <div style="padding:16px 18px;background:rgba(59,110,245,0.06);border-left:3px solid #3b6ef5;border-radius:0 10px 10px 0;margin:14px 0;">
        <p style="margin:0 0 8px;font-size:14px;color:#f0f4ff;font-weight:600;">{message_title}</p>
        <p style="margin:0;font-size:14px;color:#c7d3e8;line-height:1.7;">{message_body}</p>
    </div>
    """
    return send_email(to_email, f"Message from Admin: {message_title}", _base_template("📩 Admin Message", body))


def send_role_changed_email(to_email: str, new_role: str, org_name: str = "") -> bool:
    """Notify user that their role was changed."""
    role_info = {
        "super_admin": ("🔴", "Super Admin", "Full platform access"),
        "org_admin": ("🟡", "Org Admin", "Manage organization users & settings"),
        "developer": ("🔵", "Developer", "Upload, analyze, edit & export"),
        "viewer": ("⚪", "Viewer", "View-only access"),
    }
    icon, label, desc = role_info.get(new_role, ("🔵", new_role, ""))
    org_text = f" in <strong style='color:#f0f4ff;'>{org_name}</strong>" if org_name else ""
    body = f"""
    <p>Your role{org_text} has been updated.</p>
    <div style="padding:14px 18px;background:#0d1219;border:1px solid #1e2a3d;border-radius:10px;margin:14px 0;text-align:center;">
        <div style="font-size:28px;margin-bottom:8px;">{icon}</div>
        <p style="margin:0;font-size:16px;color:#f0f4ff;font-weight:700;">{label}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#8896b3;">{desc}</p>
    </div>
    <p>Your permissions have been updated accordingly. You may need to refresh the page to see the changes.</p>
    """
    return send_email(to_email, f"Role Updated: {label}", _base_template("Role Updated 🛡️", body))
