"""
Mail module API routes.
"""

import json
import logging

from fastapi import APIRouter, HTTPException, Query

from autohelper.config import get_settings
from autohelper.db import get_db
from autohelper.modules.mail.draft import (
    DraftCreationError,
    create_draft_via_com,
    create_draft_via_graph,
)
from autohelper.modules.mail.schemas import (
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
from autohelper.modules.mail.service import MailService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mail", tags=["mail"])


@router.get("/status", response_model=MailServiceStatus)
async def get_status() -> MailServiceStatus:
    """Get current mail service status."""
    settings = get_settings()
    svc = MailService()

    return MailServiceStatus(
        enabled=settings.mail_enabled,
        running=svc.running,
        poll_interval=settings.mail_poll_interval,
        output_path=str(settings.mail_output_path),
        ingest_path=str(settings.mail_ingest_path),
    )


@router.post("/start")
async def start_service() -> dict[str, str]:
    """Start the mail polling service."""
    svc = MailService()
    # Reload settings in case they changed
    svc.settings = get_settings()
    svc.start()
    return {"status": "started" if svc.running else "disabled"}


@router.post("/stop")
async def stop_service() -> dict[str, str]:
    """Stop the mail polling service."""
    svc = MailService()
    svc.stop()
    return {"status": "stopped"}


@router.get("/emails", response_model=TransientEmailList)
async def list_emails(
    project_id: str | None = Query(None, description="Filter by project ID"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> TransientEmailList:
    """List transient emails with optional filtering."""
    db = get_db()

    # Use parameterized queries to avoid SQL injection
    # The where_clause only contains static SQL, user input goes through params
    if project_id:
        count_sql = "SELECT COUNT(*) FROM transient_emails WHERE project_id = ?"
        total = db.execute(count_sql, (project_id,)).fetchone()[0]

        rows = db.execute(
            """
            SELECT id, subject, sender, received_at, project_id, body_preview,
                   metadata, ingestion_id, created_at
            FROM transient_emails
            WHERE project_id = ?
            ORDER BY received_at DESC
            LIMIT ? OFFSET ?
        """,
            (project_id, limit, offset),
        ).fetchall()
    else:
        count_sql = "SELECT COUNT(*) FROM transient_emails"
        total = db.execute(count_sql).fetchone()[0]

        rows = db.execute(
            """
            SELECT id, subject, sender, received_at, project_id, body_preview,
                   metadata, ingestion_id, created_at
            FROM transient_emails
            ORDER BY received_at DESC
            LIMIT ? OFFSET ?
        """,
            (limit, offset),
        ).fetchall()

    emails = []
    for row in rows:
        metadata = None
        if row[6]:
            try:
                metadata = json.loads(row[6])
            except (json.JSONDecodeError, TypeError):
                metadata = None

        emails.append(
            TransientEmail(
                id=row[0],
                subject=row[1],
                sender=row[2],
                received_at=row[3],
                project_id=row[4],
                body_preview=row[5],
                metadata=metadata,
                ingestion_id=row[7],
                created_at=row[8],
            )
        )

    return TransientEmailList(
        emails=emails,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/emails/{email_id}", response_model=TransientEmail)
async def get_email(email_id: str) -> TransientEmail:
    """Get a single transient email by ID."""
    db = get_db()

    row = db.execute(
        """
        SELECT id, subject, sender, received_at, project_id, body_preview,
               metadata, ingestion_id, created_at
        FROM transient_emails
        WHERE id = ?
    """,
        (email_id,),
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Email not found")

    metadata = None
    if row[6]:
        try:
            metadata = json.loads(row[6])
        except (json.JSONDecodeError, TypeError):
            metadata = None

    return TransientEmail(
        id=row[0],
        subject=row[1],
        sender=row[2],
        received_at=row[3],
        project_id=row[4],
        body_preview=row[5],
        metadata=metadata,
        ingestion_id=row[7],
        created_at=row[8],
    )


@router.get("/ingestion-log", response_model=IngestionLogList)
async def list_ingestion_log(
    limit: int = Query(50, ge=1, le=500),
) -> IngestionLogList:
    """List PST/OST ingestion history."""
    db = get_db()

    total = db.execute("SELECT COUNT(*) FROM mail_ingestion_log").fetchone()[0]

    rows = db.execute(
        """
        SELECT id, source_path, ingested_at, email_count, status, error_message
        FROM mail_ingestion_log
        ORDER BY ingested_at DESC
        LIMIT ?
    """,
        (limit,),
    ).fetchall()

    entries = [
        IngestionLogEntry(
            id=row[0],
            source_path=row[1],
            ingested_at=row[2],
            email_count=row[3] or 0,
            status=row[4],
            error_message=row[5],
        )
        for row in rows
    ]

    return IngestionLogList(entries=entries, total=total)


@router.post("/ingest", response_model=IngestResponse)
async def ingest_pst(request: IngestRequest) -> IngestResponse:
    """
    Ingest a PST/OST file.

    Security: File must be located under the configured mail_ingest_path
    and have a .pst or .ost extension.
    """
    svc = MailService()
    result = svc.ingest_pst(request.file_path)

    return IngestResponse(
        success=result.get("success", False),
        count=result.get("count"),
        error=result.get("error"),
    )


@router.post("/draft", response_model=CreateDraftResponse)
async def create_draft(request: CreateDraftRequest) -> CreateDraftResponse:
    """
    Create an email draft in Outlook.

    Strategy:
    1. Try Microsoft Graph API using proxied Entra token from AutoArt backend
    2. Fall back to Outlook COM automation on Windows
    3. Return 502 if both strategies fail
    """
    from autohelper.modules.context.autoart import AutoArtClient

    settings = get_settings()
    graph_error: str | None = None
    com_error: str | None = None

    # Strategy 1: Microsoft Graph API
    if settings.autoart_session_id:
        client = AutoArtClient(
            api_url=settings.autoart_api_url,
            api_key=settings.autoart_api_key,
            session_id=settings.autoart_session_id,
        )
        token = client.get_microsoft_token(settings.autoart_session_id)

        if token:
            try:
                result = await create_draft_via_graph(
                    token=token,
                    to=request.to,
                    subject=request.subject,
                    body=request.body,
                    cc=request.cc,
                    body_type=request.body_type,
                )
                return CreateDraftResponse(
                    success=True,
                    method="graph",
                    subject=result.get("subject"),
                    message_id=result.get("id"),
                )
            except DraftCreationError as e:
                graph_error = str(e)
                logger.warning(f"Graph API draft failed, trying COM fallback: {e}")
        else:
            graph_error = "No Microsoft Graph token available"
            logger.info("No Microsoft Graph token, trying COM fallback")
    else:
        graph_error = "No AutoArt session configured"
        logger.info("No AutoArt session, trying COM fallback")

    # Strategy 2: Outlook COM (Windows only)
    try:
        result = create_draft_via_com(
            to=request.to,
            subject=request.subject,
            body=request.body,
            cc=request.cc,
        )
        return CreateDraftResponse(
            success=True,
            method="outlook_com",
            subject=result.get("subject"),
        )
    except DraftCreationError as e:
        com_error = str(e)
        logger.warning(f"Outlook COM draft also failed: {e}")

    # Both strategies failed
    raise HTTPException(
        status_code=502,
        detail={
            "error": "Draft creation failed",
            "graph_error": graph_error,
            "com_error": com_error,
        },
    )
