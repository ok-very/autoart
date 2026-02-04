"""Pairing router — lets the frontend pair/unpair AutoHelper over HTTP.

POST /pair         Accept a link key, verify it, persist to config.
POST /pair/unpair  Clear the local link key so the tray updates immediately.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from autohelper.config import get_settings, reset_settings
from autohelper.config.store import ConfigStore
from autohelper.modules.context.autoart import AutoArtClient
from autohelper.shared.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/pair", tags=["pairing"])


class PairRequest(BaseModel):
    key: str


class PairResponse(BaseModel):
    paired: bool
    error: str | None = None


class UnpairResponse(BaseModel):
    paired: bool


@router.post("", response_model=PairResponse)
def pair(body: PairRequest) -> PairResponse:
    """Accept a link key from the frontend, verify it against the backend, persist it."""
    try:
        settings = get_settings()
        client = AutoArtClient(
            api_url=settings.autoart_api_url,
            link_key=body.key,
        )

        # Verify the key works by hitting the credentials endpoint
        token = client.get_monday_token()
        if not token:
            return PairResponse(paired=False, error="Key rejected by backend — is Monday connected?")

        # Persist to config.json
        store = ConfigStore()
        cfg = store.load()
        cfg["autoart_link_key"] = body.key
        # Clean up legacy keys
        cfg.pop("autoart_session_id", None)
        cfg.pop("autoart_api_key", None)
        store.save(cfg)

        # Clear cached Settings so dependents pick up the new key
        reset_settings()

        # Reinitialise the context service
        try:
            from autohelper.modules.context.service import ContextService

            ContextService().reinit_clients()
        except Exception as exc:
            logger.warning("Failed to reinit context service after pairing: %s", exc)

        logger.info("Paired via HTTP endpoint")
        return PairResponse(paired=True)

    except Exception as exc:
        logger.error("Pairing failed: %s", exc)
        return PairResponse(paired=False, error="Internal error during pairing")


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

    try:
        from autohelper.modules.context.service import ContextService

        ContextService().reinit_clients()
    except Exception as exc:
        logger.warning("Failed to reinit context service after unpair: %s", exc)

    logger.info("Unpaired via HTTP endpoint")
    return UnpairResponse(paired=False)
