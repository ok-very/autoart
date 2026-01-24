"""
AutoHelper entrypoint - runs uvicorn server.
"""

import sys
import threading

import uvicorn

from autohelper.app import build_app
from autohelper.config import get_settings

# Expose app for uvicorn factory/import
app = build_app()


def main() -> None:
    """Run the AutoHelper server."""
    settings = get_settings()

    print(f"Starting AutoHelper on http://{settings.host}:{settings.port}")
    print(f"Docs: http://{settings.host}:{settings.port}/docs")

    config = uvicorn.Config(
        build_app(settings),
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        loop="asyncio",
    )
    server = uvicorn.Server(config)

    if "--popup" in sys.argv:
        print("Starting Config Popup...")
        from autohelper.gui.popup import launch_config_popup

        launch_config_popup()
        sys.exit(0)

    if "--tray" in sys.argv:
        print("Starting in System Tray mode (Qt)...")
        try:
            from autohelper.gui.popup import launch_config_popup

            # Run server in background thread
            server_thread = threading.Thread(target=server.run, daemon=True)
            server_thread.start()

            # Run Qt App (Blocking Main Thread)
            launch_config_popup()

            # Cleanup after Qt app exits
            print("Stopping server...")
            server.should_exit = True
            server_thread.join(timeout=2)
            sys.exit(0)

        except Exception as e:
            print(f"Failed to start GUI mode: {e}")
            print("Falling back to console mode.")
            server.run()
    else:
        # Standard console mode
        server.run()


if __name__ == "__main__":
    main()
