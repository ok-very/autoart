"""
System tray icon for AutoHelper using pystray + Pillow.

The smiley wears a cowboy hat when a job is running.

Menu:
  - AutoHelper Service      (disabled label)
  - Status: Idle/Working...  (disabled label)
  - Paired / Not paired      (disabled, validated against backend every 3 s)
  - Pair                     (visible only when not paired)
  - Unpair                   (visible only when paired)
  - ---
  - Open Settings
  - ---
  - Exit
"""

import json
import threading
import tkinter as tk
from tkinter import simpledialog
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
        """Check if a link key is present in config."""
        try:
            from autohelper.config.store import ConfigStore

            cfg = ConfigStore().load()
            if cfg.get("autoart_link_key"):
                return True

            from autohelper.config import get_settings

            settings = get_settings()
            return bool(getattr(settings, "autoart_link_key", ""))
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
            item(
                "Pair...",
                self._on_pair,
                visible=lambda _: not self._paired,
            ),
            item(
                "Unpair",
                self._on_unpair,
                visible=lambda _: self._paired,
            ),
            pystray.Menu.SEPARATOR,
            item("Open Settings", self._on_open_settings),
            pystray.Menu.SEPARATOR,
            item("Exit", self._on_exit),
        )
        self.icon = pystray.Icon("AutoHelper", image, "AutoHelper Service", menu)

    # ── Menu actions ─────────────────────────────────────────────────

    def _on_pair(self, icon: pystray.Icon, menu_item: pystray.MenuItem) -> None:
        """Open a dialog to enter the pairing code, then redeem it."""
        # Run tkinter dialog in a separate thread to avoid blocking pystray
        def do_pair():
            root = tk.Tk()
            root.withdraw()  # Hide the main window

            # Bring the dialog to the front
            root.attributes("-topmost", True)
            root.focus_force()

            code = simpledialog.askstring(
                "Pair AutoHelper",
                "Enter the 6-character pairing code from AutoArt:",
                parent=root,
            )

            root.destroy()

            if not code:
                return  # User cancelled

            code = code.strip().upper()
            if len(code) != 6:
                logger.warning("Invalid pairing code length: %d", len(code))
                return

            # Redeem the code via backend
            try:
                from autohelper.config import get_settings

                settings = get_settings()
                url = f"{settings.autoart_api_url}/pair/redeem"
                data = json.dumps({"code": code}).encode("utf-8")
                req = urllib.request.Request(url, data=data, method="POST")
                req.add_header("Content-Type", "application/json")

                with urllib.request.urlopen(req, timeout=10) as resp:
                    result = json.loads(resp.read())
                    key = result.get("key")

                if not key:
                    logger.error("Backend did not return a key")
                    return

                # Persist the key to config
                from autohelper.config import reset_settings
                from autohelper.config.store import ConfigStore

                store = ConfigStore()
                cfg = store.load()
                cfg["autoart_link_key"] = key
                cfg.pop("autoart_session_id", None)  # Clean up legacy
                store.save(cfg)
                reset_settings()

                # Reinit context service
                try:
                    from autohelper.modules.context.service import ContextService
                    ContextService().reinit_clients()
                except Exception as exc:
                    logger.warning("Failed to reinit context service: %s", exc)

                self._paired = True
                if self.icon:
                    self.icon.update_menu()

                logger.info("Paired via tray menu")

            except urllib.error.HTTPError as e:
                logger.error("Pairing failed: HTTP %d", e.code)
            except Exception:
                logger.exception("Pairing failed")

        threading.Thread(target=do_pair, daemon=True).start()

    def _on_unpair(self, icon: pystray.Icon, menu_item: pystray.MenuItem) -> None:
        """Hit the local /pair/unpair endpoint to clear session on both sides."""
        try:
            from autohelper.config import get_settings

            settings = get_settings()
            host = settings.host
            if host in ("0.0.0.0", "::"):
                host = "127.0.0.1"
            url = f"http://{host}:{settings.port}/pair/unpair"
            req = urllib.request.Request(url, data=b"", method="POST")
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=5):
                pass
            self._paired = False
            if self.icon:
                self.icon.update_menu()
            logger.info("Unpaired via tray menu")
        except Exception:
            logger.exception("Unpair from tray menu failed")

    def _on_open_settings(self, icon: pystray.Icon, menu_item: pystray.MenuItem) -> None:
        open_settings_in_browser()

    def _on_exit(self, icon: pystray.Icon, menu_item: pystray.MenuItem) -> None:
        print("Stopping AutoHelper...")
        self._stop_polling.set()
        icon.stop()
        if self.stop_callback:
            self.stop_callback()

    # ── Job polling ──────────────────────────────────────────────────

    def _poll_loop(self) -> None:
        """Poll job status + pairing every 3 s, update tray accordingly."""
        while not self._stop_polling.wait(3):
            menu_dirty = False

            try:
                active = self._is_job_active()
            except Exception:
                active = False

            if active != self._hat_on:
                self._hat_on = active
                if self.icon:
                    self.icon.icon = _make_icon(wearing_hat=active)
                menu_dirty = True

            paired = self._check_paired()
            if paired != self._paired:
                self._paired = paired
                menu_dirty = True

            if menu_dirty and self.icon:
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
