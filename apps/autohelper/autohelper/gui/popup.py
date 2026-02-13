"""
Settings popup — opens the local dashboard in the default browser.

The configuration UI is served directly by FastAPI at /dashboard,
so it works in standalone mode without the AutoArt React frontend.
"""

import webbrowser


def _settings_url() -> str:
    """Build the local dashboard URL from settings."""
    from autohelper.config import get_settings

    settings = get_settings()
    return f"http://{settings.host}:{settings.port}/dashboard"


def open_settings_in_browser() -> None:
    """Open the AutoHelper dashboard in the default browser."""
    webbrowser.open(_settings_url())


def launch_config_popup() -> int:
    """Backward-compat shim — opens the browser instead of a Qt window."""
    open_settings_in_browser()
    return 0
