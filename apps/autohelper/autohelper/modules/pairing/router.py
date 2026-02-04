"""Pairing router — local unpair endpoint for tray menu.

POST /pair/unpair  Clear the local link key so the tray updates immediately.

Note: Pairing now happens via claim token flow — AutoHelper talks directly
to the backend /pair/redeem endpoint. The tray menu handles the dialog.
"""

import threading

from fastapi import APIRouter
from pydantic import BaseModel

from autohelper.config import reset_settings
from autohelper.config.store import ConfigStore
from autohelper.shared.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/pair", tags=["pairing"])


class UnpairResponse(BaseModel):
    paired: bool


def _reinit_clients_background() -> None:
    """Reinit context clients in background thread."""
    try:
        from autohelper.modules.context.service import ContextService

        ContextService().reinit_clients()
    except Exception as exc:
        logger.warning("Failed to reinit context service after unpair: %s", exc)


@router.post("/unpair", response_model=UnpairResponse)
def unpair() -> UnpairResponse:
    """Clear the local link key."""
    store = ConfigStore()
    cfg = store.load()

    cfg.pop("autoart_link_key", None)
    # Clean up legacy keys too
    cfg.pop("autoart_session_id", None)
    cfg.pop("autoart_api_key", None)
    store.save(cfg)

    reset_settings()

    # Reinit in background to avoid blocking the HTTP response
    threading.Thread(target=_reinit_clients_background, daemon=True).start()

    logger.info("Unpaired via HTTP endpoint")
    return UnpairResponse(paired=False)
