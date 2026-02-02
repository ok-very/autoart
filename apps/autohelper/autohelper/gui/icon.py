"""
System tray icon for AutoHelper using pystray + Pillow.

The smiley wears a cowboy hat when a job is running.

Menu:
  - AutoHelper Service      (disabled label)
  - Status: Idle/Working...  (disabled label)
  - Paired / Not paired      (disabled label)
  - ---
  - Pair with AutoArt        (visible only when not paired)
  - Open Settings
  - ---
  - Exit
"""

import json
import threading
import urllib.request
from collections.abc import Callable

import pystray
from PIL import Image, ImageDraw
from pystray import MenuItem as item

from autohelper.gui.popup import open_settings_in_browser
from autohelper.shared.logging import get_logger

logger = get_logger(__name__)

# ── Colours ──────────────────────────────────────────────────────────
_BG = (43, 85, 128)        # AutoHelper Blue
_FACE = (255, 204, 0)      # Smiley Yellow
_BLACK = (0, 0, 0)
_HAT = (160, 100, 40)      # Warm brown
_BAND = (90, 55, 25)       # Dark brown band


def _draw_smiley(dc: ImageDraw.ImageDraw, w: int, h: int) -> None:
    """Draw the base smiley face."""
    padding = 8
    dc.ellipse([padding, padding, w - padding, h - padding], fill=_FACE)

    # Eyes
    er = 4   # eye radius
    ey = 24  # eye center y
    ex = 16  # eye offset from center x

    dc.ellipse([32 - ex - er, ey - er, 32 - ex + er, ey + er], fill=_BLACK)
    dc.ellipse([32 + ex - er, ey - er, 32 + ex + er, ey + er], fill=_BLACK)

    # Smile
    dc.arc([20, 24, 44, 48], start=0, end=180, fill=_BLACK, width=3)


def _draw_cowboy_hat(dc: ImageDraw.ImageDraw) -> None:
    """Draw a cowboy hat on the smiley's head."""
    # Brim — wide ellipse sitting on top of the head
    dc.ellipse([0, 5, 64, 21], fill=_HAT)
    # Crown — tall rounded rectangle
    dc.rounded_rectangle([17, 0, 47, 14], radius=3, fill=_HAT)
    # Band
    dc.rectangle([17, 11, 47, 14], fill=_BAND)


def _make_icon(wearing_hat: bool = False) -> Image.Image:
    """Render the 64×64 tray icon."""
    size = 64
    image = Image.new("RGB", (size, size), _BG)
    dc = ImageDraw.Draw(image)

    _draw_smiley(dc, size, size)

    if wearing_hat:
        _draw_cowboy_hat(dc)

    return image


# ── Tray class ───────────────────────────────────────────────────────

class AutoHelperIcon:
    """Lightweight system tray icon — pystray only, no Qt."""

    def __init__(self, stop_callback: Callable[[], None]):
        self.stop_callback = stop_callback
        self.icon: pystray.Icon | None = None
        self._hat_on = False
        self._paired = self._check_paired()
        self._stop_polling = threading.Event()
        self._setup_icon()

    @staticmethod
    def _check_paired() -> bool:
        """Check whether an autoart_session_id exists in persisted config or settings."""
        try:
            from autohelper.config.store import ConfigStore

            cfg = ConfigStore().load()
            if cfg.get("autoart_session_id"):
                return True

            from autohelper.config import get_settings

            settings = get_settings()
            return bool(getattr(settings, "autoart_session_id", ""))
        except Exception:
            return False

    # ── Icon setup ───────────────────────────────────────────────────

    def _setup_icon(self) -> None:
        image = _make_icon(wearing_hat=False)
        menu = (
            item("AutoHelper Service", lambda *_: None, enabled=False),
            item(
                lambda _: "Status: Working..." if self._hat_on else "Status: Idle",
                lambda *_: None,
                enabled=False,
            ),
            item(
                lambda _: "Paired" if self._paired else "Not paired",
                lambda *_: None,
                enabled=False,
            ),
            pystray.Menu.SEPARATOR,
            item(
                "Pair with AutoArt",
                self._on_pair,
                visible=lambda _: not self._paired,
            ),
            item("Open Settings", self._on_open_settings),
            pystray.Menu.SEPARATOR,
            item("Exit", self._on_exit),
        )
        self.icon = pystray.Icon("AutoHelper", image, "AutoHelper Service", menu)

    # ── Menu actions ─────────────────────────────────────────────────

    def _on_open_settings(self, icon: pystray.Icon, menu_item: pystray.MenuItem) -> None:
        open_settings_in_browser()

    def _on_pair(self, icon: pystray.Icon, menu_item: pystray.MenuItem) -> None:
        from autohelper.gui.pairing import ask_pairing_code

        code = ask_pairing_code()
        if code is None:
            return

        try:
            from autohelper.config import get_settings, reset_settings
            from autohelper.config.store import ConfigStore
            from autohelper.modules.context.autoart import AutoArtClient

            settings = get_settings()
            client = AutoArtClient(
                api_url=settings.autoart_api_url,
                api_key=settings.autoart_api_key or None,
            )
            session_id = client.pair_with_code(code)

            if session_id:
                # Persist to config and propagate
                store = ConfigStore()
                cfg = store.load()
                cfg["autoart_session_id"] = session_id
                store.save(cfg)
                reset_settings()

                try:
                    from autohelper.modules.context.service import ContextService

                    ContextService().reinit_clients()
                except Exception as exc:
                    logger.warning("Failed to reinit context service after pairing: %s", exc)

                self._paired = True
                if self.icon:
                    self.icon.update_menu()
                logger.info("Pairing successful")
            else:
                self._show_error("Pairing failed — check the code and try again.")
        except Exception as exc:
            logger.error("Pairing error: %s", exc)
            self._show_error(f"Pairing error: {exc}")

    @staticmethod
    def _show_error(message: str) -> None:
        """Show an error dialog, falling back to console if tkinter unavailable."""
        try:
            import tkinter as tk
            from tkinter import messagebox

            root = tk.Tk()
            root.withdraw()
            messagebox.showerror("Pairing Error", message)
            root.destroy()
        except Exception:
            logger.error(message)

    def _on_exit(self, icon: pystray.Icon, menu_item: pystray.MenuItem) -> None:
        print("Stopping AutoHelper...")
        self._stop_polling.set()
        icon.stop()
        if self.stop_callback:
            self.stop_callback()

    # ── Job polling ──────────────────────────────────────────────────

    def _poll_loop(self) -> None:
        """Check every 3 s whether a job is active; swap hat on/off."""
        while not self._stop_polling.wait(3):
            try:
                active = self._is_job_active()
            except Exception:
                active = False

            if active != self._hat_on:
                self._hat_on = active
                if self.icon:
                    self.icon.icon = _make_icon(wearing_hat=active)
                    self.icon.update_menu()

    def _is_job_active(self) -> bool:
        """Hit localhost to see if runner or indexer is busy."""
        from autohelper.config import get_settings

        settings = get_settings()
        host = settings.host
        if host in ("0.0.0.0", "::"):
            host = "127.0.0.1"
        base = f"http://{host}:{settings.port}"

        # Runner
        with urllib.request.urlopen(f"{base}/runner/status", timeout=2) as resp:
            if json.loads(resp.read()).get("active"):
                return True

        # Indexer
        with urllib.request.urlopen(f"{base}/index/status", timeout=2) as resp:
            if json.loads(resp.read()).get("status") == "running":
                return True

        return False

    # ── Run ──────────────────────────────────────────────────────────

    def run(self) -> None:
        """Run the icon (blocking — call from main thread)."""
        if not self.icon:
            return
        poller = threading.Thread(target=self._poll_loop, daemon=True)
        poller.start()
        self.icon.run()

    def run_detached(self) -> None:
        """Run the icon in a background thread."""
        if not self.icon:
            return
        poller = threading.Thread(target=self._poll_loop, daemon=True)
        poller.start()
        self.icon.run_detached()
