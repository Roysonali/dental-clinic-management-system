"""Minimal email delivery abstraction for DensCare.

The project previously had **no** email infrastructure. This module is the
single, small abstraction added for password recovery — it is intentionally
NOT a full notification framework.

Behaviour
---------
* When SMTP is configured (``SMTP_HOST`` + ``SMTP_FROM_EMAIL`` env vars), a
  plain-text message is sent synchronously over SMTP (STARTTLS when the
  port is 587, opportunistic TLS for 465-less configurations, and login when
  credentials are provided).
* When SMTP is NOT configured the service degrades gracefully:
  * ``EMAIL_LOG_RESET_LINKS=true`` (development only) → the full reset link
    is logged so local developers can click it. This deliberately logs the
    raw token, which is why it is opt-in and documented as dev-only.
  * otherwise → an opaque warning is logged (no token, no link, no email
    body) and delivery is skipped.

No credentials are ever hardcoded here — everything comes from
:mod:`app.core.config` (environment variables).

Failures are swallowed and logged (never re-raised) so the caller can keep
returning the generic anti-enumeration response — surfacing SMTP errors to
the caller would let an attacker distinguish existing from non-existing
accounts by comparing response codes.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Config-driven email abstraction with a safe no-op fallback."""

    @property
    def is_configured(self) -> bool:
        """True when SMTP delivery is fully configured."""
        return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)

    def send_password_reset_email(
        self,
        to_email: str,
        reset_url: str,
        *,
        expire_minutes: int | None = None,
    ) -> None:
        """Send the password-reset instruction email.

        Args:
            to_email: Recipient's email address.
            reset_url: Full reset link containing the raw token.
            expire_minutes: Token lifetime in minutes, included in the body
                so the user knows the deadline. Defaults to the configured
                value when omitted.

        Raises:
            Nothing — delivery failures are logged, not propagated (see the
            module docstring for the anti-enumeration rationale).
        """
        expiry = (
            expire_minutes
            if expire_minutes is not None
            else settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES
        )

        subject = "DensCare — Reset your password"
        body = (
            "Hello,\n\n"
            "We received a request to reset the password for your DensCare "
            "account.\n\n"
            "To reset your password, open the link below. It is valid for "
            f"{expiry} minutes:\n\n"
            f"{reset_url}\n\n"
            "If you did not request this, you can safely ignore this email. "
            "Your password will not change unless you use the link.\n\n"
            "— DensCare"
        )

        if not self.is_configured:
            if settings.EMAIL_LOG_RESET_LINKS:
                # Development-only escape hatch: without SMTP there is no
                # other way to exercise the flow. Never enable in production.
                logger.info(
                    "EMAIL_LOG_RESET_LINKS enabled — password reset link for "
                    "user=%s: %s",
                    to_email,
                    reset_url,
                )
            else:
                logger.warning(
                    "SMTP is not configured — password reset email NOT sent "
                    "for user=%s. Set SMTP_HOST/SMTP_FROM_EMAIL to enable "
                    "delivery.",
                    to_email,
                )
            return

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = settings.SMTP_FROM_EMAIL
        message["To"] = to_email
        message.set_content(body)

        try:
            # Implicit TLS (port 465) vs STARTTLS (port 587) vs plain.
            if settings.SMTP_USE_SSL:
                server = smtplib.SMTP_SSL(
                    settings.SMTP_HOST,
                    settings.SMTP_PORT,
                    timeout=15,
                )
            else:
                server = smtplib.SMTP(
                    settings.SMTP_HOST,
                    settings.SMTP_PORT,
                    timeout=15,
                )
                if settings.SMTP_USE_TLS:
                    server.starttls()

            with server:
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(message)

            logger.info(
                "Password reset email sent: to=%s (SMTP host=%s)",
                to_email,
                settings.SMTP_HOST,
            )
        except Exception:
            # Deliberately swallowed — see module docstring.
            logger.exception(
                "Failed to send password reset email: to=%s",
                to_email,
            )


# Module-level singleton consumed by the auth service. Tests patch this
# instance (or its method) to assert delivery without real SMTP.
email_service = EmailService()
