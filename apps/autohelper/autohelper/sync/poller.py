"""
Backend Poller - Syncs settings and executes commands from AutoArt backend.

Polls the backend every 5 seconds for:
- Settings changes (applies to local config if version changed)
- Pending commands (executes and acknowledges)

Also sends heartbeat with current status.
"""

import asyncio
import json
import threading
import urllib.error
import urllib.request
from typing import Any

from autohelper.config import get_settings, reset_settings
from autohelper.config.store import ConfigStore
from autohelper.shared.logging import get_logger

logger = get_logger(__name__)

# Global poller instance
_poller: "BackendPoller | None" = None


class BackendPoller:
    """
    Background thread that polls the AutoArt backend for settings and commands.
    """

    def __init__(self, poll_interval: float = 5.0) -> None:
        self.poll_interval = poll_interval
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._last_settings_version: int = 0
        self._running_commands: set[str] = set()

    def start(self) -> None:
        """Start the polling thread."""
        if self._thread is not None and self._thread.is_alive():
            logger.warning("Backend poller already running")
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._thread.start()
        logger.info("Backend poller started (interval: %ss)", self.poll_interval)

    def stop(self) -> None:
        """Stop the polling thread."""
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=10)
            self._thread = None
        logger.info("Backend poller stopped")

    def _poll_loop(self) -> None:
        """Main polling loop."""
        while not self._stop_event.wait(self.poll_interval):
            try:
                self._poll_once()
            except Exception:
                logger.exception("Backend poll failed")

    def _poll_once(self) -> None:
        """Single poll iteration: heartbeat + fetch settings/commands."""
        settings = get_settings()

        # Skip if not paired
        if not settings.autoart_link_key:
            return

        base_url = settings.autoart_api_url

        # 1. Send heartbeat with current status
        try:
            status = self._gather_status()
            self._post(f"{base_url}/api/autohelper/heartbeat", {"status": status})
        except Exception as e:
            logger.debug("Heartbeat failed: %s", e)

        # 2. Poll for settings and commands
        try:
            poll_response = self._get(f"{base_url}/api/autohelper/poll")
        except urllib.error.HTTPError as e:
            if e.code == 401:
                logger.warning("Link key invalid or expired, clearing pairing")
                self._clear_pairing()
            else:
                logger.debug("Poll failed: HTTP %d", e.code)
            return
        except Exception as e:
            logger.debug("Poll failed: %s", e)
            return

        # 3. Apply settings if version changed
        new_version = poll_response.get("settingsVersion", 0)
        if new_version > self._last_settings_version:
            self._apply_settings(poll_response.get("settings", {}))
            self._last_settings_version = new_version

        # 4. Execute pending commands
        commands = poll_response.get("commands", [])
        for cmd in commands:
            cmd_id = cmd.get("id")
            if cmd_id and cmd_id not in self._running_commands:
                self._execute_command(cmd_id, cmd.get("type"), cmd.get("payload", {}))

    def _gather_status(self) -> dict[str, Any]:
        """Gather current AutoHelper status for heartbeat."""
        status: dict[str, Any] = {}

        # Database status
        try:
            from autohelper.db import get_db
            from autohelper.db.migrate import get_migration_status

            db = get_db()
            settings = get_settings()
            db.execute("SELECT 1")
            mig = get_migration_status(db)
            status["database"] = {
                "connected": True,
                "path": str(settings.db_path),
                "migration_status": (
                    "current"
                    if mig["pending_count"] == 0
                    else f"{mig['pending_count']} pending"
                ),
            }
        except Exception:
            status["database"] = {"connected": False, "path": "", "migration_status": "unknown"}

        # Runner status
        try:
            from autohelper.modules.runner import get_runner_service

            runner_svc = get_runner_service()
            runner_status = runner_svc.get_status()
            status["runner"] = {
                "active": runner_status.active,
                "current_runner": runner_status.current_runner.value if runner_status.current_runner else None,
            }
        except Exception:
            status["runner"] = {"active": False}

        # Index status
        try:
            from autohelper.modules.index.service import IndexService

            index_svc = IndexService()
            index_status = index_svc.get_status()
            status["index"] = {
                "status": "running" if index_status.get("is_running") else "idle",
                "total_files": index_status.get("total_files", 0),
                "last_run": index_status.get("last_run"),
            }
        except Exception:
            status["index"] = {"status": "unknown"}

        # Mail status
        try:
            from autohelper.modules.mail import MailService

            mail_svc = MailService()
            status["mail"] = {
                "enabled": get_settings().mail_enabled,
                "running": mail_svc.is_running(),
            }
        except Exception:
            status["mail"] = {"enabled": False, "running": False}

        # GC status
        try:
            from autohelper.modules.gc.scheduler import get_scheduler
            from autohelper.modules.gc.service import GarbageCollectionService

            gc_svc = GarbageCollectionService()
            scheduler = get_scheduler()
            status["gc"] = {
                "enabled": get_settings().gc_enabled,
                "last_run": gc_svc.last_result.completed_at.isoformat() if gc_svc.last_result else None,
            }
        except Exception:
            status["gc"] = {"enabled": False}

        # Adapter availability
        status["adapters"] = self._gather_adapters()

        return status

    def _gather_adapters(self) -> list[dict[str, Any]]:
        """Gather available adapter information."""
        adapters: list[dict[str, Any]] = []

        # PDF - AutoHelper only (uses pdfplumber)
        try:
            import pdfplumber
            adapters.append({"name": "PDF", "available": True, "handler": "autohelper"})
        except ImportError:
            adapters.append({"name": "PDF", "available": False, "handler": "autohelper"})

        # DOCX - backend fallback available
        try:
            import docx
            adapters.append({"name": "DOCX", "available": True, "handler": "autohelper"})
        except ImportError:
            adapters.append({"name": "DOCX", "available": True, "handler": "backend"})

        # CSV - backend handles this
        adapters.append({"name": "CSV", "available": True, "handler": "backend"})

        # XLSX - backend handles this
        adapters.append({"name": "XLSX", "available": True, "handler": "backend"})

        # Web Collector - AutoHelper only
        try:
            from autohelper.modules.runner import get_runner_service
            from autohelper.modules.runner.types import RunnerId

            runner_svc = get_runner_service()
            runners = runner_svc.list_runners()
            logger.debug("Registered runners: %s", runners)
            has_autocollector = RunnerId.AUTOCOLLECTOR.value in runners
            adapters.append({"name": "Web Collector", "available": has_autocollector, "handler": "autohelper"})
        except Exception as e:
            logger.warning("Web Collector detection failed: %s", e)
            adapters.append({"name": "Web Collector", "available": False, "handler": "autohelper"})

        # Mail Poller - AutoHelper with backend MS Graph fallback
        try:
            from autohelper.modules.mail import MailService

            mail_svc = MailService()
            # If mail is running, report as autohelper; otherwise backend may have MS Graph
            running = mail_svc.is_running()
            adapters.append({
                "name": "Mail Poller",
                "available": True,
                "handler": "autohelper" if running else "backend",
            })
        except Exception:
            adapters.append({"name": "Mail Poller", "available": True, "handler": "backend"})

        return adapters

    def _apply_settings(self, new_settings: dict[str, Any]) -> None:
        """Apply settings from backend to local config."""
        logger.info("Applying settings from backend (version %d)", self._last_settings_version + 1)

        # Map backend settings to local config keys
        store = ConfigStore()
        cfg = store.load()

        # Update config with new values
        key_mapping = {
            "allowed_roots": "allowed_roots",
            "excludes": "excludes",
            "mail_enabled": "mail_enabled",
            "mail_poll_interval": "mail_poll_interval",
            "crawl_depth": "crawl_depth",
            "min_width": "min_width",
            "max_width": "max_width",
            "min_height": "min_height",
            "max_height": "max_height",
            "min_filesize_kb": "min_filesize_kb",
            "max_filesize_kb": "max_filesize_kb",
        }

        for backend_key, local_key in key_mapping.items():
            if backend_key in new_settings:
                cfg[local_key] = new_settings[backend_key]

        store.save(cfg)
        reset_settings()

        # Restart mail service if enabled state changed
        try:
            from autohelper.modules.mail import MailService

            mail_svc = MailService()
            new_mail_enabled = new_settings.get("mail_enabled", False)
            if new_mail_enabled and not mail_svc.is_running():
                mail_svc.start()
            elif not new_mail_enabled and mail_svc.is_running():
                mail_svc.stop()
        except Exception as e:
            logger.warning("Failed to update mail service: %s", e)

        logger.info("Settings applied successfully")

    def _execute_command(
        self, cmd_id: str, cmd_type: str | None, payload: dict[str, Any]
    ) -> None:
        """Execute a command from the backend."""
        if not cmd_type:
            return

        self._running_commands.add(cmd_id)
        logger.info("Executing command %s: %s", cmd_id, cmd_type)

        # Mark as running
        try:
            settings = get_settings()
            self._post(f"{settings.autoart_api_url}/api/autohelper/commands/{cmd_id}/start", {})
        except Exception as e:
            logger.warning("Failed to mark command as running: %s", e)

        # Execute in background thread
        def run_command() -> None:
            success = False
            result: dict[str, Any] | None = None

            try:
                if cmd_type == "rescan_index":
                    result = self._cmd_rescan_index()
                    success = True
                elif cmd_type == "rebuild_index":
                    result = self._cmd_rebuild_index()
                    success = True
                elif cmd_type == "run_collector":
                    result = self._cmd_run_collector(payload)
                    success = result.get("success", False) if result else False
                elif cmd_type == "start_mail":
                    result = self._cmd_start_mail()
                    success = True
                elif cmd_type == "stop_mail":
                    result = self._cmd_stop_mail()
                    success = True
                elif cmd_type == "run_gc":
                    result = self._cmd_run_gc()
                    success = True
                else:
                    logger.warning("Unknown command type: %s", cmd_type)
                    result = {"error": f"Unknown command: {cmd_type}"}
            except Exception as e:
                logger.exception("Command %s failed", cmd_type)
                result = {"error": str(e)}

            # Acknowledge completion
            try:
                settings = get_settings()
                self._post(
                    f"{settings.autoart_api_url}/api/autohelper/commands/{cmd_id}/ack",
                    {"success": success, "result": result},
                )
            except Exception as e:
                logger.warning("Failed to acknowledge command: %s", e)
            finally:
                self._running_commands.discard(cmd_id)

        threading.Thread(target=run_command, daemon=True).start()

    def _cmd_rescan_index(self) -> dict[str, Any]:
        """Execute rescan_index command."""
        from autohelper.modules.index.service import IndexService

        svc = IndexService()
        result = svc.rescan()
        return {"status": result.status, "message": result.message}

    def _cmd_rebuild_index(self) -> dict[str, Any]:
        """Execute rebuild_index command."""
        from autohelper.modules.index.service import IndexService

        svc = IndexService()
        result = svc.rebuild_index()
        return {"status": result.status, "message": result.message}

    def _cmd_run_collector(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Execute run_collector command."""
        url = payload.get("url")
        if not url:
            return {"success": False, "error": "No URL provided"}

        # Run collector synchronously (it's already in a background thread)
        from pathlib import Path

        from autohelper.modules.runner import get_runner_service
        from autohelper.modules.runner.types import InvokeRequest, RunnerId

        runner_svc = get_runner_service()
        output_path = payload.get("output_path")

        request = InvokeRequest(
            runner_id=RunnerId.AUTOCOLLECTOR,
            config={"url": url},
            output_folder=Path(output_path) if output_path else Path.home() / "Collected",
        )

        # Run synchronously using asyncio
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(runner_svc.invoke(request))
            return {
                "success": result.success,
                "error": result.error,
                "artifacts_count": len(result.artifacts) if result.artifacts else 0,
            }
        finally:
            loop.close()

    def _cmd_start_mail(self) -> dict[str, Any]:
        """Execute start_mail command."""
        from autohelper.modules.mail import MailService

        svc = MailService()
        svc.start()
        return {"started": True}

    def _cmd_stop_mail(self) -> dict[str, Any]:
        """Execute stop_mail command."""
        from autohelper.modules.mail import MailService

        svc = MailService()
        svc.stop()
        return {"stopped": True}

    def _cmd_run_gc(self) -> dict[str, Any]:
        """Execute run_gc command."""
        from autohelper.modules.gc.scheduler import trigger_gc_now

        triggered = trigger_gc_now()
        return {"triggered": triggered}

    def _clear_pairing(self) -> None:
        """Clear the local pairing key."""
        store = ConfigStore()
        cfg = store.load()
        cfg.pop("autoart_link_key", None)
        store.save(cfg)
        reset_settings()
        logger.info("Pairing cleared due to invalid link key")

    def _get(self, url: str) -> dict[str, Any]:
        """Make GET request with link key auth."""
        settings = get_settings()
        req = urllib.request.Request(url)
        req.add_header("X-AutoHelper-Key", settings.autoart_link_key)
        req.add_header("Content-Type", "application/json")

        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())

    def _post(self, url: str, data: dict[str, Any]) -> dict[str, Any]:
        """Make POST request with link key auth."""
        settings = get_settings()
        body = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("X-AutoHelper-Key", settings.autoart_link_key)
        req.add_header("Content-Type", "application/json")

        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())


def start_backend_poller() -> bool:
    """Start the global backend poller."""
    global _poller

    settings = get_settings()

    # Only start if paired
    if not settings.autoart_link_key:
        logger.info("Not paired, backend poller not started")
        return False

    if _poller is not None:
        logger.warning("Backend poller already exists")
        return True

    _poller = BackendPoller()
    _poller.start()
    return True


def stop_backend_poller() -> None:
    """Stop the global backend poller."""
    global _poller

    if _poller is not None:
        _poller.stop()
        _poller = None
