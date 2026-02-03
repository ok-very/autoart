"""Config module routes - read/write persistent config (data/config.json)."""

from typing import Any

from fastapi import APIRouter

from autohelper.config import reset_settings
from autohelper.config.store import ConfigStore
from autohelper.shared.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/config", tags=["config"])


@router.get("")
async def get_config() -> dict[str, Any]:
    """Return the current persistent config."""
    store = ConfigStore()
    return store.load()


@router.put("")
async def put_config(body: dict[str, Any]) -> dict[str, Any]:
    """
    Merge body into existing config, save, and reinitialise dependents.

    Returns the merged config.
    """
    store = ConfigStore()
    current = store.load()
    current.update(body)
    store.save(current)

    # Reset cached Settings so next access picks up new values
    reset_settings()

    # Reinitialise mail service with potentially updated settings
    try:
        from autohelper.modules.mail import MailService

        svc = MailService()
        svc.stop()
        # Re-read settings and apply persisted config values
        from autohelper.config import get_settings

        settings = get_settings()
        if "mail_enabled" in current:
            settings.mail_enabled = bool(current["mail_enabled"])
        if "mail_poll_interval" in current:
            settings.mail_poll_interval = int(current["mail_poll_interval"])

        svc.settings = settings
        svc.start()
    except Exception as exc:
        logger.warning("Failed to reinit mail service after config change: %s", exc)

    # Reinitialise context service so link key and other
    # context-layer settings take effect without a restart.
    try:
        from autohelper.modules.context.service import ContextService

        ctx = ContextService()
        ctx.reinit_clients()
    except Exception as exc:
        logger.warning("Failed to reinit context service after config change: %s", exc)

    return current
