"""Pairing router — lets the frontend pair/unpair AutoHelper over HTTP.

POST /pair         Accept a 6-digit code, handshake with the backend, persist session.
POST /pair/unpair  Clear the local session so the tray updates immediately.
"""

import socket

from fastapi import APIRouter
from pydantic import BaseModel

from autohelper.config import get_settings, reset_settings
from autohelper.config.store import ConfigStore
from autohelper.modules.context.autoart import AutoArtClient
from autohelper.shared.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/pair", tags=["pairing"])


class PairRequest(BaseModel):
    code: str


class PairResponse(BaseModel):
    paired: bool
    displayId: str | None = None
    error: str | None = None


class UnpairResponse(BaseModel):
    paired: bool


@router.post("", response_model=PairResponse)
async def pair(body: PairRequest) -> PairResponse:
    """Exchange a pairing code for a session, persist it, and propagate."""
    try:
        settings = get_settings()
        client = AutoArtClient(
            api_url=settings.autoart_api_url,
            api_key=settings.autoart_api_key or None,
        )

        hostname = socket.gethostname()
        session_id = client.pair_with_code(body.code, instance_name=hostname)

        if not session_id:
            return PairResponse(paired=False, error="Handshake failed — check the code and try again")

        # Persist to config.json
        store = ConfigStore()
        cfg = store.load()
        cfg["autoart_session_id"] = session_id
        store.save(cfg)

        # Clear cached Settings so dependents pick up the new session
        reset_settings()

        # Reinitialise the context service
        try:
            from autohelper.modules.context.service import ContextService

            ContextService().reinit_clients()
        except Exception as exc:
            logger.warning("Failed to reinit context service after pairing: %s", exc)

        logger.info("Paired via HTTP endpoint, session: %s...", session_id[:8])
        return PairResponse(paired=True, displayId=hostname)

    except Exception as exc:
        logger.error("Pairing failed: %s", exc)
        return PairResponse(paired=False, error="Internal error during pairing")


@router.post("/unpair", response_model=UnpairResponse)
async def unpair() -> UnpairResponse:
    """Invalidate session server-side, then clear local state."""
    store = ConfigStore()
    cfg = store.load()
    old_session_id = cfg.get("autoart_session_id")

    # Tell the backend to drop the session before we forget the ID
    if old_session_id:
        settings = get_settings()
        client = AutoArtClient(
            api_url=settings.autoart_api_url,
            api_key=settings.autoart_api_key or None,
        )
        client.disconnect_session(old_session_id)

    # Clear local state regardless of backend result
    cfg.pop("autoart_session_id", None)
    store.save(cfg)

    reset_settings()

    try:
        from autohelper.modules.context.service import ContextService

        ContextService().reinit_clients()
    except Exception as exc:
        logger.warning("Failed to reinit context service after unpair: %s", exc)

    logger.info("Unpaired via HTTP endpoint")
    return UnpairResponse(paired=False)
