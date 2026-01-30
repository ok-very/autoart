"""
AutoHelper entrypoint - runs uvicorn server with optional system tray icon.
"""

import sys
import threading

import uvicorn

from autohelper.app import build_app
from autohelper.config import get_settings
from autohelper.shared.platform import has_dbus_tray, is_windows, platform_label

# Expose app for uvicorn factory/import
app = build_app()


def _run_with_tray(server: uvicorn.Server) -> None:
    """Start server in background, run pystray icon in foreground."""
    if not (is_windows() or has_dbus_tray()):
        print(
            f"No system tray support on {platform_label()} — "
            "skipping --tray, running in console mode."
        )
        server.run()
        return

    print("Starting in tray mode...")

    # Server in background
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    try:
        from autohelper.gui.icon import AutoHelperIcon

        def stop_server() -> None:
            server.should_exit = True

        tray = AutoHelperIcon(stop_callback=stop_server)
        tray.run()  # blocking until Exit chosen
    except Exception as e:
        print(f"Tray icon failed: {e}")
        print("Falling back to console mode.")
        server.should_exit = True
        server_thread.join()
        # Rebuild and run on main thread
        settings = get_settings()
        fallback_config = uvicorn.Config(
            build_app(settings),
            host=settings.host,
            port=settings.port,
            log_level=settings.log_level.lower(),
            loop="asyncio",
        )
        uvicorn.Server(fallback_config).run()
        return

    print("Stopping server...")
    server.should_exit = True
    server_thread.join(timeout=2)


def main() -> None:
    """Run the AutoHelper server."""
    settings = get_settings()

    print(f"Starting AutoHelper on http://{settings.host}:{settings.port}")
    print(f"Docs: http://{settings.host}:{settings.port}/docs")
    print(f"Platform: {platform_label()}")

    config = uvicorn.Config(
        build_app(settings),
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        loop="asyncio",
    )
    server = uvicorn.Server(config)

    if "--tray" in sys.argv:
        _run_with_tray(server)
    else:
        server.run()


if __name__ == "__main__":
    main()
