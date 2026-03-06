"""FastAPI routes for ClickUp integration."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from .manifest import ImportManifest, ManifestExecutionResult
from .service import execute_manifest, validate_connection

router = APIRouter(prefix="/clickup", tags=["clickup"])


@router.get("/validate")
async def clickup_validate() -> dict[str, str]:
    """Validate ClickUp connection and return workspace info."""
    try:
        return await validate_connection()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/execute-manifest", response_model=ManifestExecutionResult)
async def clickup_execute_manifest(
    manifest: ImportManifest,
) -> ManifestExecutionResult:
    """Execute an import manifest — create tasks in ClickUp."""
    try:
        return await execute_manifest(manifest)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ── Template Sync ─────────────────────────────────────────────────────────


@router.post("/template-sync")
async def clickup_template_sync(
    force: bool = Query(False, description="Apply changes (default: dry-run)"),
    list_id: str | None = Query(None, description="Override list ID"),
) -> dict[str, Any]:
    """Run BFA template sync against ClickUp list."""
    from .template_sync import sync_template

    try:
        report = await sync_template(force=force, list_id=list_id)
        return {
            "applied": report.applied,
            "total_template": report.total_template,
            "total_clickup": report.total_clickup,
            "creates": len(report.creates),
            "updates": len(report.updates),
            "orphans": len(report.orphans),
            "errors": report.errors,
            "actions": [
                {
                    "action": a.action,
                    "name": a.name,
                    "temp_id": a.temp_id,
                    "details": a.details,
                }
                for a in report.creates + report.updates + report.orphans
            ],
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/template-sync/status")
async def clickup_template_sync_status() -> dict[str, Any]:
    """Get template sync scheduler status."""
    from .scheduler import get_next_sync_time

    from autohelper.config import get_settings

    settings = get_settings()
    next_sync = get_next_sync_time()

    return {
        "enabled": getattr(settings, "clickup_sync_enabled", False),
        "interval_hours": getattr(settings, "clickup_sync_interval_hours", 6),
        "next_sync": next_sync.isoformat() if next_sync else None,
    }


# ── Project Status ────────────────────────────────────────────────────────


@router.get("/project-status")
async def clickup_project_status(
    list_id: str = Query(..., description="ClickUp list ID to analyze"),
) -> dict[str, Any]:
    """
    Analyze a BFA project list and return dependency-aware project state.

    Returns current stage, stage progress, actionable/blocked tasks,
    and the next milestone.
    """
    import json
    from importlib import resources as pkg_resources

    from .client import ClickUp as CU
    from .service import _get_token

    try:
        token = _get_token()

        # Load BFA template
        data_pkg = pkg_resources.files("autohelper") / "data" / "bfa_templates.json"
        template = json.loads(data_pkg.read_text(encoding="utf-8"))

        async with CU(token) as cu:
            # Fetch all tasks
            all_tasks = await cu.tasks.list_all(list_id, include_closed=True)

        # Build template lookups
        tmpl_by_name: dict[str, dict[str, Any]] = {}
        tmpl_by_id: dict[str, dict[str, Any]] = {}
        for t in template["tasks"]:
            tmpl_by_name[t["name"].strip().lower()] = t
            tmpl_by_id[t["temp_id"]] = t

        # Map ClickUp tasks to template
        temp_to_cu: dict[str, dict[str, Any]] = {}
        completed_temps: set[str] = set()
        done_types = {"closed", "done", "complete", "completed"}

        for task in all_tasks:
            tmpl = tmpl_by_name.get(task.name.strip().lower())
            if not tmpl:
                continue
            temp_to_cu[tmpl["temp_id"]] = {
                "id": task.id,
                "name": task.name,
                "status": task.status.status,
            }
            if task.status.type.lower() in done_types:
                completed_temps.add(tmpl["temp_id"])

        # Build reverse blocks map
        blocks_map: dict[str, list[str]] = {}
        for t in template["tasks"]:
            for dep in t.get("depends_on", []):
                blocks_map.setdefault(dep, []).append(t["temp_id"])

        # Classify tasks
        actionable: list[dict[str, Any]] = []
        blocked: list[dict[str, Any]] = []
        completed_count = 0
        stage_progress: dict[int, dict[str, int]] = {}
        for s in template["stages"]:
            stage_progress[s["number"]] = {"total": 0, "done": 0}

        next_milestone: dict[str, Any] | None = None

        for tmpl in template["tasks"]:
            stage = tmpl["stage"]
            if stage in stage_progress:
                stage_progress[stage]["total"] += 1

            if tmpl["temp_id"] in completed_temps:
                completed_count += 1
                if stage in stage_progress:
                    stage_progress[stage]["done"] += 1
                continue

            unresolved = [
                d for d in tmpl.get("depends_on", []) if d not in completed_temps
            ]
            cu_task = temp_to_cu.get(tmpl["temp_id"])

            summary = {
                "id": cu_task["id"] if cu_task else tmpl["temp_id"],
                "name": tmpl["name"],
                "stage": stage,
                "status": cu_task["status"] if cu_task else "not created",
                "blockedBy": [
                    temp_to_cu[d]["id"]
                    for d in unresolved
                    if d in temp_to_cu
                ],
                "blocks": [
                    temp_to_cu[b]["id"]
                    for b in blocks_map.get(tmpl["temp_id"], [])
                    if b in temp_to_cu
                ],
                "hasEmailTemplate": bool(tmpl.get("email_template_key")),
                "isMilestone": tmpl.get("is_milestone", False),
            }

            if unresolved:
                blocked.append(summary)
            else:
                actionable.append(summary)

            if tmpl.get("is_milestone") and next_milestone is None:
                next_milestone = summary

        # Compute percentages
        stage_result: dict[str, dict[str, Any]] = {}
        for s in template["stages"]:
            sp = stage_progress[s["number"]]
            pct = round(sp["done"] / sp["total"] * 100) if sp["total"] > 0 else 0
            stage_result[str(s["number"])] = {
                "name": s["name"],
                "total": sp["total"],
                "done": sp["done"],
                "pct": pct,
            }

        # Current stage
        current_stage = template["stages"][-1]["number"]
        for s in template["stages"]:
            sp = stage_progress[s["number"]]
            if sp["done"] < sp["total"]:
                current_stage = s["number"]
                break

        stage_name = next(
            (s["name"] for s in template["stages"] if s["number"] == current_stage),
            f"Stage {current_stage}",
        )

        return {
            "currentStage": current_stage,
            "stageName": stage_name,
            "stageProgress": stage_result,
            "actionableTasks": actionable,
            "blockedTasks": blocked[:20],
            "nextMilestone": next_milestone,
            "completedCount": completed_count,
            "totalCount": len(template["tasks"]),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ── Email Compose ─────────────────────────────────────────────────────────


@router.post("/compose-email")
async def clickup_compose_email(
    task_id: str = Query(..., description="ClickUp task ID"),
    template_key: str = Query(..., description="Email template key (e.g. '01.1')"),
) -> dict[str, Any]:
    """
    Compose an email draft from a ClickUp task and email template.

    Fetches task data from ClickUp, merges with template, and creates
    an Outlook draft via COM or Graph API.
    """
    from .email_templates import TemplateRegistry
    from .service import _get_token
    from .client import ClickUp as CU

    try:
        registry = TemplateRegistry.load()
        template = registry.get(template_key)
        if not template:
            raise HTTPException(
                status_code=404,
                detail=f"Template '{template_key}' not found",
            )

        # Fetch task data from ClickUp
        token = _get_token()
        async with CU(token) as cu:
            task = await cu.tasks.get(task_id)

        # Build merge context from task custom fields
        context: dict[str, str] = {
            "project_name": "",
            "developer": "",
            "name": "",
            "your_name": "",
        }

        # Extract from task name or custom fields
        for cf in task.custom_fields:
            cf_name = cf.name.lower().strip()
            if "project" in cf_name and cf.value:
                context["project_name"] = str(cf.value)
            elif "developer" in cf_name and cf.value:
                context["developer"] = str(cf.value)

        # Merge template with context
        merged = registry.merge(template_key, context)
        if not merged:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to merge template '{template_key}'",
            )

        # Create Outlook draft
        from autohelper.modules.mail.draft import (
            can_use_outlook,
            create_draft_via_com,
        )

        if can_use_outlook():
            result = create_draft_via_com(
                to="",  # Left empty for PM to fill in
                subject=merged.subject,
                body=merged.html_body,
            )
            return {
                "status": "draft_created",
                "strategy": "outlook_com",
                "subject": merged.subject,
                **result,
            }

        return {
            "status": "preview",
            "subject": merged.subject,
            "html_body": merged.html_body,
            "merge_fields": list(context.keys()),
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
