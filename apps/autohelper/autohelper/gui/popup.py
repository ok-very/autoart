"""
Legacy popup module — replaced by React frontend settings tab.

The configuration UI now lives at /settings#autohelper in the web frontend.
This module retains a lightweight helper to open the browser.
"""

import webbrowser


def _settings_url() -> str:
    """Derive the settings URL from autoart_frontend_url.

    Uses the dedicated frontend URL setting so the link works in both
    dev (Vite :5173) and production (backend-served) environments.
    """
    from autohelper.config import get_settings

    frontend_url = get_settings().autoart_frontend_url
    return f"{frontend_url.rstrip('/')}/settings#autohelper"


def open_settings_in_browser() -> None:
    """Open the AutoHelper settings tab in the default browser."""
    webbrowser.open(_settings_url())


def launch_config_popup() -> int:
    """Backward-compat shim — opens the browser instead of a Qt window."""
    open_settings_in_browser()
    return 0
