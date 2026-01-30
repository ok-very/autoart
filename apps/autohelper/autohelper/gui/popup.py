"""
Legacy popup module — replaced by React frontend settings tab.

The configuration UI now lives at /settings#autohelper in the web frontend.
This module retains a lightweight helper to open the browser.
"""

import webbrowser


def _settings_url() -> str:
    """Derive the settings URL from autoart_api_url.

    Production: backend serves frontend at the same origin (:3001/settings).
    Dev fallback: localhost:5173/settings (Vite dev server).
    """
    from autohelper.config import get_settings

    api_url = get_settings().autoart_api_url  # e.g. "http://localhost:3001"
    return f"{api_url.rstrip('/')}/settings"


def open_settings_in_browser() -> None:
    """Open the AutoHelper settings tab in the default browser."""
    webbrowser.open(_settings_url())


def launch_config_popup() -> int:
    """Backward-compat shim — opens the browser instead of a Qt window."""
    open_settings_in_browser()
    return 0
