from .router import router as mail_router
from .schemas import (
    CreateDraftRequest,
    CreateDraftResponse,
    IngestionLogEntry,
    IngestionLogList,
    IngestRequest,
    IngestResponse,
    MailServiceStatus,
    TransientEmail,
    TransientEmailList,
)
from .service import MailService

__all__ = [
    "CreateDraftRequest",
    "CreateDraftResponse",
    "MailService",
    "mail_router",
    "MailServiceStatus",
    "TransientEmail",
    "TransientEmailList",
    "IngestionLogEntry",
    "IngestionLogList",
    "IngestRequest",
    "IngestResponse",
]
